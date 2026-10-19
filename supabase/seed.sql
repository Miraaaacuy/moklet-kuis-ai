-- =====================================================================
-- Contoh quiz "Kenalan dengan AI" (opsional)
-- Jalankan SETELAH schema.sql dan SETELAH membuat akun guru di
-- Authentication → Users. Quiz akan dimiliki akun guru pertama.
-- Soal "AI atau Asli" tidak disertakan karena butuh gambar —
-- tambahkan sendiri lewat panel guru.
-- =====================================================================

do $$
declare
  guru uuid := (select id from auth.users order by created_at limit 1);
  qz   uuid;
begin
  if guru is null then
    raise exception 'Belum ada akun guru. Buat dulu di Authentication → Users.';
  end if;

  insert into public.quizzes (owner_id, title, description)
  values (guru, 'Kenalan dengan AI', 'Quiz pemanasan tentang dasar-dasar Kecerdasan Buatan')
  returning id into qz;

  insert into public.questions (quiz_id, position, type, prompt, options, correct_index, time_limit_sec, explanation) values
  (qz, 1, 'multiple_choice', 'Apa kepanjangan dari AI?',
    '["Artificial Intelligence", "Automatic Internet", "Android Interface", "Advanced Information"]', 0, 15,
    'AI = Artificial Intelligence, dalam bahasa Indonesia disebut Kecerdasan Buatan.'),
  (qz, 2, 'true_false', 'ChatGPT adalah contoh AI generatif yang bisa membuat teks.',
    '["Benar", "Salah"]', 0, 15,
    'Benar! AI generatif bisa membuat konten baru: teks, gambar, musik, bahkan video.'),
  (qz, 3, 'multiple_choice', 'Manakah yang BUKAN contoh penerapan AI?',
    '["Rekomendasi video YouTube", "Face unlock di HP", "Kalkulator biasa", "Google Translate"]', 2, 20,
    'Kalkulator biasa hanya menjalankan rumus tetap, tidak belajar dari data.'),
  (qz, 4, 'multiple_choice', 'AI menjadi pintar karena belajar dari...',
    '["Data", "Listrik saja", "Mimpi", "Kebetulan"]', 0, 15,
    'AI dilatih memakai data dalam jumlah sangat besar untuk mengenali pola.'),
  (qz, 5, 'true_false', 'Jawaban AI selalu benar, jadi tidak perlu dicek lagi.',
    '["Benar", "Salah"]', 1, 15,
    'Salah! AI bisa keliru, jadi selalu cek ulang ke sumber terpercaya.'),
  (qz, 6, 'multiple_choice', 'Istilah ketika AI memberi jawaban yang terdengar meyakinkan tapi ternyata salah adalah...',
    '["Halusinasi", "Hibernasi", "Kompilasi", "Animasi"]', 0, 20,
    'Disebut "halusinasi AI" — AI mengarang informasi yang tidak ada.'),
  (qz, 7, 'multiple_choice', 'Ciri yang sering muncul pada gambar buatan AI adalah...',
    '["Jari tangan aneh atau jumlahnya salah", "Ada tanggal di pojok foto", "Gambarnya berwarna", "Ukuran filenya besar"]', 0, 20,
    'Perhatikan detail kecil: jari, gigi, telinga, tulisan, dan latar belakang yang janggal.'),
  (qz, 8, 'multiple_choice', 'Deepfake adalah...',
    '["Video/gambar palsu wajah seseorang yang dibuat AI", "Ikan dari laut dalam", "Jenis virus komputer", "Aplikasi edit foto biasa"]', 0, 20,
    'Deepfake bisa dipakai untuk menipu, jadi jangan mudah percaya video viral.'),
  (qz, 9, 'true_false', 'Kita boleh memasukkan password atau data pribadi ke chatbot AI.',
    '["Benar", "Salah"]', 1, 15,
    'Jangan pernah membagikan password, alamat rumah, atau data pribadi ke chatbot.'),
  (qz, 10, 'multiple_choice', 'Sikap yang tepat saat memakai AI untuk tugas sekolah adalah...',
    '["Copy-paste semua jawaban AI", "Memakai AI untuk belajar lalu mengecek ulang hasilnya", "Tidak usah belajar lagi", "Mengaku hasil AI sebagai karya sendiri"]', 1, 20,
    'AI adalah alat bantu belajar, bukan pengganti berpikir. Tetap jujur ya!');
end $$;
