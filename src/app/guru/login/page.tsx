"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email atau password salah." : error.message);
      setLoading(false);
      return;
    }
    router.replace("/guru");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-7 shadow-xl">
        <div className="text-center">
          <div className="text-4xl">🧑‍🏫</div>
          <h1 className="mt-2 text-2xl font-black">Panel Guru</h1>
          <p className="text-sm font-semibold text-muted">Kuis AI — Moklet Mengajar</p>
        </div>
        <label className="block">
          <span className="text-sm font-bold">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-line px-3 py-2.5 outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-line px-3 py-2.5 outline-none focus:border-brand"
          />
        </label>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-bad">{error}</p>}
        <button
          disabled={loading}
          className="btn-3d w-full rounded-xl bg-brand py-3 font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Masuk..." : "Masuk"}
        </button>
        <Link href="/" className="block text-center text-sm font-semibold text-muted hover:text-brand">
          ← Halaman siswa
        </Link>
      </form>
    </main>
  );
}
