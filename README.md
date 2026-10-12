# Grafio

AI-powered analytics workspace untuk data tabular. Upload CSV/JSON → AI baca konteks
→ wizard cleaning interaktif → analisis + chart + kesimpulan dengan bahasa awam +
chat Q&A. Project bisa di-save dan dibuka kembali.

## Local development

```bash
npm install
cp .env.local.example .env.local
# Isi env vars (lihat di bawah)
npm run dev
```

App jalan di http://localhost:3000

## Setup Supabase (login + project save)

Tanpa Supabase, login/signup dan project history akan tidak aktif (UI tetap
tampil tapi nunjukin pesan setup). Setup gratis ~5 menit:

1. **Buat project Supabase**
   - Buka https://supabase.com → sign up gratis
   - "New project" → pilih region terdekat (Singapore untuk Indonesia)
   - Tunggu provisioning ~1 menit

2. **Run SQL schema**
   - Di Supabase dashboard: **SQL Editor** → **New query**
   - Buka file `supabase/schema.sql` di repo ini → copy-paste ke editor → **Run**
   - Bikin 2 tabel (`profiles`, `projects`) + trigger auto-create profile + RLS policies
   - Lalu jalankan `supabase/quiz_schema.sql` (fitur kuis)
   - **Database lama (dibuat sebelum Okt 2026)?** Jalankan juga, berurutan:
     `supabase/patches/2026-07-15-plan-whitelist.sql` lalu
     `supabase/patches/2026-10-12-security-audit.sql` — patch idempoten,
     aman diulang. Query verifikasi ada di header file patch.

3. **Copy credentials**
   - **Settings** → **API**
   - Copy **Project URL** → ke env `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → ke env `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. **(Recommended dev) Matikan email confirmation**
   - **Authentication** → **Providers** → **Email**
   - Uncheck "Confirm email" — supaya user bisa langsung login setelah signup
     tanpa harus klik link verifikasi. Aktifkan lagi kalau sudah production.

5. **Set env vars di Vercel**
   - Project dashboard di Vercel → Settings → Environment Variables
   - Tambahkan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Untuk cron kuis: `SUPABASE_SERVICE_ROLE_KEY` dan `CRON_SECRET`
     (service role key JANGAN pernah diberi prefix `NEXT_PUBLIC_`)
   - Opsional: `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_SITE_URL`
   - Redeploy

### Security model

- RLS (Row Level Security) aktif untuk `profiles`, `projects`, `quizzes`, `quiz_attempts`
- RLS membatasi **baris**, bukan kolom — karena itu hak UPDATE `profiles`
  dibatasi per kolom (`name`, `phone`, `social_media`). `plan`, `credits`,
  `trial_ends_at` hanya bisa diubah service role / admin.
- Kuis hanya diakses lewat fungsi `SECURITY DEFINER` (`list_week_quizzes`,
  `get_quiz_public`, `submit_quiz`) yang memakai `auth.uid()`; kunci jawaban
  tidak pernah dikirim sebelum submit; `award_quiz_credits` hanya service role.
- `anon` key aman untuk di-expose ke client **selama** RLS + grant di atas benar
- Route AI: wajib login → batas ukuran body → validasi/sanitasi → rate limit
  (lihat `lib/server/aiGuard.ts`, `lib/server/aiSanitize.ts`)
- Data pribadi disamarkan sebelum dikirim ke provider AI (`lib/privacy/pii.ts`)
- Security headers (CSP, frame-ancestors, nosniff, dll) di `next.config.mjs`
- Email + password disimpan + dikelola Supabase Auth (bcrypt hashing)

## Setup OpenRouter (AI Copilot)

AI features (kesimpulan, narasi, chat, follow-up) butuh OpenRouter API key:

1. Daftar gratis di https://openrouter.ai
2. Settings → Keys → Create new key
3. Set `OPENROUTER_API_KEY` di `.env.local` dan di Vercel
4. Free tier: ~20 req/menit, ~50 req/hari per akun

Tanpa OpenRouter, engine local statistik tetap jalan (deterministic),
hanya saja narasi AI & chat AI tidak aktif.

## Project structure

```
app/
  api/           # Server routes (analyze, chat, explain)
  dashboard/     # Main analysis workspace
  projects/      # Project history list & detail view
  login/, signup/, trial/  # Auth pages
components/ui/   # All UI components (Wizard, charts, etc.)
lib/
  auth/          # Supabase-backed session helpers
  db/            # Supabase client + projects CRUD
  engine/        # Statistical engine (parse, profile, clean, analyze, insights)
  report/        # PDF generation
supabase/
  schema.sql     # Database schema (run once on new project)
```

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** with custom design tokens
- **Chart.js** for charts
- **Supabase** (Postgres + Auth + RLS)
- **OpenRouter** for AI (Qwen, Nemotron, gpt-oss free tier)
- **pdf-lib** for PDF reports
