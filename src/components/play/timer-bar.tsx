"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Sisa waktu dari server saat soal diterima. */
  remainingMs: number;
  totalMs: number;
  paused: boolean;
  onExpire: () => void;
}

export function TimerBar({ remainingMs, totalMs, paused, onExpire }: Props) {
  const deadline = useRef(performance.now() + remainingMs);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const ms = Math.max(0, deadline.current - performance.now());
      setLeft(ms);
      if (ms === 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [paused]);

  const pct = Math.max(0, Math.min(100, (left / totalMs) * 100));
  const seconds = Math.ceil(left / 1000);
  const urgent = seconds <= 5;

  return (
    <div className="flex items-center gap-3" aria-label={`Sisa waktu ${seconds} detik`}>
      <div
        className={`grid size-12 shrink-0 place-items-center rounded-full text-xl font-black ${
          urgent ? "bg-ans-0 text-white animate-pulse" : "bg-white text-brand"
        }`}
      >
        {seconds}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/25">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? "bg-ans-0" : "bg-white"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
