/**
 * Domain detector — recognizes the type of dataset (sales, finance, country
 * statistics, healthcare, education, etc.) by matching column names + sample values
 * against domain patterns. Used to:
 *   - Frame the executive summary in domain language
 *   - Generate context-aware prompt suggestions
 *   - Tailor insight phrasing
 */

import { ColProfile, tokenizeName } from "./profile";

export type Domain = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  confidence: number;
  matchedColumns: string[];
  suggestedPrompts: string[];
  /** Suggested analysis lens that the user may want */
  defaultIntent: "exploration" | "trend" | "compare" | "correlation" | "ranking";
};

type Pattern = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  columnHints: string[];
  /**
   * Kata yang dipakai lintas domain ("rating" ada di e-commerce & survei,
   * "harga" di penjualan & properti, "usia" di data pelanggan & pasien) —
   * bobotnya setengah, jadi tidak bisa menentukan domain sendirian.
   */
  weakHints?: string[];
  defaultIntent: Domain["defaultIntent"];
  promptBuilder: (matched: string[], allCols: string[]) => string[];
};

/** First column matching any of the keywords (case-insensitive substring), else fallback. */
function pickCol(allCols: string[], keywords: string[], fallback?: string): string {
  for (const kw of keywords) {
    const c = allCols.find((col) => col.toLowerCase().includes(kw));
    if (c) return c;
  }
  return fallback ?? allCols[0] ?? "kolom";
}

const PATTERNS: Pattern[] = [
  {
    id: "country",
    name: "Demografi & Negara",
    emoji: "🌍",
    description: "Data agregat per-negara: ekonomi, populasi, sosial, geografi",
    columnHints: [
      "country", "negara", "capital", "ibukota", "continent", "benua",
      "gdp", "pdb", "population", "populasi", "life", "literacy", "literasi",
      "density", "currency", "iso",
    ],
    weakHints: ["region", "area", "code"],
    defaultIntent: "compare",
    promptBuilder: (m, all) => {
      const top = pickCol(all, ["gdp", "population", "income"]);
      const second = pickCol(all, ["life", "literacy", "expectancy", "hdi"], top);
      const region = pickCol(all, ["region", "continent", "benua"]);
      return [
        `Top 10 negara berdasarkan ${top}`,
        `Korelasi ${top} dan ${second}`,
        `Bandingkan ${region} berdasarkan ${top}`,
        `Anomali ekstrem di ${top}`,
        `Tren ${top} dari yang terendah ke tertinggi`,
      ];
    },
  },
  {
    id: "sales",
    name: "Penjualan & E-commerce",
    emoji: "🛒",
    description: "Transaksi, produk, customer, revenue, dan metrik komersial",
    columnHints: [
      "order", "pesanan", "product", "produk", "customer", "pelanggan",
      "quantity", "qty", "revenue", "sale", "sales", "penjualan", "omzet",
      "discount", "diskon", "sku", "transaction", "transaksi", "invoice", "subtotal",
      "belanja", "pembelian", "purchase", "pembeli", "buyer", "penjual", "seller",
      "member", "membership", "loyalty", "churn", "toko", "store", "merchant",
      "cart", "keranjang", "checkout", "ongkir", "shipping",
    ],
    weakHints: ["price", "harga", "jumlah", "total", "category", "kategori"],
    defaultIntent: "trend",
    promptBuilder: (m, all) => {
      const rev = pickCol(all, ["revenue", "sale", "penjualan", "total"]);
      const prod = pickCol(all, ["product", "produk", "sku", "category"]);
      const date = pickCol(all, ["date", "tanggal", "time"]);
      return [
        `Top 10 ${prod} by ${rev}`,
        `Tren ${rev} per ${date}`,
        `Anomali transaksi tinggi/rendah`,
        `Segmentasi customer berdasarkan ${rev}`,
        `Bandingkan kategori produk berdasarkan ${rev}`,
      ];
    },
  },
  {
    id: "finance",
    name: "Pasar Saham & Keuangan",
    emoji: "💹",
    description: "Harga saham, return, volume, market cap, indikator finansial",
    columnHints: [
      "stock", "saham", "ticker", "dividend", "market_cap", "pe", "pbv", "ihsg", "emiten",
    ],
    // OHLCV satu per satu ambigu ("high_school", "low_stock"); bersama-sama tetap kuat.
    weakHints: ["open", "close", "high", "low", "volume", "return", "ratio"],
    defaultIntent: "trend",
    promptBuilder: (m, all) => {
      const close = pickCol(all, ["close", "price", "harga"]);
      const vol = pickCol(all, ["volume"]);
      return [
        `Tren ${close} dari waktu ke waktu`,
        `Volatilitas ${close}`,
        `Korelasi ${close} dan ${vol}`,
        `Anomali volume ekstrem`,
        `Forecast ${close} 3 periode ke depan`,
      ];
    },
  },
  {
    id: "marketing",
    name: "Marketing & Iklan",
    emoji: "📈",
    description: "Kampanye, kanal, conversion funnel, ROAS",
    columnHints: [
      "campaign", "kampanye", "channel", "kanal", "click", "klik",
      "impression", "tayang", "conversion", "ctr", "cpc", "cpa", "roas",
      "ad", "iklan", "spend", "budget", "anggaran",
    ],
    defaultIntent: "compare",
    promptBuilder: (m, all) => {
      const roas = pickCol(all, ["roas", "conversion", "ctr"]);
      const spend = pickCol(all, ["spend", "budget", "cost"]);
      const channel = pickCol(all, ["channel", "kanal", "campaign"]);
      return [
        `Top kanal berdasarkan ${roas}`,
        `Korelasi ${spend} dan ${roas}`,
        `Bandingkan ${channel} dengan ROAS terbaik`,
        `Anomali kampanye dengan performa rendah`,
        `Tren ${roas} dari waktu ke waktu`,
      ];
    },
  },
  {
    id: "health",
    name: "Kesehatan & Medis",
    emoji: "🏥",
    description: "Data pasien, indikator klinis, treatment outcomes",
    columnHints: [
      "patient", "pasien", "diagnosis",
      "blood", "darah", "heart", "jantung", "bmi", "bp", "cholesterol",
      "treatment", "obat", "dosage", "symptom", "gejala", "glucose", "glukosa",
    ],
    weakHints: ["age", "umur", "usia"],
    defaultIntent: "correlation",
    promptBuilder: (m, all) => {
      const age = pickCol(all, ["age", "umur", "usia"]);
      const target = pickCol(all, ["diagnosis", "outcome", "result", "hasil"]);
      return [
        `Korelasi ${age} dengan ${target}`,
        `Distribusi ${target}`,
        `Anomali nilai klinis`,
        `Bandingkan grup usia berdasarkan outcome`,
        `Top faktor risiko`,
      ];
    },
  },
  {
    id: "education",
    name: "Pendidikan & Akademik",
    emoji: "🎓",
    description: "Nilai siswa, mahasiswa, IPK, hasil ujian",
    columnHints: [
      "student", "siswa", "mahasiswa", "subject", "matkul", "course",
      "school", "sekolah", "gpa", "ipk", "exam", "ujian", "nim", "nisn", "semester",
    ],
    // "nilai" juga berarti "value" (nilai_transaksi); "score" ada di skor kredit.
    weakHints: ["grade", "nilai", "score", "test", "rank"],
    defaultIntent: "compare",
    promptBuilder: (m, all) => {
      const score = pickCol(all, ["score", "nilai", "gpa", "ipk", "grade"]);
      const subject = pickCol(all, ["subject", "matkul", "course"]);
      return [
        `Distribusi ${score}`,
        `Top siswa berdasarkan ${score}`,
        `Bandingkan ${subject} berdasarkan rata-rata`,
        `Anomali nilai (terlalu tinggi/rendah)`,
        `Korelasi antar mata pelajaran`,
      ];
    },
  },
  {
    id: "hr",
    name: "Karyawan & HR",
    emoji: "👥",
    description: "Data karyawan, gaji, departemen, performance",
    columnHints: [
      "employee", "karyawan", "salary", "gaji", "department", "departemen",
      "hire", "position", "jabatan", "manager", "tenure", "performance",
    ],
    defaultIntent: "compare",
    promptBuilder: (m, all) => {
      const sal = pickCol(all, ["salary", "gaji", "compensation"]);
      const dept = pickCol(all, ["department", "departemen", "division"]);
      return [
        `Distribusi ${sal} per ${dept}`,
        `Top karyawan berdasarkan ${sal}`,
        `Anomali gaji ekstrem`,
        `Korelasi tenure dan performance`,
        `Bandingkan departemen`,
      ];
    },
  },
  {
    id: "realestate",
    name: "Properti & Real Estate",
    emoji: "🏠",
    description: "Listing properti, harga, lokasi, fitur rumah",
    columnHints: [
      "property", "properti", "rumah", "house", "bedroom", "kamar",
      "bathroom", "square", "luas", "listing", "sqft",
    ],
    weakHints: ["price", "harga", "address", "alamat", "lot"],
    defaultIntent: "correlation",
    promptBuilder: (m, all) => {
      const price = pickCol(all, ["price", "harga"]);
      const luas = pickCol(all, ["square", "luas", "area"]);
      return [
        `Korelasi ${luas} dan ${price}`,
        `Distribusi ${price}`,
        `Top properti termahal`,
        `Anomali harga ekstrem`,
        `Bandingkan harga per lokasi`,
      ];
    },
  },
  {
    id: "iot",
    name: "Sensor & IoT",
    emoji: "📡",
    description: "Pembacaan sensor, time series device, monitoring",
    columnHints: [
      "sensor", "temperature", "suhu", "humidity", "kelembaban",
      "voltage", "device", "perangkat", "reading", "co2", "pressure",
    ],
    weakHints: ["timestamp"],
    defaultIntent: "trend",
    promptBuilder: (m, all) => {
      const sensor = pickCol(all, ["temperature", "suhu", "humidity", "reading"]);
      return [
        `Tren ${sensor} dari waktu ke waktu`,
        `Anomali pembacaan sensor`,
        `Korelasi antar sensor`,
        `Distribusi ${sensor}`,
        `Forecast ${sensor} ke depan`,
      ];
    },
  },
  {
    id: "weblytics",
    name: "Web Analytics",
    emoji: "🌐",
    description: "Sesi user, traffic, behavior, sumber trafik",
    columnHints: [
      "session", "sesi", "page", "halaman", "bounce", "pageview", "referrer", "browser",
    ],
    weakHints: ["user", "duration", "durasi", "source", "sumber"],
    defaultIntent: "ranking",
    promptBuilder: (m, all) => {
      const sess = pickCol(all, ["session", "user", "page"]);
      const src = pickCol(all, ["source", "sumber", "referrer"]);
      return [
        `Top ${src} berdasarkan ${sess}`,
        `Tren traffic`,
        `Korelasi durasi dan bounce rate`,
        `Anomali traffic spike`,
        `Bandingkan browser/device`,
      ];
    },
  },
  {
    id: "survey",
    name: "Survei & Riset",
    emoji: "📋",
    description: "Respon survei, rating, kuesioner",
    columnHints: [
      "respondent", "responden", "question", "pertanyaan", "questionnaire", "kuesioner",
      "answer", "jawaban", "likert", "feedback", "satisfaction", "kepuasan", "nps",
    ],
    // "rating" juga ulasan produk di e-commerce — sendirian bukan bukti survei.
    weakHints: ["rating", "scale", "skala", "response", "score"],
    defaultIntent: "compare",
    promptBuilder: (m, all) => {
      const rating = pickCol(all, ["rating", "score", "satisfaction"]);
      return [
        `Distribusi ${rating}`,
        `Bandingkan grup responden`,
        `Korelasi antar pertanyaan`,
        `Anomali respon ekstrem`,
        `Top pertanyaan dengan rating tertinggi`,
      ];
    },
  },
];

/**
 * Skor satu hint terhadap satu nama kolom. Exact > token > substring.
 * Substring hanya untuk hint >= 4 huruf: "age" ada di "percentage" dan
 * "average", "iso" ada di "comparison" — terlalu banyak salah tangkap.
 */
function hintScore(nameLower: string, tokens: string[], hint: string): number {
  if (nameLower === hint) return 5;
  if (tokens.includes(hint)) return 4;
  if (hint.length >= 4 && nameLower.includes(hint)) return 2;
  return 0;
}

/**
 * Skor tiap pola = jumlah skor hint yang cocok dengan nama kolom
 * (hint lemah dihitung setengah). Domain dengan skor tertinggi menang;
 * di bawah 4 → "Dataset Umum" (tidak cukup bukti).
 */
export function detectDomain(profiles: ColProfile[]): Domain {
  const allColNames = profiles.map((p) => p.name);
  const cols = profiles.map((p) => ({ lower: p.name.toLowerCase(), tokens: tokenizeName(p.name) }));

  let bestPattern: Pattern | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const pat of PATTERNS) {
    const matched: string[] = [];
    let score = 0;
    const hints: [string, number][] = [
      ...pat.columnHints.map((h): [string, number] => [h, 1]),
      ...(pat.weakHints ?? []).map((h): [string, number] => [h, 0.5]),
    ];
    for (const [hint, weight] of hints) {
      cols.forEach((c, i) => {
        const sc = hintScore(c.lower, c.tokens, hint);
        if (sc > 0) {
          score += sc * weight;
          matched.push(allColNames[i]);
        }
      });
    }
    if (score > bestScore) {
      bestScore = score;
      bestPattern = pat;
      bestMatched = Array.from(new Set(matched));
    }
  }

  // Fallback: generic
  if (!bestPattern || bestScore < 4) {
    return {
      id: "generic",
      name: "Dataset Umum",
      description: "Tabel data umum tanpa domain spesifik yang terdeteksi",
      emoji: "📊",
      confidence: 0.3,
      matchedColumns: [],
      suggestedPrompts: [
        "Ringkas data ini",
        "Top 10 baris berdasarkan kolom utama",
        "Korelasi antar kolom numerik",
        "Identifikasi anomali / outlier",
        "Bandingkan kategori utama",
      ],
      defaultIntent: "exploration",
    };
  }

  // Confidence — normalize against pattern's max possible score
  const maxPossible = bestPattern.columnHints.length * 5;
  const confidence = Math.min(1, bestScore / Math.max(20, maxPossible * 0.3));

  return {
    id: bestPattern.id,
    name: bestPattern.name,
    description: bestPattern.description,
    emoji: bestPattern.emoji,
    confidence,
    matchedColumns: bestMatched,
    suggestedPrompts: bestPattern.promptBuilder(bestMatched, allColNames),
    defaultIntent: bestPattern.defaultIntent,
  };
}
