import { notFound } from "next/navigation";
import { SessionDashboard } from "./session-dashboard";
import { requireTeacher } from "@/lib/supabase/server";
import type { Answer, Player, Question, Session } from "@/lib/types";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher();

  const { data: session } = await supabase
    .from("sessions")
    .select("*, quizzes(title)")
    .eq("id", id)
    .maybeSingle<Session & { quizzes: { title: string } | null }>();
  if (!session) notFound();

  const [{ data: questions }, { data: players }, { data: answers }] = await Promise.all([
    supabase.from("questions").select("*").in("id", session.question_ids).returns<Question[]>(),
    supabase.from("players").select("*").eq("session_id", id).returns<Player[]>(),
    supabase.from("answers").select("*").eq("session_id", id).returns<Answer[]>(),
  ]);

  // urutkan soal sesuai urutan saat sesi dibuat
  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const ordered = session.question_ids.map((qid) => byId.get(qid)).filter((q): q is Question => Boolean(q));

  const { quizzes, ...rest } = session;
  return (
    <SessionDashboard
      session={rest}
      quizTitle={quizzes?.title ?? "Quiz"}
      questions={ordered}
      initialPlayers={players ?? []}
      initialAnswers={answers ?? []}
    />
  );
}
