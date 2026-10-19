"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { createClient } from "@/lib/supabase/client";
import { AI_OR_REAL_OPTIONS } from "@/lib/questions";
import { uploadQuestionImage } from "@/lib/upload";

interface Item {
  file: File;
  url: string;
  isAi: boolean | null;
  explanation: string;
}

interface Props {
  quizId: string;
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Tambah banyak soal "AI atau Asli" sekaligus dari beberapa gambar. */
export function BulkImageForm({ quizId, nextPosition, onClose, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [timeLimit, setTimeLimit] = useState(15);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState("");

  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, url: URL.createObjectURL(file), isAi: null, explanation: "" }));
    urls.current.push(...next.map((it) => it.url));
    setItems((prev) => [...prev, ...next]);
  }

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    setError("");
    if (items.length === 0) return setError("Pilih gambar dulu.");
    if (items.some((it) => it.isAi === null)) return setError("Tandai setiap gambar: AI atau Asli.");

    const supabase = createClient();
    try {
      for (let i = 0; i < items.length; i++) {
        setProgress(`Mengunggah ${i + 1} dari ${items.length}...`);
        const it = items[i];
        const image_path = await uploadQuestionImage(supabase, quizId, it.file);
        const { error } = await supabase.from("questions").insert({
          quiz_id: quizId,
          position: nextPosition + i,
          type: "ai_or_real",
          prompt: "Gambar ini dibuat AI atau foto asli?",
          image_path,
          options: AI_OR_REAL_OPTIONS,
          correct_index: it.isAi ? 0 : 1,
          time_limit_sec: timeLimit,
          points: 1000,
          explanation: it.explanation.trim(),
        });
        if (error) throw new Error(error.message);
      }
      onSaved();
    } catch (e) {
      setProgress("");
      setError((e instanceof Error ? e.message : "Gagal menyimpan.") + " Soal yang sudah tersimpan tetap ada.");
    }
  }

  const busy = Boolean(progress);

  return (
    <Modal title="Tambah Banyak Soal AI atau Asli" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-brand/50 p-6 text-center font-bold text-brand hover:bg-brand-soft">
          📁 Pilih beberapa gambar sekaligus
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </label>

        {items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it, i) => (
              <div key={it.url} className="rounded-2xl border-2 border-line p-3">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt="" className="h-40 w-full rounded-xl bg-canvas object-contain" />
                  <button
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 rounded-full bg-black/60 px-2 text-sm font-bold text-white"
                    aria-label="Buang gambar"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => update(i, { isAi: true })}
                    className={`rounded-xl py-2 text-sm font-extrabold ${
                      it.isAi === true ? "bg-ans-ai text-white" : "bg-canvas text-muted"
                    }`}
                  >
                    🤖 AI
                  </button>
                  <button
                    onClick={() => update(i, { isAi: false })}
                    className={`rounded-xl py-2 text-sm font-extrabold ${
                      it.isAi === false ? "bg-ans-real text-white" : "bg-canvas text-muted"
                    }`}
                  >
                    📷 Asli
                  </button>
                </div>
                <input
                  value={it.explanation}
                  onChange={(e) => update(i, { explanation: e.target.value })}
                  placeholder="Penjelasan (opsional)"
                  className="input mt-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm font-bold">
          Batas waktu tiap soal:
          <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="input w-auto">
            {[10, 15, 20, 30].map((s) => (
              <option key={s} value={s}>
                {s} detik
              </option>
            ))}
          </select>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-bad">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          {progress && <span className="mr-auto text-sm font-bold text-brand">{progress}</span>}
          <button onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2.5 font-bold text-muted hover:bg-canvas">
            Batal
          </button>
          <button
            onClick={save}
            disabled={busy || items.length === 0}
            className="btn-3d rounded-xl bg-brand px-6 py-2.5 font-extrabold text-white disabled:opacity-60"
          >
            Simpan {items.length > 0 && `${items.length} soal`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
