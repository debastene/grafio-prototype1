/**
 * orbitTerms.ts — data label + body untuk OrbitStar 3D.
 *
 * EDIT BEBAS file ini untuk ganti istilah, urutan, atau body copy.
 * Body adalah DRAFT — boleh diganti dengan copy final brand kamu.
 *
 * Struktur:
 * - id: unique key (lowercase)
 * - label: text yang muncul di orbit (1 kata, font-syne)
 * - accent: warna node dot — "cyan" | "violet" | "mint"
 * - body: 1-2 paragraf penjelasan istilah (voice Grafio: bahasa "kamu",
 *         awam, no jargon, contoh konkret)
 */

export type OrbitAccent = "cyan" | "violet" | "mint";

export type OrbitTerm = {
  id: string;
  label: string;
  accent: OrbitAccent;
  body: string;
};

export const ORBIT_TERMS: OrbitTerm[] = [
  {
    id: "revenue",
    label: "Revenue",
    accent: "cyan",
    body: "Pendapatan total dari semua sumber. Grafio kelompokkan per kanal, periode, atau segmen produk supaya kamu lihat mana yang benar-benar narik growth — bukan cuma angka agregat yang ngambang.\n\nKamu bisa minta forecast 3-4 periode ke depan, lengkap dengan rentang prediksi (confidence band) supaya kamu tahu seberapa yakin AI dengan angka itu.",
  },
  {
    id: "users",
    label: "Users",
    accent: "violet",
    body: "Jumlah pengguna aktif kamu — baik harian (DAU), mingguan (WAU), atau bulanan (MAU). Grafio bantu kamu lihat tren growth, identifikasi cohort yang paling kuat, dan deteksi user yang mulai stuck.\n\nKalau ada anomali (mis. lonjakan signup mendadak), AI kasih konteks: apakah itu kampanye organik, bot traffic, atau real growth.",
  },
  {
    id: "growth",
    label: "Growth",
    accent: "mint",
    body: "Laju pertumbuhan metrik kunci dari periode ke periode. Grafio hitung tidak cuma % naik-turun, tapi juga konsistensi (apakah growth-nya stabil atau volatile) dan momentum (apakah lagi akselerasi atau melambat).\n\nKesimpulan ditulis bersudut pandang: \"momentum panas\", \"sinyal melemah\", atau \"plateau\" — bukan sekadar angka mentah.",
  },
  {
    id: "churn",
    label: "Churn",
    accent: "cyan",
    body: "Tingkat pengguna/pelanggan yang berhenti pakai produk dalam periode tertentu. Grafio tunjukkan churn rate, alasan paling mungkin (kalau ada data kontekstual), dan cohort mana yang paling rentan.\n\nDeteksi early-warning: kalau churn naik sebelum visible di metrik agregat, AI flag duluan supaya kamu sempat intervensi.",
  },
  {
    id: "retention",
    label: "Retention",
    accent: "mint",
    body: "Berapa banyak user yang kembali pakai produk setelah hari ke-1, 7, 30, dst. Grafio visualisasi cohort retention curve sehingga kamu lihat apakah retention naik untuk cohort terbaru (= produk lagi membaik) atau menurun.\n\nGabungkan dengan data fitur usage untuk identifikasi fitur mana yang paling kuat narik user balik.",
  },
  {
    id: "trends",
    label: "Trends",
    accent: "cyan",
    body: "Pola jangka panjang dalam datamu — naik, turun, atau bergelombang. Grafio engine pakai OLS regression untuk extract underlying trend dari noise, dan tunjukkan goodness-of-fit (R²) supaya kamu tahu seberapa kuat tren itu.\n\nBerguna untuk strategic planning: kamu bisa bedakan fluktuasi musiman vs perubahan struktural.",
  },
  {
    id: "signals",
    label: "Signals",
    accent: "violet",
    body: "Sinyal-sinyal awal perubahan: leading indicators yang bergerak sebelum metrik utama. Grafio identifikasi korelasi temporal antar metrik supaya kamu tahu mana yang bisa jadi early warning.\n\nContoh: penurunan engagement biasanya mendahului penurunan retention 2-4 minggu kemudian.",
  },
  {
    id: "anomaly",
    label: "Anomaly",
    accent: "cyan",
    body: "Titik data yang menyimpang dari pola normal. Grafio pakai Z-score (≥3σ) + IQR analysis untuk deteksi outlier dengan akurat, lalu kasih konteks: apakah ini noise yang perlu dibersihkan, atau \"data emas\" (mis. lonjakan kampanye Ramadhan yang sebenarnya valid).\n\nKamu yang putuskan per-anomali: perbaiki atau pertahankan. AI cuma rekomendasi.",
  },
  {
    id: "forecast",
    label: "Forecast",
    accent: "violet",
    body: "Proyeksi nilai metrik ke depan berdasarkan tren historis. Grafio kasih point prediction + confidence band (rentang kemungkinan) sehingga kamu tahu seberapa yakin AI dengan angka itu.\n\nUntuk planning: kamu bisa lihat \"kalau pola bertahan, revenue Q3 berpotensi tembus X\" — bukan jaminan, tapi base rate yang masuk akal untuk diskusi strategi.",
  },
];
