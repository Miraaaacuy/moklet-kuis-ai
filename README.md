# 🤖 Kuis AI — Moklet Mengajar

Web quiz interaktif ala Wayground/Quizizz untuk materi **Kecerdasan Buatan (AI)** di SMP.

- Siswa bergabung pakai **PIN 6 angka + nama** (atau scan QR), tanpa daftar akun.
- Siswa mengerjakan **sendiri-sendiri** (self-paced) dari HP masing-masing.
- 3 tipe soal: **🖼️ AI atau Asli?** (tebak gambar), **🔠 Pilihan Ganda**, **✅ Benar/Salah**.
- **Poin**: jawaban benar dapat 500–1000 poin (makin cepat makin besar) + **bonus streak** 🔥 +100 per jawaban benar beruntun (maks +500).
- **Dashboard guru live**: peringkat, progres tiap siswa, analisis per soal (soal mana yang paling banyak "menipu"), detail jawaban per siswa, **Mode Proyektor** (PIN besar + QR + papan skor), **Export CSV**.
- Kunci jawaban **tidak pernah dikirim ke HP siswa** sebelum mereka menjawab, dan waktu dihitung di server — jadi susah dicurangi.

Dibuat dengan Next.js 15 + Supabase, siap deploy ke Vercel.

---

## 1. Siapkan Supabase (gratis)

1. Daftar di <https://supabase.com> → **New project** (pilih region Singapore biar cepat).
2. Buka **SQL Editor** → **New query** → salin seluruh isi [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Buka **Authentication → Users → Add user → Create new user**: isi email & password untuk akun guru. Centang *Auto Confirm User*.
4. **Penting:** buka **Authentication → Sign In / Providers** lalu **matikan "Allow new users to sign up"**, supaya orang lain tidak bisa membuat akun guru sendiri.
5. *(Opsional)* Jalankan [`supabase/seed.sql`](supabase/seed.sql) di SQL Editor untuk mendapat contoh quiz "Kenalan dengan AI" berisi 10 soal.
6. Buka **Project Settings → API Keys**, catat:
   - Project URL
   - `anon` / *publishable* key
   - `service_role` / *secret* key (**rahasia!** jangan dibagikan)

## 2. Jalankan di komputer sendiri

```bash
cp .env.example .env.local   # lalu isi 3 nilai dari langkah 1.6
npm install
npm run dev
```

- Halaman siswa: <http://localhost:3000>
- Panel guru: <http://localhost:3000/guru>

> Untuk mencoba dari HP di jaringan wifi yang sama, buka `http://<IP-laptop>:3000`.

## 3. Deploy ke Vercel

1. Upload project ini ke GitHub (repo boleh private).
2. Di <https://vercel.com> → **Add New → Project** → pilih repo-nya.
3. Di **Environment Variables**, isi 3 variabel yang sama dengan `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Deploy**. Selesai — bagikan link-nya ke siswa (atau tampilkan Mode Proyektor).

---

## Cara pakai saat mengajar

1. Login di `/guru` → **Buat** quiz → tambah soal.
   - Untuk soal tebak gambar, pakai tombol **"+ 🖼️ Banyak Gambar"**: pilih banyak gambar sekaligus, tandai masing-masing 🤖 AI atau 📷 Asli, simpan. Gambar besar otomatis diperkecil supaya cepat dibuka di wifi sekolah.
   - Isi **penjelasan** — muncul ke siswa setelah menjawab (misal "lihat jarinya ada 6").
2. Tekan **▶ Mulai Sesi** (centang "Acak urutan soal" supaya siswa tidak menyontek teman sebangku).
3. Klik **📺 Mode Proyektor** dan tampilkan ke kelas. Siswa buka web, masukkan PIN atau scan QR.
4. Pantau peringkat & progres secara live. Tab **📊 Analisis Soal** cocok untuk pembahasan setelah quiz.
5. Selesai → **⏹ Tutup Sesi** → **⬇ Export CSV** untuk rekap nilai (bisa dibuka di Excel / Google Sheets).

### Tips mencari gambar "AI atau Asli"
- Gambar AI: buat sendiri pakai generator gambar AI, atau ambil dari galeri komunitas generator AI.
- Foto asli: foto sendiri, atau dari situs foto gratis seperti Unsplash / Pexels.
- Pilih pasangan yang mirip (misal sama-sama potret orang, pemandangan, makanan) supaya menantang.

### Kalau ada siswa yang HP-nya mati / ter-refresh
Buka lagi web-nya di HP yang sama → muncul tombol **"Lanjutkan sebagai …"**. Progres & poin tetap tersimpan. Timer soal tetap berjalan selama siswa pergi, jadi refresh tidak bisa dipakai untuk menambah waktu.

---

## Struktur project

```
supabase/schema.sql        tabel, keamanan (RLS), storage gambar, realtime
supabase/seed.sql          contoh quiz
src/app/page.tsx           halaman join siswa (PIN + nama)
src/app/play/              layar main siswa + server actions (skor dihitung di server)
src/app/guru/              login, daftar quiz, editor soal, dashboard sesi
src/lib/scoring.ts         rumus poin
```

Rumus poin bisa diubah di `src/lib/scoring.ts`.
