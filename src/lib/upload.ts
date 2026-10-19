"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareImage } from "./image";
import { IMAGE_BUCKET } from "./questions";

export const MAX_UPLOAD_MB = 10;

/** Unggah gambar soal dengan nama acak (supaya nama file tidak membocorkan jawaban). */
export async function uploadQuestionImage(supabase: SupabaseClient, quizId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`Ukuran gambar maksimal ${MAX_UPLOAD_MB} MB.`);

  const { blob, ext, contentType } = await prepareImage(file);
  const path = `${quizId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("Gagal mengunggah gambar: " + error.message);
  return path;
}
