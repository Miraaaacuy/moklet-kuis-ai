export type QuestionType = "ai_or_real" | "multiple_choice" | "true_false";

export interface Quiz {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  image_path: string | null;
  options: string[];
  correct_index: number;
  time_limit_sec: number;
  points: number;
  explanation: string;
}

export interface Session {
  id: string;
  quiz_id: string;
  owner_id: string;
  pin: string;
  status: "open" | "closed";
  shuffle: boolean;
  question_ids: string[];
  created_at: string;
}

export interface Player {
  id: string;
  session_id: string;
  name: string;
  current_index: number;
  current_started_at: string | null;
  score: number;
  correct_count: number;
  streak: number;
  finished_at: string | null;
  joined_at: string;
  question_order: string[];
}

export interface Answer {
  id: string;
  player_id: string;
  session_id: string;
  question_id: string | null;
  choice_index: number | null;
  is_correct: boolean;
  points_awarded: number;
  time_ms: number;
  created_at: string;
}

/** Soal yang dikirim ke siswa — TANPA kunci jawaban & penjelasan. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  options: string[];
  timeLimitSec: number;
  points: number;
}
