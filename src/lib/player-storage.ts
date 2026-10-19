"use client";

export interface StoredPlayer {
  sessionId: string;
  playerId: string;
  token: string;
  name: string;
}

const LAST_KEY = "kuis:last";
const key = (sessionId: string) => `kuis:player:${sessionId}`;

// localStorage bisa diblokir (mode privat dsb.), jadi semua akses dibungkus try/catch.

export function savePlayer(p: StoredPlayer) {
  try {
    localStorage.setItem(key(p.sessionId), JSON.stringify(p));
    localStorage.setItem(LAST_KEY, p.sessionId);
  } catch {}
}

export function loadPlayer(sessionId: string): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(key(sessionId));
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}

export function loadLastPlayer(): StoredPlayer | null {
  try {
    const sessionId = localStorage.getItem(LAST_KEY);
    return sessionId ? loadPlayer(sessionId) : null;
  } catch {
    return null;
  }
}

export function clearPlayer(sessionId: string) {
  try {
    localStorage.removeItem(key(sessionId));
    if (localStorage.getItem(LAST_KEY) === sessionId) localStorage.removeItem(LAST_KEY);
  } catch {}
}
