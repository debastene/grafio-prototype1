# Prompt untuk Generate Grafio Business Proposal PDF

Copy seluruh blok di bawah lalu paste ke Claude (di claude.ai atau Claude Desktop dengan PDF skill aktif).

---

```
Tolong buatkan saya **PDF Business Proposal lengkap** untuk startup AI analytics saya bernama Grafio. PDF ini akan saya share langsung ke calon investor (angel + seed VC) — jadi harus terlihat profesional, design konsisten dengan brand Grafio, siap publish tanpa edit lagi.

---

# 1. TENTANG FOUNDER & CEO

- **Nama lengkap**: Bassa Bhaskara Desno Gabrihi
- **Role**: Founder & CEO Grafio
- **Background**: Mahasiswa aktif S1 Sains Data, Institut Teknologi Sepuluh Nopember (ITS) Surabaya
- **Visi pribadi**: Ambisius menggali ilmu di dunia teknologi — khususnya data science. Building dan iterating Grafio sebagai solo founder dari kampus, dengan target product-market fit di pasar Indonesia.
- **Kontak**:
  - WhatsApp: 081252424945
  - Email: babasdesno@gmail.com

---

# 2. TENTANG GRAFIO (Produk)

**Tagline**: "See Beyond The Numbers"
**Misi**: Demokratisasi data analytics untuk 270 juta orang Indonesia — bikin insight dari data semudah mengetik pertanyaan, bukan menulis SQL atau memencet 20 menu.

## Apa itu Grafio
AI-powered data analytics dashboard **berbahasa Indonesia natural**. User upload file data (CSV / Excel / JSON / Parquet / SQLite / dll, max 50MB) → engine parse + analisis statistik client-side → AI generate insight + rekomendasi + PDF report siap presentasi.

## Architecture Hybrid (USP utama)
- **Engine statistik client-side** (deterministic): OLS regression, Pearson correlation, Z-score outlier, domain detection 24 jenis dataset, auto data cleaning dengan health score 0-100
- **AI layer via OpenRouter free models**: clarification step, narasi insight natural, chat copilot, PDF executive narrative — semua Bahasa Indonesia
- **Multi-model fallback chain**: Qwen3-next-80b, Nemotron-3-Super-120b, GPT-OSS-20b, Gemma-3-27b, Llama-3.3-70b (8 provider, otomatis switch kalau rate-limited)

## Fitur utama
1. **Upload universal** — 16+ format file
2. **AI Clarification step** — AI baca data, kasih saran prompt analisis sebelum mulai
3. **9 chart type** — Line, Bar, Doughnut, Radar, Polar, Scatter, Bubble, Mixed, Heatmap
4. **AI Copilot chat** — tanya bebas Bahasa Indonesia, dapat angka eksak + narasi
5. **"Jelaskan chart ini"** — klik tombol, AI cerita 3-4 kalimat tentang chart
6. **Follow-up suggestions** — 3 pertanyaan lanjutan kontekstual di chat
7. **PDF Report magazine-style** — cover dengan AI summary teaser, 6 section, narasi eksekutif 4 paragraf, rekomendasi strategis dengan impact ranking

## Tech stack
- Frontend: Next.js 14 (app router), TypeScript, Tailwind CSS, React 18
- Charts: Chart.js + react-chartjs-2
- AI: OpenRouter (free tier + paid)
- PDF: jsPDF + jspdf-autotable
- Hosting: Vercel + AWS Singapore (ap-southeast-1)

## Status saat ini (Mei 2026)
- v2.0 launched dengan full AI Copilot pipeline (14 Mei 2026)
- ~1,000 monthly active users
- Solo-founded — coding, design, growth semua by founder
- Public website: grafio.app

---

# 3. BRAND & VISUAL IDENTITY (Moodboard — WAJIB DIIKUTI)

PDF business proposal harus konsisten dengan brand Grafio. Style guide:

## Color palette (gunakan ini di PDF, jangan pakai warna lain)
- **Background**: `#05081A` (deep navy/almost-black), `#0F1A3F` (surface), `#14234F` (elevated)
- **Primary accent**: `#00D4FF` (cyan) — untuk highlight, link, CTA, section divider
- **Secondary**:
  - `#00FFB3` (mint) — untuk positif, success, growth
  - `#7B5EA7` (purple) — untuk AI / premium feature
  - `#FF6FB5` (pink) — untuk warning ringan
- **Text**:
  - `#F0F4FF` (white) untuk heading
  - `#E2E8F0` (silver) untuk body
  - `#7A88AC` (muted) untuk caption, meta
- **Warning**: `#FFB547`, **Danger**: `#FF4D6D`
- **Border**: `#283764` (hairline)

## Typography
- **Heading**: bold sans-serif, font seperti Syne / Outfit / Space Grotesk. Tracking wide untuk uppercase label
- **Body**: clean sans-serif (Inter / Helvetica)
- **Mono**: untuk angka, kolom data (JetBrains Mono / SF Mono)

## Visual style
- **Dark theme magazine-style** — bukan corporate template biasa
- **Numbered section** ("01", "02", "03", ...) dengan badge cyan rounded
- **Pill-shaped chip** untuk tag/category (cyan/mint/purple)
- **Hairline borders 0.5pt** — clean, sharp, bukan tebal
- **Cyan accent stripe** di sebelah kiri quote/insight box
- **Grid background subtle** (dotted atau line tipis 5% opacity)
- **Glass-morphism cards** — fill dengan opacity 80%, border subtle
- **KPI cards** dengan accent strip 2pt di atasnya
- **Logo Grafio**: 12-point compass star (lampirkan placeholder — saya kasih file PNG terpisah). Warna silver/white di background gelap.

## Voice & tone
- **Confident** tapi humble — bukan over-promising
- **Technical-but-friendly** — pakai istilah AI/data tepat tapi accessible
- **Sedikit playful** — Grafio bukan tools korporat kaku
- **Bahasa Indonesia natural mix English** untuk istilah teknis (e.g. "engine statistik", "rate-limited", "product-market fit") — jangan terjemah paksa istilah teknis

---

# 4. PASAR & KOMPETITOR

## TAM Indonesia
- **270 juta** populasi total
- **65 juta** UMKM aktif (Kementerian Koperasi, 2024)
- **8.5 juta** mahasiswa aktif (BPS, 2024)
- **~100K** data analyst & scientist profesional (estimasi LinkedIn + Glints)
- **AI analytics market** Indonesia diestimasi tumbuh 35% YoY hingga 2030

## Kompetitor utama
Semua **English-only, mahal, target enterprise/pro analyst** — tidak ada yang fokus pasar Indonesia:

| Tool | Pricing | Target | Bahasa |
|---|---|---|---|
| Julius AI | $20/mo | Non-technical pro | English |
| Quadratic | $20/user/mo | Spreadsheet power user | English |
| Hex | $30+/user/mo | Data team enterprise | English |
| ChatGPT Adv Data Analysis | $20/mo | General | English (limited Indonesian) |
| Power BI Copilot | Enterprise | Korporat | English (limited) |
| Tableau Pulse | Enterprise | Korporat | English |

## Diferensiasi Grafio (5 pilar)
1. **Indonesian-first UX** — semua copy, error message, AI output natural Bahasa Indonesia
2. **Free tier yang berguna** — pakai OpenRouter free, full AI (bukan demo)
3. **Hybrid engine + AI** — angka eksak deterministik + narasi natural (kompetitor: pure-AI, kadang halusinasi)
4. **Target underserved**: UMKM Indonesia, mahasiswa S1/S2, founder lokal
5. **1-menit onboarding** — drag & drop file → langsung insight, tanpa setup database/SQL

---

# 5. BUSINESS MODEL

## 3-tier pricing
**Free** (gratis selamanya):
- 50 AI request/hari
- Max 50MB/file
- Watermark di PDF export
- Discord community support

**Pro** — Rp 99rb/bulan atau Rp 990rb/tahun:
- Unlimited AI request (fair use)
- Max 500MB/file
- No watermark
- Priority email support
- Custom branding di PDF export

**Enterprise** — Custom (estimasi Rp 50-200 juta/tahun):
- Custom rate limit
- SSO (Google Workspace, Microsoft 365, SAML)
- Audit log + role-based access
- SLA 99.9%
- Dedicated CSM + Slack channel
- On-prem / VPC deployment option

## Unit economics (estimasi)
- **CAC** (Pro): Rp 150rb (organic content + komunitas)
- **LTV** (Pro): Rp 1.5 juta (retention 18 bulan avg)
- **LTV/CAC**: 10x
- **Payback period**: < 2 bulan
- **Gross margin**: 75% (cost utama: OpenRouter paid + AWS)

---

# 6. REVENUE PROJECTION

| Tahun | Free MAU | Pro Sub | Enterprise | ARR (Rp) |
|---|---|---|---|---|
| 2026 | 5,000 | 100 | 2 | 220 jt |
| 2027 | 25,000 | 1,000 | 10 | 2 M |
| 2028 | 100,000 | 5,000 | 50 | 15 M |
| 2029 (path to profit) | 300,000 | 15,000 | 150 | 50 M |

---

# 7. FUNDING ASK

**Seed round: Rp 3 Miliar (~$200K USD)**

## Use of funds (24 bulan runway)
- **50%** — Tim: 1 senior fullstack engineer, 1 ML engineer (NLP Indonesia), 1 product designer, 1 customer success
- **20%** — Infrastruktur: AWS production, OpenRouter paid tier, monitoring, security tooling
- **15%** — GTM: content marketing Bahasa Indonesia, kampus partnership (ITS, UI, UGM, ITB), sponsorship event data science, podcast appearance
- **10%** — Legal & operations: PT setup, compliance roadmap (SOC 2 prep, ISO 27001)
- **5%** — Buffer & opportunistic spend

## Target milestone post-funding (24 bulan)
- 50,000 MAU
- 1,500 Pro subscribers (Rp 150 jt MRR)
- 15 Enterprise customer
- SOC 2 Type II certified
- Expand ke Malaysia + Singapura (English UX optional toggle)

---

# 8. STRUKTUR PDF YANG WAJIB ADA

Bikin PDF dengan section berikut, masing-masing 1-2 halaman. **Total target: 14-18 halaman A4 portrait.**

1. **Cover Page** (1 hal)
   - Logo Grafio centered (gunakan placeholder kalau belum ada gambar)
   - Title: "Investment Memorandum" atau "Business Proposal — Seed Round 2026"
   - Tagline "See Beyond The Numbers"
   - Bulan & tahun: "Mei 2026"
   - "Prepared for: Calon Investor" + "Confidential" subtle watermark
   - Footer: nama founder + role

2. **Executive Summary** (1 hal)
   - 5 paragraf pendek (max 60 kata/paragraf):
     - Apa Grafio
     - Pasar yang dilayani
     - Traction
     - Funding ask
     - Why now

3. **Problem** (1 hal)
   - 3 pain point besar dengan icon
   - 2-3 data point fakta market

4. **Solution** (1-2 hal)
   - Grafio overview dengan workflow 3-step (Upload → AI Analyze → Insight + PDF)
   - 6 fitur utama dalam grid card (3x2)
   - Diagram architecture sederhana (engine + AI hybrid)

5. **Product Showcase** (2 hal)
   - Deskripsi mockup tiap screen (Dashboard, Clarification, Chat, PDF Report)
   - Untuk tiap screen, deskripsikan secara visual + apa yang user lakukan
   - (Kalau bisa render placeholder dengan deskripsi text, lakukan; jika tidak, sebut "[screenshot tersedia by request]")

6. **Market Opportunity** (1 hal)
   - TAM/SAM/SOM Indonesia (angka konkret + sumber estimasi)
   - Funnel chart atau number block besar
   - "Why Indonesia, Why Now"

7. **Competitive Landscape** (1 hal)
   - Tabel comparison Grafio vs 5 kompetitor (pricing, language, target, free tier, hybrid AI)
   - Highlight unique position Grafio dengan kolom checklist ✓/✗

8. **Business Model** (1 hal)
   - 3 pricing card vertical (Free / Pro / Enterprise) dengan feature list
   - Unit economics summary (CAC, LTV, payback)

9. **Traction & Roadmap** (1 hal)
   - Milestones timeline 2025 → 2026 (kapan tiap rilis terjadi)
   - Roadmap 12-18 bulan: Phase 2 features (Conversational Filter, Voice Query, Smart KPI AI, Anomaly Story, Streaming UX)

10. **Financials** (1 hal)
    - Tabel 4-year revenue projection
    - Burn rate & runway chart
    - Path to profitability narrative

11. **Funding Ask** (1 hal)
    - Rp 3 Miliar seed
    - Pie chart use of funds (50/20/15/10/5)
    - Post-money milestones

12. **Team** (1 hal)
    - **Founder profile prominent**:
      - Nama: Bassa Bhaskara Desno Gabrihi
      - Role: Founder & CEO
      - Background: Mahasiswa S1 Sains Data, ITS Surabaya
      - Visi pribadi (1 paragraf personable)
      - Foto placeholder atau initial avatar
    - Hiring plan: 4 role yang akan direkrut (sebut role + ekspektasi background)
    - Advisor wishlist (optional, "Advisor sedang dalam diskusi")

13. **Why Now / Vision** (1 hal)
    - 3 trend: AI commoditization, Indonesia digital economy growth, mahasiswa S1 sains data boom
    - 5-year vision: Grafio sebagai default analytics tool Asia Tenggara

14. **Contact & Next Steps** (1 hal)
    - Founder name + role + foto/avatar placeholder
    - WhatsApp: 081252424945
    - Email: babasdesno@gmail.com
    - "Let's build the future of Indonesian analytics together"
    - CTA: schedule call link placeholder

---

# 9. SPESIFIKASI OUTPUT

- **Format**: PDF, A4 portrait (595 × 842 pt)
- **Bahasa**: Indonesia natural mix English untuk istilah teknis (jangan terjemah paksa)
- **Tone**: Confident-data-driven-personable. Sedikit visionary di section 13.
- **Tipografi**: bold sans untuk heading, clean sans untuk body, mono untuk angka
- **Color theme**: dark navy bg + cyan accent (lihat moodboard di section 3)
- **Page footer setiap halaman** (kecuali cover):
  - Kiri: "Grafio · Confidential"
  - Tengah: page number "X / Y"
  - Kanan: "babasdesno@gmail.com"
- **Sertakan**:
  - Angka realistis (boleh estimasi tapi reasonable, tidak halusinasi)
  - Citation untuk klaim besar (footnote atau parenthetical)
  - Konsistensi terminologi (jangan campur "user" vs "pengguna" di section yang sama)

## Yang harus diperhatikan
- Cover page WAJIB punya logo placeholder (placeholder text "[GRAFIO LOGO]" kalau tidak bisa render gambar) + tagline
- Konsisten dengan dark theme — jangan tiba-tiba ada halaman putih
- Tabel pakai border tipis hairline cyan, bukan tebal hitam
- Angka uang format Indonesia (Rp 3.000.000.000 atau "Rp 3 M")
- Cek typo Bahasa Indonesia

---

# 10. DELIVERABLES

Setelah PDF jadi, kasih saya:
1. **File PDF business proposal** (filename: `Grafio_Business_Proposal_2026.pdf`)
2. **Catatan asumsi** yang dipakai (terutama revenue projection, market size)
3. **Saran improvement** kalau ada — misal pertanyaan investor yang mungkin akan ditanyakan
4. **List slide deck setara** kalau saya butuh pitch deck versi PowerPoint nanti

Pakai PDF generation tool (PyMuPDF, reportlab, atau apapun yang tersedia) untuk hasil presentation-grade.

Mulai!
```

---

## Catatan tambahan dari saya (Grafio dev)

Untuk hasil maksimal saat paste ke Claude:
1. **Lampirkan file logo PNG** (`public/grafio-logo.png` dari project) supaya Claude bisa render logo asli di cover, bukan placeholder
2. **Lampirkan 2-3 screenshot dashboard Grafio** kalau ada — untuk section "Product Showcase"
3. Kalau Claude minta klarifikasi soal angka revenue/valuation, kasih jawaban langsung supaya tidak break flow
4. Output Claude bisa diiterasi: minta revisi section spesifik kalau ada yang kurang
5. Untuk pitch deck versi PowerPoint, lanjut dengan prompt terpisah pakai 10 highlight section ini sebagai outline
