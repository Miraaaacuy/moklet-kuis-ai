"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { BulkImageForm } from "./bulk-image-form";
import { emptyDraft, QuestionForm, type Draft } from "./question-form";
import { deleteQuiz, startSession } from "@/app/guru/actions";
import { createClient } from "@/lib/supabase/client";
import { imagePublicUrl, QUESTION_TYPES, typeLabel } from "@/lib/questions";
import type { Question, Quiz } from "@/lib/types";
import { answerLabel, answerStyle } from "@/components/play/answer-style";

export function QuizEditor({ quiz, initialQuestions }: { quiz: Quiz; initialQuestions: Question[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState(false);
  const [shuffle, setShuffle] = useState(true);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();

  const nextPosition = (questions.at(-1)?.position ?? 0) + 1;

  const reload = useCallback(async () => {
    const { data } = await createClient().from("questions").select("*").eq("quiz_id", quiz.id).order("position");
    if (data) setQuestions(data as Question[]);
  }, [quiz.id]);

  async function saveMeta(patch: Partial<Pick<Quiz, "title" | "description">>) {
    const { error } = await createClient().from("quizzes").update(patch).eq("id", quiz.id);
    flash(error ? "Gagal menyimpan: " + error.message : "Tersimpan ✓");
  }

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2000);
  }

  async function move(index: number, dir: -1 | 1) {
    const a = questions[index];
    const b = questions[index + dir];
    if (!a || !b) return;
    const swapped = [...questions];
    swapped[index] = { ...b, position: a.position };
    swapped[index + dir] = { ...a, position: b.position };
    setQuestions(swapped);
    const supabase = createClient();
    await Promise.all([
      supabase.from("questions").update({ position: b.position }).eq("id", a.id),
      supabase.from("questions").update({ position: a.position }).eq("id", b.id),
    ]);
    // posisi lama bisa sama (mis. data impor) — muat ulang agar urutan konsisten
    if (a.position === b.position) await renumber();
  }

  async function renumber() {
    const supabase = createClient();
    await Promise.all(questions.map((q, i) => supabase.from("questions").update({ position: i + 1 }).eq("id", q.id)));
    await reload();
  }

  async function remove(q: Question) {
    if (!confirm("Hapus soal ini?")) return;
    const { error } = await createClient().from("questions").delete().eq("id", q.id);
    if (error) return flash("Gagal menghapus: " + error.message);
    setQuestions((prev) => prev.filter((x) => x.id !== q.id));
  }

  function duplicate(q: Question) {
    setEditing({
      type: q.type,
      prompt: q.prompt,
      image_path: q.image_path,
      options: [...q.options],
      correct_index: q.correct_index,
      time_limit_sec: q.time_limit_sec,
      points: q.points,
      explanation: q.explanation,
    });
  }

  function onStart() {
    startTransition(async () => {
      const res = await startSession(quiz.id, shuffle);
      if (res?.error) flash(res.error);
    });
  }

  function onDeleteQuiz() {
    if (!confirm(`Hapus quiz "${title}" beserta semua soal dan riwayat sesinya?`)) return;
    startTransition(async () => {
      await deleteQuiz(quiz.id);
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/guru" className="text-sm font-bold text-muted hover:text-brand">
        ← Semua quiz
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Kolom kiri: info + soal */}
        <div className="space-y-6">
          <div className="space-y-2 rounded-2xl border-2 border-line bg-white p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== quiz.title && saveMeta({ title: title.trim() })}
              className="w-full rounded-lg text-2xl font-black outline-none focus:bg-canvas"
              aria-label="Judul quiz"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== quiz.description && saveMeta({ description })}
              placeholder="Deskripsi singkat (opsional)"
              className="w-full rounded-lg font-semibold text-muted outline-none focus:bg-canvas"
              aria-label="Deskripsi quiz"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-black">{questions.length} Soal</h2>
            {QUESTION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setEditing(emptyDraft(t.value))}
                className="rounded-xl border-2 border-line bg-white px-3 py-2 text-sm font-extrabold hover:border-brand hover:text-brand"
              >
                + {t.emoji} {t.label}
              </button>
            ))}
            <button
              onClick={() => setBulk(true)}
              className="rounded-xl border-2 border-brand bg-brand-soft px-3 py-2 text-sm font-extrabold text-brand hover:bg-brand hover:text-white"
            >
              + 🖼️ Banyak Gambar
            </button>
          </div>

          {questions.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-line bg-white p-10 text-center font-semibold text-muted">
              Belum ada soal. Tambahkan soal dengan tombol di atas.
            </p>
          ) : (
            <ol className="space-y-3">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  number={i + 1}
                  first={i === 0}
                  last={i === questions.length - 1}
                  onEdit={() => setEditing({ ...q })}
                  onDuplicate={() => duplicate(q)}
                  onDelete={() => remove(q)}
                  onMove={(dir) => move(i, dir)}
                />
              ))}
            </ol>
          )}
        </div>

        {/* Kolom kanan: mulai sesi */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border-2 border-brand bg-white p-5">
            <h3 className="text-lg font-black">Mulai Sesi</h3>
            <p className="mt-1 text-sm font-semibold text-muted">
              Siswa akan mendapat PIN untuk bergabung dan mengerjakan sendiri-sendiri.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
                className="size-4 accent-brand"
              />
              Acak urutan soal tiap siswa
            </label>
            <button
              onClick={onStart}
              disabled={pending || questions.length === 0}
              className="btn-3d mt-4 w-full rounded-xl bg-good py-3 text-lg font-black text-white disabled:opacity-50"
            >
              {pending ? "Memulai..." : "▶ Mulai Sesi"}
            </button>
          </div>

          <div className="rounded-2xl bg-brand-soft p-5 text-sm font-semibold leading-relaxed text-brand-dark">
            <p className="font-black">💡 Tips soal AI atau Asli</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Campur gambar AI dan foto asli dengan jumlah seimbang.</li>
              <li>Isi penjelasan ciri-cirinya supaya siswa belajar, bukan cuma menebak.</li>
              <li>Pakai “Banyak Gambar” untuk menambah banyak soal sekaligus.</li>
            </ul>
          </div>

          <button onClick={onDeleteQuiz} className="w-full text-sm font-bold text-bad hover:underline">
            Hapus quiz ini
          </button>
        </aside>
      </div>

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 font-bold text-white shadow-lg animate-rise">
          {notice}
        </div>
      )}

      {editing && (
        <QuestionForm
          quizId={quiz.id}
          initial={editing}
          nextPosition={nextPosition}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
            flash("Soal tersimpan ✓");
          }}
        />
      )}

      {bulk && (
        <BulkImageForm
          quizId={quiz.id}
          nextPosition={nextPosition}
          onClose={() => setBulk(false)}
          onSaved={async () => {
            setBulk(false);
            await reload();
            flash("Soal-soal tersimpan ✓");
          }}
        />
      )}
    </div>
  );
}

function QuestionCard({
  q,
  number,
  first,
  last,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: {
  q: Question;
  number: number;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const img = imagePublicUrl(q.image_path);
  return (
    <li className="flex gap-4 rounded-2xl border-2 border-line bg-white p-4">
      <div className="flex flex-col items-center gap-1">
        <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-black text-white">{number}</span>
        <button disabled={first} onClick={() => onMove(-1)} className="text-muted hover:text-brand disabled:opacity-20" aria-label="Naikkan">
          ▲
        </button>
        <button disabled={last} onClick={() => onMove(1)} className="text-muted hover:text-brand disabled:opacity-20" aria-label="Turunkan">
          ▼
        </button>
      </div>

      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="size-24 shrink-0 rounded-xl bg-canvas object-cover" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
          <span className="rounded-full bg-canvas px-2 py-0.5">{typeLabel(q.type)}</span>
          <span>⏱ {q.time_limit_sec} dtk</span>
          <span>⭐ {q.points}</span>
        </div>
        <p className="mt-1 font-extrabold">{q.prompt || <em className="text-muted">(tanpa teks)</em>}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {q.options.map((o, i) => (
            <span
              key={i}
              className={`rounded-lg px-2 py-0.5 text-sm font-bold ${
                i === q.correct_index ? `${answerStyle(q.type, i).color} text-white` : "bg-canvas text-muted"
              }`}
            >
              {i === q.correct_index && "✓ "}
              {answerLabel(q.type, o)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 text-sm font-bold">
        <button onClick={onEdit} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-soft">
          Edit
        </button>
        <button onClick={onDuplicate} className="rounded-lg px-2 py-1 text-muted hover:bg-canvas">
          Duplikat
        </button>
        <button onClick={onDelete} className="rounded-lg px-2 py-1 text-bad hover:bg-red-50">
          Hapus
        </button>
      </div>
    </li>
  );
}
