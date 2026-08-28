# Sistem Kupon QR Online

Aplikasi Vite + Supabase untuk:
- Admin membuat kupon.
- Blok yang diizinkan dapat diatur (default B3, B4, B5, B7).
- Satu kombinasi blok + nomor rumah hanya boleh memiliki satu kupon.
- Penerima membuka link `/k/KODE_TOKEN` untuk melihat QR.
- Panitia membuka `/scanner` dan scan QR.
- QR hanya dapat dipakai satu kali.
- Data tersimpan di database Supabase sehingga perangkat berbeda tetap sinkron.

## 1. Buat database Supabase

Buka Supabase > SQL Editor > New query.
Copy seluruh isi `supabase/schema.sql`, lalu Run.

SQL tersebut membuat tabel, fungsi, trigger, index, dan Row Level Security.

## 2. Buat akun admin/panitia

Di Supabase > Authentication > Users > Add user, buat akun email/password.
Akun yang login dapat membuka halaman Admin dan Scanner.

Catatan: pada versi ini, semua akun yang berhasil login dianggap sebagai operator (Admin/Panitia). Jika nanti ingin membedakan role Admin dan Panitia, tambahkan role pada profile.

## 3. Konfigurasi lokal

Copy `.env.example` menjadi `.env`:

VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

Nilai dapat dilihat di Supabase Project Settings > API.

## 4. Jalankan

npm install
npm run dev

Buka alamat yang diberikan Vite.

## 5. Deploy ke Vercel

Upload project ini ke GitHub, lalu import repository tersebut di Vercel.
Tambahkan Environment Variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Deploy.

## 6. HTTPS dan kamera

Scanner membutuhkan akses kamera. Vercel sudah menggunakan HTTPS, sehingga kamera HP dapat digunakan setelah pengguna memberi izin.

## Keamanan

- Jangan masukkan database password/service_role key ke frontend.
- Gunakan hanya publishable/anon key.
- RLS pada SQL membatasi akses.
- Validasi satu alamat dilakukan di database dengan unique index.
- Fungsi redeem kupon dibuat atomic sehingga kupon yang sama tidak mudah berhasil dua kali ketika discan bersamaan.

## URL setelah deploy

Penerima:
https://DOMAIN/k/TOKEN

Admin:
https://DOMAIN/admin

Scanner:
https://DOMAIN/scanner
