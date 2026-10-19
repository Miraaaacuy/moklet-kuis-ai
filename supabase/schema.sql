-- =====================================================================
-- Kuis AI Moklet — skema database Supabase
-- Jalankan seluruh file ini di Supabase Dashboard → SQL Editor → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------

create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  position       int  not null default 0,
  type           text not null check (type in ('ai_or_real', 'multiple_choice', 'true_false')),
  prompt         text not null default '',
  image_path     text,
  options        jsonb not null default '[]'::jsonb,
  correct_index  int  not null default 0,
  time_limit_sec int  not null default 20 check (time_limit_sec between 5 and 300),
  points         int  not null default 1000 check (points between 0 and 10000),
  explanation    text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pin          text not null,
  status       text not null default 'open' check (status in ('open', 'closed')),
  shuffle      boolean not null default false,
  -- urutan soal dibekukan saat sesi dibuat, supaya edit quiz tidak merusak sesi berjalan
  question_ids uuid[] not null,
  created_at   timestamptz not null default now()
);
-- PIN hanya perlu unik di antara sesi yang masih dibuka
create unique index if not exists sessions_open_pin_idx on public.sessions (pin) where status = 'open';

create table if not exists public.players (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.sessions(id) on delete cascade,
  name               text not null,
  token              uuid not null default gen_random_uuid(),
  question_order     uuid[] not null,
  current_index      int  not null default 0,
  current_started_at timestamptz,
  score              int  not null default 0,
  correct_count      int  not null default 0,
  streak             int  not null default 0,
  finished_at        timestamptz,
  joined_at          timestamptz not null default now()
);
create unique index if not exists players_session_name_idx on public.players (session_id, lower(name));

create table if not exists public.answers (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  session_id     uuid not null references public.sessions(id) on delete cascade,
  question_id    uuid references public.questions(id) on delete set null,
  choice_index   int,           -- null = waktu habis
  is_correct     boolean not null default false,
  points_awarded int not null default 0,
  time_ms        int not null default 0,
  created_at     timestamptz not null default now(),
  unique (player_id, question_id)
);
create index if not exists answers_session_idx on public.answers (session_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Guru (user yang login) hanya bisa mengelola datanya sendiri.
-- Siswa TIDAK punya akses langsung — semua aksi siswa lewat server
-- Next.js memakai service role key, jadi kunci jawaban tidak bocor.
-- ---------------------------------------------------------------------

alter table public.quizzes   enable row level security;
alter table public.questions enable row level security;
alter table public.sessions  enable row level security;
alter table public.players   enable row level security;
alter table public.answers   enable row level security;

drop policy if exists "guru kelola quiz" on public.quizzes;
create policy "guru kelola quiz" on public.quizzes
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "guru kelola soal" on public.questions;
create policy "guru kelola soal" on public.questions
  for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and q.owner_id = auth.uid()));

drop policy if exists "guru kelola sesi" on public.sessions;
create policy "guru kelola sesi" on public.sessions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "guru lihat pemain" on public.players;
create policy "guru lihat pemain" on public.players
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

drop policy if exists "guru hapus pemain" on public.players;
create policy "guru hapus pemain" on public.players
  for delete to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

drop policy if exists "guru lihat jawaban" on public.answers;
create policy "guru lihat jawaban" on public.answers
  for select to authenticated
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Realtime (dashboard guru update otomatis)
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'players') then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'answers') then
    alter publication supabase_realtime add table public.answers;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: gambar soal
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "guru upload gambar" on storage.objects;
create policy "guru upload gambar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images');

drop policy if exists "guru ubah gambar" on storage.objects;
create policy "guru ubah gambar" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and owner = auth.uid());

drop policy if exists "guru hapus gambar" on storage.objects;
create policy "guru hapus gambar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and owner = auth.uid());
