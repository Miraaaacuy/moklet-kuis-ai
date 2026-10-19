import type { QuestionType } from "@/lib/types";

const SHAPES = ["▲", "◆", "●", "■"];
const COLORS = ["bg-ans-0", "bg-ans-1", "bg-ans-2", "bg-ans-3"];

export function answerStyle(type: QuestionType, index: number): { color: string; icon: string } {
  if (type === "ai_or_real") {
    return index === 0 ? { color: "bg-ans-ai", icon: "🤖" } : { color: "bg-ans-real", icon: "📷" };
  }
  if (type === "true_false") {
    return index === 0 ? { color: "bg-ans-1", icon: "✔" } : { color: "bg-ans-0", icon: "✖" };
  }
  return { color: COLORS[index % 4], icon: SHAPES[index % 4] };
}

/** Label tanpa emoji di belakang (opsi AI/Asli sudah punya ikon sendiri). */
export function answerLabel(type: QuestionType, label: string): string {
  return type === "ai_or_real" ? label.replace(/\s*[🤖📷]\s*$/u, "") : label;
}
