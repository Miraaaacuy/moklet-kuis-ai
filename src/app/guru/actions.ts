"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/supabase/server";

export async function createQuiz(formData: FormData) {
  const { supabase } = await requireTeacher();
  const title = String(formData.get("title") ?? "").trim() || "Quiz Tanpa Judul";

  const { data, error } = await supabase.from("quizzes").insert({ title }).select("id").single();
  if (error) throw new Error("Gagal membuat quiz: " + error.message);
  redirect(`/guru/quiz/${data.id}`);
}

export async function deleteQuiz(quizId: string) {
  const { supabase } = await requireTeacher();
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) return { error: error.message };
  revalidatePath("/guru");
  redirect("/guru");
}

export async function startSession(quizId: string, shuffle: boolean): Promise<{ error: string }> {
  const { supabase } = await requireTeacher();

  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .eq("quiz_id", quizId)
    .order("position");
  const questionIds = (questions ?? []).map((q) => q.id);
  if (questionIds.length === 0) return { error: "Tambahkan minimal 1 soal sebelum memulai sesi." };

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from("sessions")
      .insert({ quiz_id: quizId, pin: randomPin(), shuffle, question_ids: questionIds })
      .select("id")
      .single();
    if (!error) redirect(`/guru/sesi/${data.id}`);
    if (error.code !== "23505") return { error: "Gagal membuat sesi: " + error.message };
  }
  return { error: "Gagal membuat PIN unik. Coba lagi." };
}

export async function setSessionStatus(
  sessionId: string,
  status: "open" | "closed",
): Promise<{ error: string | null; pin?: string }> {
  const { supabase } = await requireTeacher();

  const update = (patch: Record<string, string>) =>
    supabase.from("sessions").update(patch).eq("id", sessionId).select("pin").single();

  let { data, error } = await update({ status });
  // Membuka ulang sesi lama bisa bentrok dengan PIN sesi lain yang sedang aktif.
  for (let attempt = 0; error?.code === "23505" && attempt < 10; attempt++) {
    ({ data, error } = await update({ status, pin: randomPin() }));
  }
  if (error || !data) return { error: error?.message ?? "Sesi tidak ditemukan." };

  revalidatePath(`/guru/sesi/${sessionId}`);
  return { error: null, pin: data.pin };
}

export async function deleteSession(sessionId: string) {
  const { supabase } = await requireTeacher();
  await supabase.from("sessions").delete().eq("id", sessionId);
  revalidatePath("/guru");
  redirect("/guru");
}

export async function signOut() {
  const { supabase } = await requireTeacher();
  await supabase.auth.signOut();
  redirect("/guru/login");
}

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
