"use client";

import confetti from "canvas-confetti";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPlayState, submitAnswer, type AnswerFeedback, type PlayState } from "../actions";
import { clearPlayer, loadPlayer, type StoredPlayer } from "@/lib/player-storage";
import { answerLabel, answerStyle } from "@/components/play/answer-style";
import { TimerBar } from "@/components/play/timer-bar";

type QuestionState = Extract<PlayState, { status: "question" }>;

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "state"; state: PlayState }
  | { kind: "feedback"; question: QuestionState; feedback: AnswerFeedback };

export function PlayClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });

  const load = useCallback(
    async (p: StoredPlayer, start: boolean) => {
      setView({ kind: "loading" });
      try {
        const res = await getPlayState(p.playerId, p.token, start);
        if (!res.ok) {
          if (res.code === "not_found") {
            clearPlayer(sessionId);
            router.replace("/");
            return;
          }
          setView({ kind: "error", message: res.error });
          return;
        }
        setView({ kind: "state", state: res.data });
      } catch {
        setView({ kind: "error", message: "Koneksi terputus. Cek internet lalu coba lagi." });
      }
    },
    [router, sessionId],
  );

  useEffect(() => {
    const p = loadPlayer(sessionId);
    if (!p) {
      router.replace("/");
      return;
    }
    setPlayer(p);
    void load(p, false);
  }, [sessionId, router, load]);

  if (!player || view.kind === "loading") {
    return (
      <Shell>
        <div className="m-auto text-center">
          <div className="mx-auto size-14 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="mt-4 font-bold text-white/80">Memuat...</p>
        </div>
      </Shell>
    );
  }

  if (view.kind === "error") {
    return (
      <Shell>
        <div className="m-auto w-full max-w-sm rounded-3xl bg-white p-6 text-center text-ink">
          <div className="text-5xl">😵</div>
          <p className="mt-3 text-lg font-bold">{view.message}</p>
          <button
            onClick={() => load(player, false)}
            className="btn-3d mt-5 w-full rounded-2xl bg-brand py-3 font-extrabold text-white"
          >
            Coba Lagi
          </button>
        </div>
      </Shell>
    );
  }

  if (view.kind === "feedback") {
    return (
      <FeedbackScreen
        question={view.question}
        feedback={view.feedback}
        onNext={() => load(player, !view.feedback.isLast)}
      />
    );
  }

  const state = view.state;
  switch (state.status) {
    case "ready":
      return <ReadyScreen state={state} onStart={() => load(player, true)} />;
    case "question":
      return (
        <QuestionScreen
          key={state.question.id}
          state={state}
          onAnswered={(feedback) => setView({ kind: "feedback", question: state, feedback })}
          onSubmit={(choice) => submitAnswer(player.playerId, player.token, state.question.id, choice)}
          onStale={() => load(player, false)}
        />
      );
    default:
      return <ResultScreen state={state} />;
  }
}

// ---------------------------------------------------------------------

function Shell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`bg-play flex min-h-dvh flex-col px-4 py-5 ${className}`}>{children}</main>;
}

function ReadyScreen({ state, onStart }: { state: Extract<PlayState, { status: "ready" }>; onStart: () => void }) {
  const resuming = state.index > 0;
  return (
    <Shell>
      <div className="m-auto w-full max-w-md text-center animate-rise">
        <p className="text-lg font-bold text-white/70">Halo,</p>
        <h1 className="text-4xl font-black">{state.name} 👋</h1>
        <div className="mt-6 rounded-3xl bg-white/10 p-5">
          <p className="text-sm font-bold uppercase tracking-wider text-white/60">Quiz</p>
          <p className="mt-1 text-2xl font-extrabold">{state.quizTitle}</p>
          <p className="mt-3 font-semibold text-white/80">
            {resuming ? `Lanjut dari soal ${state.index + 1} dari ${state.total}` : `${state.total} soal`}
            {resuming && ` · ${state.score} poin`}
          </p>
        </div>
        <ul className="mt-5 space-y-1 text-left text-sm font-semibold text-white/80">
          <li>⚡ Jawab lebih cepat = poin lebih besar</li>
          <li>🔥 Benar beruntun = bonus streak</li>
          <li>⏱️ Timer berjalan terus walau halaman di-refresh</li>
        </ul>
        <button
          onClick={onStart}
          className="btn-3d mt-8 w-full rounded-2xl bg-white py-5 text-2xl font-black text-brand"
        >
          {resuming ? "Lanjutkan ▶" : "Mulai! ▶"}
        </button>
      </div>
    </Shell>
  );
}

function QuestionScreen({
  state,
  onSubmit,
  onAnswered,
  onStale,
}: {
  state: QuestionState;
  onSubmit: (choice: number | null) => ReturnType<typeof submitAnswer>;
  onAnswered: (f: AnswerFeedback) => void;
  onStale: () => void;
}) {
  const { question } = state;
  const [chosen, setChosen] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const sent = useRef(false);

  const send = useCallback(
    async (choice: number | null) => {
      if (sent.current) return;
      sent.current = true;
      setChosen(choice);
      setSending(true);
      setError("");
      try {
        const res = await onSubmit(choice);
        if (res.ok) {
          onAnswered(res.data);
        } else if (res.code === "stale" || res.code === "closed") {
          onStale();
        } else {
          throw new Error(res.error);
        }
      } catch {
        sent.current = false;
        setSending(false);
        setChosen(null);
        setError("Gagal mengirim jawaban. Coba tekan lagi.");
      }
    },
    [onSubmit, onAnswered, onStale],
  );

  const isImage = Boolean(question.imageUrl);
  const twoOptions = question.options.length <= 2;

  return (
    <Shell className="gap-4">
      <header className="flex items-center justify-between text-sm font-extrabold">
        <span className="rounded-full bg-white/15 px-3 py-1">
          {state.index + 1} / {state.total}
        </span>
        <span className="flex items-center gap-2">
          {state.streak >= 2 && <span className="rounded-full bg-ans-2 px-3 py-1">🔥 {state.streak}</span>}
          <span className="rounded-full bg-white px-3 py-1 text-brand">{state.score} poin</span>
        </span>
      </header>

      <TimerBar
        remainingMs={state.remainingMs}
        totalMs={question.timeLimitSec * 1000}
        paused={sending}
        onExpire={() => send(null)}
      />

      <section className="flex flex-1 flex-col items-center justify-center gap-4 animate-rise">
        {isImage && (
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="relative overflow-hidden rounded-2xl bg-black/30 shadow-xl"
            aria-label="Perbesar gambar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={question.imageUrl!}
              alt="Gambar soal"
              className="max-h-[42dvh] w-auto max-w-full object-contain"
              draggable={false}
            />
            <span className="absolute right-2 bottom-2 rounded-full bg-black/50 px-2 py-1 text-xs font-bold">
              🔍 Perbesar
            </span>
          </button>
        )}
        <h2
          className={`max-w-2xl rounded-2xl bg-white px-5 py-4 text-center font-extrabold text-ink shadow-lg ${
            isImage ? "text-xl" : "text-2xl sm:text-3xl"
          }`}
        >
          {question.prompt || (question.type === "ai_or_real" ? "Gambar ini dibuat AI atau foto asli?" : "")}
        </h2>
      </section>

      <div className={`grid gap-3 ${twoOptions ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {question.options.map((opt, i) => {
          const { color, icon } = answerStyle(question.type, i);
          const dimmed = chosen !== null && chosen !== i;
          return (
            <button
              key={i}
              disabled={sending}
              onClick={() => send(i)}
              className={`btn-3d flex min-h-20 items-center gap-3 rounded-2xl px-4 py-4 text-left text-lg font-extrabold text-white ${color} ${
                twoOptions ? "min-h-32 flex-col justify-center text-center text-xl" : ""
              } ${dimmed ? "opacity-40" : ""} ${chosen === i ? "ring-4 ring-white" : ""}`}
            >
              <span className={twoOptions ? "text-4xl" : "text-2xl"} aria-hidden>
                {icon}
              </span>
              <span className="break-words">{answerLabel(question.type, opt)}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="rounded-xl bg-white p-3 text-center font-bold text-bad animate-shake">{error}</p>}
      {sending && <p className="text-center font-bold text-white/80">Mengirim jawaban...</p>}

      {zoom && isImage && (
        <div
          role="dialog"
          aria-modal
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl!} alt="Gambar soal diperbesar" className="max-h-full max-w-full object-contain" />
          <span className="absolute top-4 right-4 rounded-full bg-white/20 px-3 py-1 font-bold">Tutup ✕</span>
        </div>
      )}
    </Shell>
  );
}

function FeedbackScreen({
  question,
  feedback,
  onNext,
}: {
  question: QuestionState;
  feedback: AnswerFeedback;
  onNext: () => void;
}) {
  useEffect(() => {
    if (feedback.correct) {
      void confetti({ particleCount: 80, spread: 80, origin: { y: 0.35 }, disableForReducedMotion: true });
    }
  }, [feedback.correct]);

  // Unduh gambar soal berikutnya selagi siswa membaca penjelasan.
  useEffect(() => {
    if (feedback.nextImageUrl) new Image().src = feedback.nextImageUrl;
  }, [feedback.nextImageUrl]);

  const q = question.question;
  const title = feedback.correct ? "Benar! 🎉" : feedback.timedOut ? "Waktu Habis ⏰" : "Kurang Tepat 😅";
  const bg = feedback.correct ? "bg-good" : "bg-bad";

  return (
    <main className={`flex min-h-dvh flex-col px-4 py-6 text-white ${bg}`}>
      <div className="m-auto w-full max-w-md text-center">
        <h1 className={`text-5xl font-black ${feedback.correct ? "animate-pop" : "animate-shake"}`}>{title}</h1>

        <div className="mt-4 text-3xl font-black animate-rise">+{feedback.points} poin</div>
        {feedback.correct && (
          <p className="mt-1 font-bold text-white/85">
            ⚡ Kecepatan {feedback.speedPoints}
            {feedback.streakBonus > 0 && ` · 🔥 Streak ${feedback.streak} (+${feedback.streakBonus})`}
          </p>
        )}

        <div className="mt-6 rounded-3xl bg-white p-5 text-left text-ink shadow-xl animate-rise">
          <p className="text-sm font-bold text-muted">Jawaban yang benar</p>
          <p className="mt-1 text-xl font-extrabold">
            {answerStyle(q.type, feedback.correctIndex).icon} {answerLabel(q.type, q.options[feedback.correctIndex])}
          </p>
          {!feedback.correct && feedback.chosenIndex !== null && (
            <p className="mt-2 text-sm font-semibold text-muted">
              Jawabanmu: {answerLabel(q.type, q.options[feedback.chosenIndex])}
            </p>
          )}
          {feedback.explanation && (
            <p className="mt-4 rounded-2xl bg-brand-soft p-4 font-semibold leading-relaxed">💡 {feedback.explanation}</p>
          )}
        </div>

        <p className="mt-5 font-extrabold">Total: {feedback.score} poin</p>

        <button
          onClick={onNext}
          className="btn-3d mt-5 w-full rounded-2xl bg-white py-4 text-xl font-black text-ink"
        >
          {feedback.isLast ? "Lihat Hasil 🏆" : "Soal Berikutnya ▶"}
        </button>
      </div>
    </main>
  );
}

function ResultScreen({ state }: { state: Extract<PlayState, { status: "finished" | "closed" }> }) {
  useEffect(() => {
    if (state.status === "finished" && state.rank <= 3) {
      const end = Date.now() + 1500;
      const frame = () => {
        void confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, disableForReducedMotion: true });
        void confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, disableForReducedMotion: true });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [state.status, state.rank]);

  const medal = state.rank === 1 ? "🥇" : state.rank === 2 ? "🥈" : state.rank === 3 ? "🥉" : "🏅";

  return (
    <Shell>
      <div className="m-auto w-full max-w-md text-center animate-rise">
        {state.status === "closed" && (
          <p className="mb-4 rounded-2xl bg-white/15 p-3 font-bold">Sesi sudah ditutup oleh guru.</p>
        )}
        <div className="text-7xl animate-pop">{medal}</div>
        <h1 className="mt-2 text-3xl font-black">{state.status === "finished" ? "Selesai!" : "Hasil Kamu"}</h1>
        <p className="mt-1 font-bold text-white/80">{state.name}</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Poin" value={state.score} />
          <Stat label="Peringkat" value={`#${state.rank}`} sub={`dari ${state.playerCount}`} />
          <Stat label="Benar" value={`${state.correctCount}/${state.total}`} />
        </div>

        <div className="mt-6 rounded-3xl bg-white p-4 text-left text-ink shadow-xl">
          <p className="mb-2 text-center text-sm font-extrabold uppercase tracking-wider text-muted">Papan Skor</p>
          <ol className="space-y-1">
            {state.top.map((p, i) => (
              <li
                key={i}
                className={`flex items-center justify-between rounded-xl px-3 py-2 font-bold ${
                  p.isMe ? "bg-brand text-white" : "bg-canvas"
                }`}
              >
                <span>
                  {i + 1}. {p.name}
                </span>
                <span>{p.score}</span>
              </li>
            ))}
          </ol>
          {state.status === "finished" && (
            <p className="mt-2 text-center text-sm font-semibold text-muted">
              Peringkat bisa berubah sampai semua teman selesai.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold uppercase text-white/70">{label}</div>
      {sub && <div className="text-xs font-semibold text-white/60">{sub}</div>}
    </div>
  );
}
