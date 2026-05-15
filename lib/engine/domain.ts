/**
 * Domain detector — recognizes the type of dataset (sales, finance, country
 * statistics, healthcare, education, etc.) by matching column names + sample values
 * against domain patterns. Used to:
 *   - Frame the executive summary in domain language
 *   - Generate context-aware prompt suggestions
 *   - Tailor insight phrasing
 */

import { ColProfile } from "./profile";

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
      "country", "negara", "capital", "ibukota", "region", "continent", "benua",
      "gdp", "pdb", "population", "populasi", "life", "literacy", "literasi",
      "area", "density", "currency", "iso", "code",
    ],
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
      "price", "harga", "quantity", "qty", "jumlah",
      "revenue", "sale", "penjualan", "discount", "diskon", "sku", "category",
      "transaction", "transaksi", "invoice", "subtotal", "total",
    ],
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
      "stock", "saham", "ticker", "open", "close", "high", "low", "volume",
      "return", "dividend", "market_cap", "ratio", "pe", "pbv",
    ],
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
      "patient", "pasien", "diagnosis", "age", "umur", "usia",
      "blood", "darah", "heart", "jantung", "bmi", "bp", "cholesterol",
      "treatment", "obat", "dosage", "symptom", "gejala",
    ],
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
      "student", "siswa", "mahasiswa", "grade", "nilai", "score",
      "subject", "matkul", "course", "school", "sekolah",
      "gpa", "ipk", "exam", "ujian", "test", "rank",
    ],
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
      "property", "rumah", "house", "price", "harga", "bedroom", "kamar",
      "bathroom", "square", "luas", "address", "alamat", "listing", "lot",
    ],
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
      "timestamp", "sensor", "temperature", "suhu", "humidity", "kelembaban",
      "voltage", "device", "perangkat", "reading", "co2", "pressure",
    ],
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
      "session", "sesi", "user", "page", "halaman", "bounce",
      "duration", "durasi", "source", "sumber", "referrer", "browser",
    ],
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
      "respondent", "responden", "question", "answer", "rating", "scale",
      "response", "feedback", "satisfaction", "kepuasan", "score",
    ],
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
 * Compute a score for each pattern by counting matched column names.
 */
export function detectDomain(profiles: ColProfile[]): Domain {
  const colNamesLower = profiles.map((p) => p.name.toLowerCase());
  const allColNames = profiles.map((p) => p.name);

  let bestPattern: Pattern | null = null;
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (const pat of PATTERNS) {
    const matched: string[] = [];
    let score = 0;
    for (const hint of pat.columnHints) {
      for (let i = 0; i < colNamesLower.length; i++) {
        const name = colNamesLower[i];
        if (name === hint) {
          score += 5;
          matched.push(allColNames[i]);
        } else if (name.split(/[_\s\-./]/).includes(hint)) {
          score += 4;
          matched.push(allColNames[i]);
        } else if (name.includes(hint) && hint.length >= 3) {
          score += 2;
          matched.push(allColNames[i]);
        }
      }
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
