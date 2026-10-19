import { notFound } from "next/navigation";
import { QuizEditor } from "./quiz-editor";
import { requireTeacher } from "@/lib/supabase/server";
import type { Question, Quiz } from "@/lib/types";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();

  const [{ data: quiz }, { data: questions }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", id).maybeSingle<Quiz>(),
    supabase.from("questions").select("*").eq("quiz_id", id).order("position").returns<Question[]>(),
  ]);
  if (!quiz) notFound();

  return <QuizEditor quiz={quiz} initialQuestions={questions ?? []} />;
}
