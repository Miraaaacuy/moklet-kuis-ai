import type { QuestionType } from "./types";

export const IMAGE_BUCKET = "question-images";

export const QUESTION_TYPES: { value: QuestionType; label: string; emoji: string }[] = [
  { value: "ai_or_real", label: "AI atau Asli?", emoji: "🖼️" },
  { value: "multiple_choice", label: "Pilihan Ganda", emoji: "🔠" },
  { value: "true_false", label: "Benar / Salah", emoji: "✅" },
];

export const AI_OR_REAL_OPTIONS = ["Dibuat AI 🤖", "Foto Asli 📷"];
export const TRUE_FALSE_OPTIONS = ["Benar", "Salah"];

export function fixedOptionsFor(type: QuestionType): string[] | null {
  if (type === "ai_or_real") return AI_OR_REAL_OPTIONS;
  if (type === "true_false") return TRUE_FALSE_OPTIONS;
  return null;
}

export function typeLabel(type: QuestionType): string {
  const t = QUESTION_TYPES.find((q) => q.value === type);
  return t ? `${t.emoji} ${t.label}` : type;
}

export function imagePublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
