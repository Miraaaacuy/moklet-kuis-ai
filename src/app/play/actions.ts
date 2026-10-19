"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { imagePublicUrl } from "@/lib/questions";
import { calculateScore, NETWORK_GRACE_MS } from "@/lib/scoring";
import type { Player, PublicQuestion, Question, Session } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: "not_found" | "closed" | "stale" };

type Admin = ReturnType<typeof createAdminClient>;

const PLAYER_COLUMNS =
  "id, session_id, name, token, question_order, current_index, current_started_at, score, correct_count, streak, finished_at, joined_at";

// ---------------------------------------------------------------------
// Join
// ---------------------------------------------------------------------

export interface JoinResult {
  sessionId: string;
  playerId: string;
  token: string;
  name: string;
}

export async function joinSession(rawPin: string, rawName: string): Promise<Result<JoinResult>> {
  const pin = rawPin.replace(/\D/g, "");
  const name = rawName.replace(/\s+/g, " ").trim();

  if (pin.length !== 6) return { ok: false, error: "PIN harus 6 angka." };
  if (name.length < 2) return { ok: false, error: "Nama minimal 2 huruf." };
  if (name.length > 24) return { ok: false, error: "Nama maksimal 24 huruf." };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sessions")
    .select("id, status, shuffle, question_ids")
    .eq("pin", pin)
    .eq("status", "open")
    .maybeSingle<Pick<Session, "id" | "status" | "shuffle" | "question_ids">>();

  if (!session) return { ok: false, error: "PIN tidak ditemukan atau sesi sudah ditutup." };
  if (session.question_ids.length === 0) return { ok: false, error: "Quiz ini belum punya soal." };

  const order = session.shuffle ? shuffle(session.question_ids) : session.question_ids;

  const { data: player, error } = await admin
    .from("players")
    .insert({ session_id: session.id, name, question_order: order })
    .select("id, token, name")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Nama itu sudah dipakai. Coba tambahkan nomor absen." };
    return { ok: false, error: "Gagal bergabung. Coba lagi." };
  }

  return { ok: true, data: { sessionId: session.id, playerId: player.id, token: player.token, name: player.name } };
}

// ---------------------------------------------------------------------
// State permainan
// ---------------------------------------------------------------------

interface Summary {
  name: string;
  quizTitle: string;
  score: number;
  correctCount: number;
  total: number;
}

export type PlayState =
  | ({ status: "ready"; index: number } & Summary)
  | ({
      status: "question";
      index: number;
      streak: number;
      remainingMs: number;
      question: PublicQuestion;
    } & Summary)
  | ({
      status: "finished" | "closed";
      rank: number;
      playerCount: number;
      top: { name: string; score: number; isMe: boolean }[];
    } & Summary);

/**
 * Ambil keadaan pemain saat ini. Dengan `start = true`, soal berikutnya
 * dimulai (timer server berjalan). Tanpa itu, pemain yang belum mulai
 * akan melihat layar "Siap?".
 */
export async function getPlayState(playerId: string, token: string, start: boolean): Promise<Result<PlayState>> {
  const admin = createAdminClient();
  const ctx = await loadContext(admin, playerId, token);
  if (!ctx) return { ok: false, error: "Data pemain tidak ditemukan.", code: "not_found" };

  const { session, quizTitle } = ctx;
  let player = ctx.player;
  const total = player.question_order.length;

  // Loop untuk melewati soal yang sudah kadaluarsa (waktu habis saat siswa pergi)
  // atau soal yang sudah dihapus guru.
  for (let guard = 0; guard <= total; guard++) {
    const summary: Summary = {
      name: player.name,
      quizTitle,
      score: player.score,
      correctCount: player.correct_count,
      total,
    };

    if (player.current_index >= total) {
      return { ok: true, data: await finishedState(admin, player, summary, "finished") };
    }
    if (session.status === "closed") {
      return { ok: true, data: await finishedState(admin, player, summary, "closed") };
    }

    const question = await loadQuestion(admin, player.question_order[player.current_index]);
    if (!question) {
      player = (await advance(admin, player, { score: 0, correct: false, streak: player.streak })) ?? player;
      continue;
    }

    if (!player.current_started_at) {
      if (!start) return { ok: true, data: { status: "ready", index: player.current_index, ...summary } };
      const startedAt = new Date().toISOString();
      const { error } = await admin
        .from("players")
        .update({ current_started_at: startedAt })
        .eq("id", player.id)
        .eq("current_index", player.current_index)
        .is("current_started_at", null);
      if (error) return { ok: false, error: "Gagal memulai soal. Coba lagi." };
      player = { ...player, current_started_at: startedAt };
    }

    const elapsed = Date.now() - Date.parse(player.current_started_at!);
    const limitMs = question.time_limit_sec * 1000;

    if (elapsed > limitMs + NETWORK_GRACE_MS) {
      // Waktu habis — catat sebagai tidak dijawab lalu lanjut ke soal berikutnya.
      const recorded = await recordAnswer(admin, player, question, null, elapsed);
      // Soal berikutnya baru dimulai kalau `start` — kalau tidak, siswa melihat layar "Siap?".
      player = recorded?.player ?? (await reloadPlayer(admin, player.id)) ?? player;
      continue;
    }

    return {
      ok: true,
      data: {
        status: "question",
        index: player.current_index,
        streak: player.streak,
        remainingMs: Math.max(0, limitMs - elapsed),
        question: toPublicQuestion(question),
        ...summary,
      },
    };
  }

  return { ok: false, error: "Terjadi kesalahan. Muat ulang halaman." };
}

// ---------------------------------------------------------------------
// Jawab soal
// ---------------------------------------------------------------------

export interface AnswerFeedback {
  correct: boolean;
  timedOut: boolean;
  correctIndex: number;
  chosenIndex: number | null;
  points: number;
  speedPoints: number;
  streakBonus: number;
  streak: number;
  score: number;
  explanation: string;
  isLast: boolean;
}

export async function submitAnswer(
  playerId: string,
  token: string,
  questionId: string,
  choiceIndex: number | null,
): Promise<Result<AnswerFeedback>> {
  const admin = createAdminClient();
  const ctx = await loadContext(admin, playerId, token);
  if (!ctx) return { ok: false, error: "Data pemain tidak ditemukan.", code: "not_found" };

  const { player, session } = ctx;
  if (session.status === "closed") return { ok: false, error: "Sesi sudah ditutup oleh guru.", code: "closed" };

  const expectedId = player.question_order[player.current_index];
  if (expectedId !== questionId || !player.current_started_at) {
    return { ok: false, error: "Soal ini sudah lewat.", code: "stale" };
  }

  const question = await loadQuestion(admin, questionId);
  if (!question) return { ok: false, error: "Soal tidak ditemukan.", code: "stale" };

  if (choiceIndex !== null && (choiceIndex < 0 || choiceIndex >= question.options.length)) {
    return { ok: false, error: "Pilihan tidak valid." };
  }

  const elapsed = Date.now() - Date.parse(player.current_started_at);
  const recorded = await recordAnswer(admin, player, question, choiceIndex, elapsed);
  if (!recorded) return { ok: false, error: "Jawaban sudah tercatat.", code: "stale" };

  const { score, isCorrect, player: updated } = recorded;
  return {
    ok: true,
    data: {
      correct: isCorrect,
      timedOut: score.timedOut || choiceIndex === null,
      correctIndex: question.correct_index,
      chosenIndex: choiceIndex,
      points: score.points,
      speedPoints: score.speedPoints,
      streakBonus: score.streakBonus,
      streak: updated.streak,
      score: updated.score,
      explanation: question.explanation,
      isLast: updated.current_index >= updated.question_order.length,
    },
  };
}

// ---------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------

async function loadContext(admin: Admin, playerId: string, token: string) {
  if (!isUuid(playerId) || !isUuid(token)) return null;

  const { data: player } = await admin
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("id", playerId)
    .eq("token", token)
    .maybeSingle<Player>();
  if (!player) return null;

  const { data: session } = await admin
    .from("sessions")
    .select("id, status, quiz_id, quizzes(title)")
    .eq("id", player.session_id)
    .single<{ id: string; status: Session["status"]; quiz_id: string; quizzes: { title: string } | null }>();
  if (!session) return null;

  return { player, session, quizTitle: session.quizzes?.title ?? "Quiz" };
}

async function reloadPlayer(admin: Admin, playerId: string) {
  const { data } = await admin.from("players").select(PLAYER_COLUMNS).eq("id", playerId).maybeSingle<Player>();
  return data;
}

async function loadQuestion(admin: Admin, id: string | undefined) {
  if (!id) return null;
  const { data } = await admin.from("questions").select("*").eq("id", id).maybeSingle<Question>();
  return data;
}

/** Simpan jawaban + perbarui skor pemain. Mengembalikan null jika jawaban sudah pernah tercatat. */
async function recordAnswer(
  admin: Admin,
  player: Player,
  question: Question,
  choiceIndex: number | null,
  elapsedMs: number,
) {
  const score = calculateScore({
    correct: choiceIndex !== null && choiceIndex === question.correct_index,
    basePoints: question.points,
    timeLimitSec: question.time_limit_sec,
    elapsedMs,
    previousStreak: player.streak,
  });
  const isCorrect = choiceIndex !== null && choiceIndex === question.correct_index && !score.timedOut;

  const { error } = await admin.from("answers").insert({
    player_id: player.id,
    session_id: player.session_id,
    question_id: question.id,
    choice_index: choiceIndex,
    is_correct: isCorrect,
    points_awarded: score.points,
    time_ms: Math.min(elapsedMs, question.time_limit_sec * 1000 + NETWORK_GRACE_MS),
  });
  if (error) return null; // unique (player_id, question_id) — sudah dijawab

  const updated = await advance(admin, player, {
    score: score.points,
    correct: isCorrect,
    streak: score.newStreak,
  });
  if (!updated) return null;
  return { score, isCorrect, player: updated };
}

async function advance(admin: Admin, player: Player, change: { score: number; correct: boolean; streak: number }) {
  const nextIndex = player.current_index + 1;
  const { data } = await admin
    .from("players")
    .update({
      current_index: nextIndex,
      current_started_at: null,
      score: player.score + change.score,
      correct_count: player.correct_count + (change.correct ? 1 : 0),
      streak: change.streak,
      finished_at: nextIndex >= player.question_order.length ? new Date().toISOString() : null,
    })
    .eq("id", player.id)
    .eq("current_index", player.current_index)
    .select(PLAYER_COLUMNS)
    .maybeSingle<Player>();
  return data;
}

async function finishedState(
  admin: Admin,
  player: Player,
  summary: Summary,
  status: "finished" | "closed",
): Promise<PlayState> {
  const { data: players } = await admin
    .from("players")
    .select("id, name, score")
    .eq("session_id", player.session_id)
    .order("score", { ascending: false })
    .order("joined_at", { ascending: true });

  const list = players ?? [];
  const rank = list.filter((p) => p.score > player.score).length + 1;
  const top = list.slice(0, 5).map((p) => ({ name: p.name, score: p.score, isMe: p.id === player.id }));

  return { status, rank, playerCount: list.length, top, ...summary };
}

function toPublicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    imageUrl: imagePublicUrl(q.image_path),
    options: q.options,
    timeLimitSec: q.time_limit_sec,
    points: q.points,
  };
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
