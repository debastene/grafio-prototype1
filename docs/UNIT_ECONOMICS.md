# Grafio — Unit Economics & Keputusan Monetisasi

> Dokumen kerja, 15 Juli 2026. Tujuan: menjawab **"berapa biaya satu analisis, dan siapa yang bayar"**
> sebelum menulis fitur baru apa pun. Angka harga model berubah cepat — yang permanen di sini
> adalah **formulanya**; cek harga aktual di https://openrouter.ai/models sebelum mengambil keputusan final.

---

## 1. Berapa "biaya" satu sesi analisis? (dari kode, bukan asumsi)

Satu sesi analisis penuh memicu call AI berikut (lihat `app/api/*` + `components/ui/AnalysisLauncher.tsx`):

| Call | Route | Input (est. token) | Output (max_tokens) |
|---|---|---|---|
| Clarify | `/api/explain` mode=clarify | ~1.000 | 600 |
| Analyze | `/api/analyze` | ~2.500 (sample 8 KB) | 2.048 |
| Narrate | `/api/explain` mode=narrate | ~1.500 | 1.200 |
| Chart insights | `/api/explain` mode=chart-insights | ~2.000 | 1.200 |
| **Subtotal analisis** | | **~7.000 in** | **~5.000 out** |
| + Export PDF (report) | mode=report | ~1.500 | 1.400 |
| + Per turn chat | `/api/chat` | ~1.500 | 700 |
| + Per "jelaskan chart" | mode=chart | ~800 | 350 |

**Formula biaya per analisis (paid model):**

```
biaya = (token_in / 1jt × harga_in) + (token_out / 1jt × harga_out)
```

**Contoh dengan kelas model murah** (kelas Qwen/Gemma paid, asumsi ~$0,20/1M in, ~$0,80/1M out — VERIFIKASI dulu):

```
Analisis:  (7.000/1jt × $0,20) + (5.000/1jt × $0,80) = $0,0014 + $0,0040 ≈ $0,0054 ≈ Rp 90
Chat/turn: (1.500/1jt × $0,20) + (  700/1jt × $0,80) ≈ $0,0009        ≈ Rp 15
```

**Kesimpulan 1:** dengan model paid murah, **satu sesi analisis ≈ Rp 90–150**, satu turn chat ≈ Rp 15.
Ini SANGAT masuk akal secara bisnis — masalahnya bukan biaya, tapi bahwa saat ini kita memakai
free tier yang kuotanya bukan milik kita.

---

## 2. Tembok free tier (kenapa "gratis" tidak bisa jadi arsitektur)

- Free tier OpenRouter: **~50 request/hari per akun/key** (plus ~20/menit).
- Satu sesi analisis = **±4 request**. Satu user aktif dengan chat = 10–20 request.
- Artinya SATU key gratis hanya cukup untuk **±10 sesi analisis per hari — untuk SEMUA user digabung**.
- 1.000 MAU (klaim proposal) × bahkan hanya 2 sesi/bulan = ±67 sesi/hari → **butuh ~7× kapasitas key gratis**.

**Kesimpulan 2:** free tier hanya valid sebagai *dev mode* dan *demo*. Skala apa pun butuh paid model —
dan untungnya (lihat §1) biayanya receh per sesi. Jangan bangun fitur retensi sebelum ini beres.

---

## 3. Cocokkan dengan pricing yang sudah dipajang

| Tier | Harga | Janji di UI | Biaya AI aktual/bulan (est.) | Margin |
|---|---|---|---|---|
| Free | Rp 0 | 5 analisis / 6 jam (kini DI-ENFORCE oleh `lib/server/aiGuard.ts`) | Realistis dipakai ~10 sesi/bln ≈ Rp 1.500 | – (biaya akuisisi) |
| Student | Rp 49.000/bln | 20–30 prompt / 6 jam | Heavy user 60 sesi + 300 chat ≈ Rp 10.000–15.000 | ~70–80% |
| Pro | Rp 159.000/bln | "longgar" | Power user 150 sesi + 1.000 chat ≈ Rp 30.000–40.000 | ~75% |

**Kesimpulan 3:** klaim gross margin ~75% di proposal **masuk akal** — TAPI hanya setelah:
1. limit per plan benar-benar di-enforce server-side (Free sudah; Student/Pro belum ada logikanya),
2. pindah ke paid model dengan budget cap per user,
3. ada cara menerima pembayaran.

---

## 4. Keputusan yang harus diambil (urut prioritas)

**D1 — Model paid mana + kapan.**
Aksi: buat 1 env var `OPENROUTER_PAID=true` yang menukar CHAINS ke varian paid (non-`:free`).
Trigger: begitu ada >5 user aktif mingguan yang bukan teman sendiri.

**D2 — Satu jalur pembayaran manual dulu, bukan billing engine.**
Validasi willingness-to-pay TANPA menulis kode payment:
tombol "Upgrade ke Student" → WhatsApp/link form → transfer manual → admin jalankan SQL
`update profiles set plan='student' where email='...'` (kolom `requested_plan` sudah mencatat antrian).
Target: **3 orang membayar** → baru layak integrasi Midtrans/Xendit.

**D3 — Definisi limit per plan sebagai data, bukan copywriting.**
Tabel limit (analisis/6 jam, chat/6 jam, max file) per plan di satu modul
(`lib/server/aiGuard.ts` tinggal baca plan user dari profiles) — supaya pricing page dan
enforcement tidak bisa lepas sinkron lagi.

**D4 — Privasi sebagai fitur berbayar.**
Paid model di OpenRouter umumnya zero-retention → jadikan selling point tier berbayar:
"Free: model komunitas. Pro: model privat, data tidak disimpan provider."

---

## 5. Yang TIDAK perlu dikerjakan sekarang

- Integrasi payment gateway penuh (sebelum 3 pembayar manual).
- Fitur credits/quiz-reward — belum ada yang bisa dibeli dengan credits.
- Multi-file, format Parquet/SQLite, forecast — menambah biaya tanpa menjawab WTP.
- Optimasi token (caching, dsb) — biaya per sesi sudah Rp 90; waktu Anda lebih mahal.

---

## 6. Metrik yang menentukan hidup-mati (pantau mingguan)

1. **Sesi analisis selesai / minggu** (bukan visit — sesi yang sampai dashboard render).
2. **% sesi yang kembali dalam 7 hari** (retensi use-case, bukan retensi gamification).
3. **Klik tombol upgrade** (walau belum ada payment — ini sinyal WTP paling murah).
4. **Error rate route AI** (429/504) — kalau naik, free tier sudah jenuh → eksekusi D1.
