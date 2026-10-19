"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { deleteSession, setSessionStatus } from "@/app/guru/actions";
import { Modal } from "@/components/modal";
import { createClient } from "@/lib/supabase/client";
import { imagePublicUrl, typeLabel } from "@/lib/questions";
import type { Answer, Player, Question, Session } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { answerLabel, answerStyle } from "@/components/play/answer-style";

interface Props {
  session: Session;
  quizTitle: string;
  questions: Question[];
  initialPlayers: Player[];
  initialAnswers: Answer[];
}

export function SessionDashboard({ session, quizTitle, questions, initialPlayers, initialAnswers }: Props) {
  const [players, setPlayers] = useState(initialPlayers);
  const [answers, setAnswers] = useState(initialAnswers);
  const [status, setStatus] = useState(session.status);
  const [pin, setPin] = useState(session.pin);
  const [live, setLive] = useState(false);
  const [tab, setTab] = useState<"rank" | "questions">("rank");
  const [detail, setDetail] = useState<Player | null>(null);
  const [projector, setProjector] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/?pin=${pin}`);
  }, [pin]);

  // ---- data live -------------------------------------------------------
  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [p, a] = await Promise.all([
      supabase.from("players").select("*").eq("session_id", session.id),
      supabase.from("answers").select("*").eq("session_id", session.id),
    ]);
    if (p.data) setPlayers(p.data as Player[]);
    if (a.data) setAnswers(a.data as Answer[]);
  }, [session.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`sesi:${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `session_id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string }).id;
            setPlayers((prev) => prev.filter((p) => p.id !== oldId));
            return;
          }
          const row = payload.new as Player;
          setPlayers((prev) => {
            const i = prev.findIndex((p) => p.id === row.id);
            if (i === -1) return [...prev, row];
            const copy = [...prev];
            copy[i] = row;
            return copy;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const row = payload.new as Answer;
          setAnswers((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));

    // cadangan kalau koneksi realtime terputus
    const poll = setInterval(refetch, 15000);
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [session.id, refetch]);

  // ---- turunan ---------------------------------------------------------
  const total = questions.length;
  const ranked = useMemo(
    () =>
      [...players].sort(
        (a, b) =>
          b.score - a.score ||
          b.correct_count - a.correct_count ||
          Date.parse(a.finished_at ?? "9999") - Date.parse(b.finished_at ?? "9999"),
      ),
    [players],
  );
  const finishedCount = players.filter((p) => p.finished_at).length;
  const avgScore = players.length ? Math.round(players.reduce((s, p) => s + p.score, 0) / players.length) : 0;
  const accuracy = answers.length ? Math.round((answers.filter((a) => a.is_correct).length / answers.length) * 100) : 0;

  // ---- aksi ------------------------------------------------------------
  function toggleStatus() {
    const next = status === "open" ? "closed" : "open";
    if (next === "closed" && !confirm("Tutup sesi? Siswa tidak bisa bergabung atau menjawab lagi.")) return;
    startTransition(async () => {
      const res = await setSessionStatus(session.id, next);
      if (res.error) return alert(res.error);
      setStatus(next);
      if (res.pin) setPin(res.pin);
    });
  }

  async function kick(p: Player) {
    if (!confirm(`Keluarkan ${p.name} dari sesi? Semua jawabannya akan terhapus.`)) return;
    const { error } = await createClient().from("players").delete().eq("id", p.id);
    if (error) return alert(error.message);
    setPlayers((prev) => prev.filter((x) => x.id !== p.id));
    setAnswers((prev) => prev.filter((a) => a.player_id !== p.id));
    setDetail(null);
  }

  function onDelete() {
    if (!confirm("Hapus sesi ini beserta semua nilai siswanya? Tidak bisa dibatalkan.")) return;
    startTransition(async () => {
      await deleteSession(session.id);
    });
  }

  return (
    <div className="space-y-6">
      <Link href={`/guru/quiz/${session.quiz_id}`} className="text-sm font-bold text-muted hover:text-brand">
        ← Kembali ke quiz
      </Link>

      {/* Header sesi */}
      <div className="flex flex-wrap items-center gap-5 rounded-3xl bg-brand p-6 text-white">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <span className={`text-xs font-bold ${live ? "text-green-200" : "text-white/60"}`}>
              {live ? "● Live" : "○ Menyambung..."}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black">{quizTitle}</h1>
          <p className="text-sm font-semibold text-white/75">
            {new Date(session.created_at).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">PIN Game</p>
          <p className="text-5xl font-black tracking-widest">{status === "open" ? pin : "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setProjector(true)}
            disabled={status !== "open"}
            className="btn-3d rounded-xl bg-white px-4 py-2.5 font-extrabold text-brand disabled:opacity-50"
          >
            📺 Mode Proyektor
          </button>
          <button
            onClick={toggleStatus}
            disabled={pending}
            className="btn-3d rounded-xl bg-white/15 px-4 py-2.5 font-extrabold text-white"
          >
            {status === "open" ? "⏹ Tutup Sesi" : "▶ Buka Lagi"}
          </button>
          <button
            onClick={() => exportCsv(quizTitle, session, questions, ranked, answers)}
            className="btn-3d rounded-xl bg-white/15 px-4 py-2.5 font-extrabold text-white"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Siswa bergabung" value={players.length} />
        <StatCard label="Sudah selesai" value={`${finishedCount}/${players.length}`} />
        <StatCard label="Rata-rata poin" value={avgScore} />
        <StatCard label="Jawaban benar" value={`${accuracy}%`} />
      </div>

      {/* Tab */}
      <div className="flex gap-2">
        {(
          [
            ["rank", "🏆 Peringkat"],
            ["questions", "📊 Analisis Soal"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2 font-extrabold ${
              tab === key ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rank" ? (
        <Leaderboard ranked={ranked} total={total} onSelect={setDetail} />
      ) : (
        <QuestionStats questions={questions} answers={answers} />
      )}

      <button onClick={onDelete} disabled={pending} className="text-sm font-bold text-bad hover:underline">
        Hapus sesi ini
      </button>

      {detail && (
        <PlayerDetail
          player={players.find((p) => p.id === detail.id) ?? detail}
          rank={ranked.findIndex((p) => p.id === detail.id) + 1}
          questions={questions}
          answers={answers.filter((a) => a.player_id === detail.id)}
          onClose={() => setDetail(null)}
          onKick={kick}
        />
      )}

      {projector && (
        <ProjectorView
          pin={pin}
          joinUrl={joinUrl}
          quizTitle={quizTitle}
          ranked={ranked}
          total={total}
          finishedCount={finishedCount}
          onClose={() => setProjector(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-white p-4">
      <p className="text-3xl font-black">{value}</p>
      <p className="text-sm font-bold text-muted">{label}</p>
    </div>
  );
}

function Leaderboard({
  ranked,
  total,
  onSelect,
}: {
  ranked: Player[];
  total: number;
  onSelect: (p: Player) => void;
}) {
  if (ranked.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-line bg-white p-10 text-center font-semibold text-muted">
        Menunggu siswa bergabung... Tampilkan PIN atau Mode Proyektor ke kelas.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-line bg-white">
      <table className="w-full min-w-[640px] text-left">
        <thead className="border-b-2 border-line text-sm font-extrabold text-muted">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Nama</th>
            <th className="px-4 py-3">Poin</th>
            <th className="px-4 py-3">Progres</th>
            <th className="px-4 py-3">Benar</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p, i) => {
            const done = Math.min(p.current_index, total);
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className="cursor-pointer border-b border-line font-bold last:border-0 hover:bg-canvas"
              >
                <td className="px-4 py-3 text-lg">{medal(i + 1)}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 text-brand">{p.score}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-28 overflow-hidden rounded-full bg-canvas">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(done / total) * 100}%` }} />
                    </div>
                    <span className="text-sm text-muted">
                      {done}/{total}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">{p.correct_count}</td>
                <td className="px-4 py-3 text-sm">
                  {p.finished_at ? (
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-green-700">Selesai</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Mengerjakan</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionStats({ questions, answers }: { questions: Question[]; answers: Answer[] }) {
  return (
    <div className="space-y-3">
      {questions.map((q, i) => {
        const qa = answers.filter((a) => a.question_id === q.id);
        const correct = qa.filter((a) => a.is_correct).length;
        const pct = qa.length ? Math.round((correct / qa.length) * 100) : null;
        const timeouts = qa.filter((a) => a.choice_index === null).length;
        const avgTime = qa.length ? (qa.reduce((s, a) => s + a.time_ms, 0) / qa.length / 1000).toFixed(1) : "-";
        const img = imagePublicUrl(q.image_path);
        const tone = pct === null ? "bg-gray-100 text-gray-500" : pct >= 70 ? "bg-green-100 text-green-700" : pct >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

        return (
          <div key={q.id} className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-white p-4 sm:flex-row">
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-28 w-full shrink-0 rounded-xl bg-canvas object-contain sm:w-36" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                <span>Soal {i + 1}</span>
                <span className="rounded-full bg-canvas px-2 py-0.5">{typeLabel(q.type)}</span>
                <span>{qa.length} jawaban</span>
                <span>⏱ rata-rata {avgTime} dtk</span>
                {timeouts > 0 && <span>⏰ {timeouts} waktu habis</span>}
              </div>
              <p className="mt-1 font-extrabold">{q.prompt}</p>
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const n = qa.filter((a) => a.choice_index === oi).length;
                  const w = qa.length ? (n / qa.length) * 100 : 0;
                  return (
                    <div key={oi} className="flex items-center gap-2 text-sm font-bold">
                      <span className="w-40 truncate">
                        {oi === q.correct_index ? "✓ " : ""}
                        {answerLabel(q.type, opt)}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded-md bg-canvas">
                        <div
                          className={`h-full ${answerStyle(q.type, oi).color} ${oi === q.correct_index ? "" : "opacity-40"}`}
                          style={{ width: `${w}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-muted">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={`grid shrink-0 place-items-center rounded-2xl px-5 py-3 text-center ${tone}`}>
              <div>
                <p className="text-3xl font-black">{pct === null ? "–" : `${pct}%`}</p>
                <p className="text-xs font-bold">benar</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerDetail({
  player,
  rank,
  questions,
  answers,
  onClose,
  onKick,
}: {
  player: Player;
  rank: number;
  questions: Question[];
  answers: Answer[];
  onClose: () => void;
  onKick: (p: Player) => void;
}) {
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  const order = player.question_order?.length ? player.question_order : questions.map((q) => q.id);
  const qById = new Map(questions.map((q) => [q.id, q]));

  return (
    <Modal title={`${medal(rank)} ${player.name}`} onClose={onClose}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <StatCard label="Poin" value={player.score} />
        <StatCard label="Benar" value={`${player.correct_count}/${questions.length}`} />
        <StatCard label="Peringkat" value={`#${rank}`} />
      </div>
      <ol className="space-y-2">
        {order.map((qid, i) => {
          const q = qById.get(qid);
          if (!q) return null;
          const a = byQuestion.get(qid);
          return (
            <li key={qid} className="flex items-center gap-3 rounded-xl bg-canvas p-3 text-sm font-bold">
              <span className="text-lg">{!a ? "⬜" : a.is_correct ? "✅" : a.choice_index === null ? "⏰" : "❌"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {i + 1}. {q.prompt || typeLabel(q.type)}
                </p>
                <p className="font-semibold text-muted">
                  {!a
                    ? "Belum dijawab"
                    : a.choice_index === null
                      ? "Waktu habis"
                      : `Jawab: ${answerLabel(q.type, q.options[a.choice_index] ?? "?")}`}
                  {a && ` · ${(a.time_ms / 1000).toFixed(1)} dtk`}
                </p>
              </div>
              {a && <span className="text-brand">+{a.points_awarded}</span>}
            </li>
          );
        })}
      </ol>
      <button onClick={() => onKick(player)} className="mt-5 text-sm font-bold text-bad hover:underline">
        Keluarkan siswa ini
      </button>
    </Modal>
  );
}

function ProjectorView({
  pin,
  joinUrl,
  quizTitle,
  ranked,
  total,
  finishedCount,
  onClose,
}: {
  pin: string;
  joinUrl: string;
  quizTitle: string;
  ranked: Player[];
  total: number;
  finishedCount: number;
  onClose: () => void;
}) {
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (joinUrl) void QRCode.toDataURL(joinUrl, { margin: 1, width: 360 }).then(setQr);
  }, [joinUrl]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const host = joinUrl ? new URL(joinUrl).host : "";

  return (
    <div className="bg-play fixed inset-0 z-50 overflow-y-auto p-6 lg:p-10">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-white/15 px-4 py-2 font-bold hover:bg-white/25"
      >
        Tutup ✕
      </button>
      <div className="mx-auto grid h-full max-w-7xl items-center gap-10 lg:grid-cols-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-white/80">{quizTitle}</p>
          <p className="mt-6 text-xl font-bold">
            Buka <span className="rounded-lg bg-white px-2 py-0.5 text-brand">{host}</span> lalu masukkan PIN:
          </p>
          <p className="mt-3 text-8xl font-black tracking-[0.15em] drop-shadow-lg lg:text-9xl">{pin}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code untuk bergabung" className="mx-auto mt-6 size-56 rounded-2xl bg-white p-2" />
          )}
          <p className="mt-2 font-bold text-white/70">atau scan QR ini</p>
        </div>

        <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-3xl font-black">🏆 Papan Skor</h2>
            <p className="font-bold text-white/80">
              {ranked.length} siswa · {finishedCount} selesai
            </p>
          </div>
          {ranked.length === 0 ? (
            <p className="py-10 text-center text-xl font-bold text-white/70">Menunggu siswa bergabung...</p>
          ) : (
            <ol className="space-y-2">
              {ranked.slice(0, 10).map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-xl font-extrabold ${
                    i === 0 ? "bg-ans-2" : "bg-white/15"
                  } animate-rise`}
                >
                  <span className="w-10">{medal(i + 1)}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-base font-bold text-white/80">
                    {Math.min(p.current_index, total)}/{total}
                  </span>
                  <span className="w-24 text-right">{p.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

function exportCsv(quizTitle: string, session: Session, questions: Question[], ranked: Player[], answers: Answer[]) {
  const byPlayer = new Map<string, Map<string | null, Answer>>();
  for (const a of answers) {
    if (!byPlayer.has(a.player_id)) byPlayer.set(a.player_id, new Map());
    byPlayer.get(a.player_id)!.set(a.question_id, a);
  }

  const header = [
    "Peringkat",
    "Nama",
    "Poin",
    "Benar",
    "Total Soal",
    "Nilai (0-100)",
    "Status",
    ...questions.map((_, i) => `Soal ${i + 1}`),
  ];
  const rows = ranked.map((p, i) => {
    const pa = byPlayer.get(p.id);
    return [
      i + 1,
      p.name,
      p.score,
      p.correct_count,
      questions.length,
      questions.length ? Math.round((p.correct_count / questions.length) * 100) : 0,
      p.finished_at ? "Selesai" : "Belum selesai",
      ...questions.map((q) => {
        const a = pa?.get(q.id);
        if (!a) return "-";
        return a.is_correct ? "Benar" : a.choice_index === null ? "Waktu habis" : "Salah";
      }),
    ];
  });

  const esc = (v: unknown) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date(session.created_at).toISOString().slice(0, 10);
  a.href = url;
  a.download = `${quizTitle.replace(/[^\w\- ]+/g, "").trim() || "quiz"} - ${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
