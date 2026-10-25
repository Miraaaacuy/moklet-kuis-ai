"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { joinSession } from "./play/actions";
import { loadLastPlayer, savePlayer, type StoredPlayer } from "@/lib/player-storage";

export default function JoinPage() {
  const router = useRouter();
  const [step, setStep] = useState<"pin" | "name">("pin");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [last, setLast] = useState<StoredPlayer | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLast(loadLastPlayer());
    const fromUrl = new URLSearchParams(window.location.search).get("pin")?.replace(/\D/g, "").slice(0, 6);
    if (fromUrl && fromUrl.length === 6) {
      setPin(fromUrl);
      setStep("name");
    }
  }, []);

  useEffect(() => {
    if (step === "name") nameRef.current?.focus();
  }, [step]);

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) {
      setError("PIN harus 6 angka.");
      return;
    }
    setError("");
    setStep("name");
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await joinSession(pin, name);
      if (!res.ok) {
        setError(res.error);
        if (res.error.startsWith("PIN")) setStep("pin");
        return;
      }
      savePlayer(res.data);
      router.push(`/play/${res.data.sessionId}`);
    });
  }

  return (
    <main className="bg-play flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center animate-rise">
        <div className="text-6xl" aria-hidden>
          🤖✨
        </div>
        <h1 className="mt-3 text-5xl font-black tracking-tight drop-shadow">Kuis AI</h1>
        <p className="mt-2 text-lg font-semibold text-white/80">Moklet Mengajar</p>
      </div>

      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-ink shadow-2xl animate-pop">
        {step === "pin" ? (
          <form onSubmit={submitPin} className="space-y-4">
            <label htmlFor="pin" className="block text-center text-lg font-extrabold">
              Masukkan PIN Game
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="000000"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-2xl border-2 border-line bg-canvas px-4 py-4 text-center text-4xl font-black tracking-[0.3em] outline-none focus:border-brand"
            />
            <button type="submit" className="btn-3d w-full rounded-2xl bg-brand py-4 text-xl font-extrabold text-white">
              Lanjut
            </button>
          </form>
        ) : (
          <form onSubmit={submitName} className="space-y-4">
            <div className="flex items-center justify-between text-sm font-bold text-muted">
              <button type="button" onClick={() => setStep("pin")} className="hover:text-brand">
                ← Ganti PIN
              </button>
              <span>PIN {pin}</span>
            </div>
            <label htmlFor="name" className="block text-center text-lg font-extrabold">
              Siapa namamu?
            </label>
            <input
              id="name"
              ref={nameRef}
              autoComplete="off"
              maxLength={24}
              placeholder="Nama / panggilan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border-2 border-line bg-canvas px-4 py-4 text-center text-2xl font-extrabold outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={pending || name.trim().length < 2}
              className="btn-3d w-full rounded-2xl bg-ans-3 py-4 text-xl font-extrabold text-white disabled:opacity-50"
            >
              {pending ? "Masuk..." : "Ayo Main! 🚀"}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center font-bold text-bad animate-shake">
            {error}
          </p>
        )}
      </div>

      {last && (
        <button
          onClick={() => router.push(`/play/${last.sessionId}`)}
          className="mt-6 rounded-full bg-white/15 px-5 py-2 font-bold text-white hover:bg-white/25"
        >
          Lanjutkan sebagai {last.name} →
        </button>
      )}

      <Link href="/guru" className="mt-10 text-sm font-semibold text-white/60 hover:text-white">
        Masuk sebagai guru
      </Link>
    </main>
  );
}
