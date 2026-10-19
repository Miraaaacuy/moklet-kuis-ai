"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fixedOptionsFor, imagePublicUrl, QUESTION_TYPES } from "@/lib/questions";
import { uploadQuestionImage } from "@/lib/upload";
import type { Question, QuestionType } from "@/lib/types";
import { answerStyle } from "@/components/play/answer-style";
import { Modal } from "@/components/modal";

export type Draft = Omit<Question, "id" | "quiz_id" | "position"> & { id?: string };

const TIME_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const POINT_CHOICES = [500, 1000, 2000];

export function emptyDraft(type: QuestionType): Draft {
  return {
    type,
    prompt: type === "ai_or_real" ? "Gambar ini dibuat AI atau foto asli?" : "",
    image_path: null,
    options: fixedOptionsFor(type) ?? ["", "", "", ""],
    correct_index: 0,
    time_limit_sec: type === "multiple_choice" ? 20 : 15,
    points: 1000,
    explanation: "",
  };
}

interface Props {
  quizId: string;
  initial: Draft;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

export function QuestionForm({ quizId, initial, nextPosition, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : imagePublicUrl(draft.image_path)), [file, draft.image_path]);
  useEffect(() => () => {
    if (file && preview) URL.revokeObjectURL(preview);
  }, [file, preview]);

  const fixed = fixedOptionsFor(draft.type);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function changeType(type: QuestionType) {
    setDraft((d) => {
      const nextFixed = fixedOptionsFor(type);
      const options = nextFixed ?? (fixedOptionsFor(d.type) ? ["", "", "", ""] : d.options);
      return {
        ...d,
        type,
        options,
        correct_index: Math.min(d.correct_index, options.length - 1),
        prompt:
          type === "ai_or_real" && !d.prompt ? "Gambar ini dibuat AI atau foto asli?" : d.prompt,
      };
    });
  }

  function setOption(i: number, value: string) {
    setDraft((d) => ({ ...d, options: d.options.map((o, j) => (j === i ? value : o)) }));
  }

  async function save() {
    setError("");
    const hasImage = Boolean(file || draft.image_path);

    // Rapikan opsi pilihan ganda: buang opsi kosong & sesuaikan kunci jawaban.
    let options = draft.options;
    let correct = draft.correct_index;
    if (!fixed) {
      if (!options[correct]?.trim()) return setError("Opsi yang ditandai benar tidak boleh kosong.");
      const kept = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      if (kept.length < 2) return setError("Isi minimal 2 pilihan jawaban.");
      correct = kept.findIndex((x) => x.i === correct);
      options = kept.map((x) => x.o);
    }
    if (draft.type === "ai_or_real" && !hasImage) return setError("Soal AI atau Asli wajib ada gambarnya.");
    if (draft.type !== "ai_or_real" && !draft.prompt.trim() && !hasImage) {
      return setError("Tulis pertanyaannya dulu.");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const image_path = file ? await uploadQuestionImage(supabase, quizId, file) : draft.image_path;
      const row = {
        type: draft.type,
        prompt: draft.prompt.trim(),
        image_path,
        options,
        correct_index: correct,
        time_limit_sec: draft.time_limit_sec,
        points: draft.points,
        explanation: draft.explanation.trim(),
      };
      const { error } = draft.id
        ? await supabase.from("questions").update(row).eq("id", draft.id)
        : await supabase.from("questions").insert({ ...row, quiz_id: quizId, position: nextPosition });
      if (error) throw new Error(error.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} title={draft.id ? "Edit Soal" : "Soal Baru"}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {QUESTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => changeType(t.value)}
              className={`rounded-xl border-2 px-2 py-2 text-sm font-extrabold ${
                draft.type === t.value ? "border-brand bg-brand-soft text-brand" : "border-line hover:border-brand/40"
              }`}
            >
              <span className="block text-xl">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Pertanyaan">
          <textarea
            rows={2}
            value={draft.prompt}
            onChange={(e) => set("prompt", e.target.value)}
            placeholder="Tulis pertanyaan..."
            className="input"
          />
        </Field>

        <Field label={draft.type === "ai_or_real" ? "Gambar (wajib)" : "Gambar (opsional)"}>
          <div className="flex flex-wrap items-start gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-32 rounded-xl border border-line object-contain" />
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded-xl border-2 border-dashed border-brand/50 px-4 py-3 text-center text-sm font-bold text-brand hover:bg-brand-soft">
                {preview ? "Ganti gambar" : "📁 Pilih gambar"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {preview && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    set("image_path", null);
                  }}
                  className="text-sm font-bold text-bad hover:underline"
                >
                  Hapus gambar
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Pilihan jawaban — klik lingkaran untuk menandai jawaban benar">
          <div className="space-y-2">
            {draft.options.map((opt, i) => {
              const { color, icon } = answerStyle(draft.type, i);
              const isCorrect = draft.correct_index === i;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg text-white ${color}`}>{icon}</span>
                  {fixed ? (
                    <span className="flex-1 rounded-xl border-2 border-line bg-canvas px-3 py-2 font-bold">{opt}</span>
                  ) : (
                    <input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`Pilihan ${i + 1}${i >= 2 ? " (opsional)" : ""}`}
                      className="input flex-1"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => set("correct_index", i)}
                    aria-label="Tandai sebagai jawaban benar"
                    className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-lg font-black ${
                      isCorrect ? "border-good bg-good text-white" : "border-line text-transparent hover:border-good"
                    }`}
                  >
                    ✓
                  </button>
                </div>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Batas waktu">
            <select
              value={draft.time_limit_sec}
              onChange={(e) => set("time_limit_sec", Number(e.target.value))}
              className="input"
            >
              {TIME_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s} detik
                </option>
              ))}
            </select>
          </Field>
          <Field label="Poin maksimal">
            <select value={draft.points} onChange={(e) => set("points", Number(e.target.value))} className="input">
              {POINT_CHOICES.map((p) => (
                <option key={p} value={p}>
                  {p} {p === 2000 ? "(poin ganda)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Penjelasan (muncul setelah siswa menjawab)">
          <textarea
            rows={2}
            value={draft.explanation}
            onChange={(e) => set("explanation", e.target.value)}
            placeholder={
              draft.type === "ai_or_real"
                ? "Contoh: Perhatikan jari tangannya ada 6 dan tulisan di latar belakang tidak terbaca."
                : "Kenapa jawabannya itu?"
            }
            className="input"
          />
        </Field>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-bad">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 font-bold text-muted hover:bg-canvas">
            Batal
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-3d rounded-xl bg-brand px-6 py-2.5 font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-extrabold text-ink">{label}</p>
      {children}
    </div>
  );
}
