/** Toleransi jeda jaringan sebelum jawaban dianggap terlambat. */
export const NETWORK_GRACE_MS = 2000;
export const STREAK_BONUS = 100;
export const MAX_STREAK_BONUS = 500;

export interface ScoreInput {
  correct: boolean;
  basePoints: number;
  timeLimitSec: number;
  elapsedMs: number;
  /** Jumlah jawaban benar berturut-turut SEBELUM soal ini. */
  previousStreak: number;
}

export interface ScoreResult {
  points: number;
  speedPoints: number;
  streakBonus: number;
  newStreak: number;
  timedOut: boolean;
}

/**
 * Benar: 50%–100% dari poin soal, makin cepat makin besar,
 * ditambah bonus streak +100 per jawaban benar beruntun (maks +500).
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  const limitMs = input.timeLimitSec * 1000;
  const timedOut = input.elapsedMs > limitMs + NETWORK_GRACE_MS;

  if (!input.correct || timedOut) {
    return { points: 0, speedPoints: 0, streakBonus: 0, newStreak: 0, timedOut };
  }

  const remaining = Math.max(0, limitMs - input.elapsedMs) / limitMs;
  const speedPoints = Math.round(input.basePoints * (0.5 + 0.5 * remaining));
  const newStreak = input.previousStreak + 1;
  const streakBonus = Math.min((newStreak - 1) * STREAK_BONUS, MAX_STREAK_BONUS);

  return { points: speedPoints + streakBonus, speedPoints, streakBonus, newStreak, timedOut };
}
