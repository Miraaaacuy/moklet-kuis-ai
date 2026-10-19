"use client";

const MAX_SIDE = 1600;
const MAX_BYTES_UNTOUCHED = 1.5 * 1024 * 1024;

/**
 * Perkecil gambar besar sebelum diunggah supaya cepat dibuka 30+ HP siswa
 * sekaligus di wifi sekolah. Gambar kecil dibiarkan apa adanya.
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; ext: string; contentType: string }> {
  const original = { blob: file, ext: extOf(file), contentType: file.type || "image/jpeg" };
  if (file.type === "image/gif" || file.type === "image/svg+xml") return original;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return original;
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES_UNTOUCHED) {
    bitmap.close();
    return original;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") {
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return jpeg ? { blob: jpeg, ext: "jpg", contentType: "image/jpeg" } : original;
  }
  return { blob, ext: "webp", contentType: "image/webp" };
}

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName && fromName.length <= 5 ? fromName : "jpg";
}
