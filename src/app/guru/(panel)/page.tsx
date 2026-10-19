import Link from "next/link";
import { createQuiz } from "../actions";
import { StatusBadge } from "@/components/status-badge";
import { requireTeacher } from "@/lib/supabase/server";

export default async function TeacherHome() {
  const { supabase } = await requireTeacher();

  const [{ data: quizzes }, { data: sessions }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, description, created_at, questions(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("sessions")
      .select("id, pin, status, created_at, quizzes(title), players(count)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Quiz Saya</h1>
            <p className="font-semibold text-muted">Buat soal, lalu mulai sesi untuk dimainkan siswa.</p>
          </div>
          <form action={createQuiz} className="flex gap-2">
            <input
              name="title"
              placeholder="Judul quiz baru"
              className="w-56 rounded-xl border-2 border-line bg-white px-3 py-2 font-semibold outline-none focus:border-brand"
            />
            <button className="btn-3d rounded-xl bg-brand px-4 py-2 font-extrabold text-white">+ Buat</button>
          </form>
        </div>

        {!quizzes?.length ? (
          <Empty text="Belum ada quiz. Buat quiz pertamamu di atas!" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <Link
                key={q.id}
                href={`/guru/quiz/${q.id}`}
                className="group rounded-2xl border-2 border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
              >
                <h2 className="text-lg font-extrabold group-hover:text-brand">{q.title}</h2>
                {q.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{q.description}</p>}
                <p className="mt-3 text-sm font-bold text-brand">{countOf(q.questions)} soal</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-black">Riwayat Sesi</h2>
        {!sessions?.length ? (
          <Empty text="Belum ada sesi. Buka sebuah quiz lalu tekan “Mulai Sesi”." />
        ) : (
          <div className="overflow-hidden rounded-2xl border-2 border-line bg-white">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={`/guru/sesi/${s.id}`}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 last:border-0 hover:bg-canvas"
              >
                <div>
                  <p className="font-extrabold">{titleOf(s.quizzes)}</p>
                  <p className="text-sm text-muted">
                    {new Date(s.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} ·
                    PIN {s.pin}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="text-muted">{countOf(s.players)} siswa</span>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border-2 border-dashed border-line bg-white p-8 text-center font-semibold text-muted">
      {text}
    </p>
  );
}

// Supabase mengembalikan agregat relasi sebagai [{ count }]
function countOf(rel: unknown): number {
  return Array.isArray(rel) ? ((rel[0] as { count?: number })?.count ?? 0) : 0;
}

function titleOf(rel: unknown): string {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return (r as { title?: string } | null)?.title ?? "Quiz";
}
