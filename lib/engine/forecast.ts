/**
 * Pipeline peramalan: kolom waktu → deret REGULER → auto ARIMA → diagnostik →
 * evaluasi holdout. Matematika ARIMA ada di ./arima.ts.
 *
 * Masalah praktis yang ditangani sebelum Box-Jenkins:
 *   - Data transaksi (banyak baris per hari, hari tanpa transaksi) → dipilih
 *     granularitas terhalus (hari → minggu → bulan → kuartal → tahun) yang
 *     periode kosongnya ≤ 10% dan jumlah periodenya ≤ 500. Periode kosong yang
 *     tersisa diisi interpolasi linear.
 *   - Data bursa (Senin–Jumat) → deret "hari kerja", bukan hari kalender
 *     (akhir pekan bukan data hilang).
 *   - Periode tepi yang belum lengkap (mis. data berhenti tanggal 14) pada
 *     metrik yang DIJUMLAH dibuang — totalnya akan terlihat seperti anjlok.
 *   - ARIMA tidak menangkap musiman: ACF di lag musiman diuji dan diberi
 *     peringatan kalau signifikan.
 */

import { ColProfile } from "./profile";
import { Analysis, aggregationFor, resolveTimeX, TimeAxis } from "./analyze";
import {
  acf,
  ARIMA_LIMITS,
  ArimaModel,
  arimaLabel,
  autoArima,
  differenceAll,
  DifferencingStep,
  forecastArima,
  isSeasonal,
  ljungBox,
  LjungBox,
  pacf,
} from "./arima";
import { compactNumber, linreg } from "./stats";

export type Granularity = "hari" | "hari kerja" | "minggu" | "bulan" | "kuartal" | "tahun" | "periode";

export type ForecastError = { rmse: number; mae: number; mape: number | null };

export type ForecastMethod = "arima" | "naive" | "snaive" | "linear";

/** Nama metode pembanding untuk teks. */
export function methodLabel(m: ForecastMethod, model = "ARIMA"): string {
  return m === "arima" ? model : m === "naive" ? "naif (nilai terakhir)" : m === "snaive" ? "naif musiman (nilai musim lalu)" : "regresi linear";
}

export type ForecastResult = {
  column: string;
  aggregation: "sum" | "mean";
  granularity: Granularity;
  /** Banyak periode reguler yang dimodelkan. */
  n: number;
  /** Riwayat untuk grafik (maks 120 periode terakhir). */
  history: { labels: string[]; values: number[] };
  future: { labels: string[]; mean: number[]; lower: number[]; upper: number[] };
  model: {
    label: string;
    p: number;
    d: number;
    q: number;
    constant: boolean;
    phi: number[];
    theta: number[];
    mu: number;
    sigma2: number;
    aicc: number;
    nEff: number;
    /** Garis tren OLS untuk model tren deterministik; null = tidak ada. Opsional: snapshot lama tidak punya. */
    trendLine?: { intercept: number; slope: number } | null;
    /** Bagian musiman (P, D, Q)_s & koefisien Φ, Θ. Opsional: snapshot lama / model non-musiman tidak punya. */
    P?: number;
    D?: number;
    Q?: number;
    s?: number;
    Phi?: number[];
    Theta?: number[];
  };
  identification: {
    /** Langkah uji KPSS: level per orde differencing, plus uji tren di deret asli. */
    kpss: DifferencingStep[];
    /** Periode musiman kandidat & kekuatan musiman F_s (null = tidak dihitung). Opsional untuk snapshot lama. */
    season?: { period: number; strength: number | null; differenced: boolean } | null;
    /** ACF & PACF deret yang dimodelkan ARMA (setelah difference / detrend; index 0 = lag 1). */
    acf: number[];
    pacf: number[];
    /** Batas signifikansi ±1,96/√n. */
    bound: number;
  };
  /** 5 kandidat AICc terbaik. */
  candidates: { label: string; aicc: number }[];
  diagnostics: {
    ljungBox: LjungBox | null;
    /** true = residual white noise (Ljung-Box p ≥ 0,05). null = tidak bisa diuji. */
    whiteNoise: boolean | null;
    residualAcf: number[];
    bound: number;
  };
  /** Uji di periode terakhir yang disembunyikan saat melatih model. */
  holdout: {
    h: number;
    model: string;
    arima: ForecastError;
    naive: ForecastError;
    /** Naif musiman: nilai periode yang sama satu musim sebelumnya (hanya data musiman). */
    seasonalNaive?: ForecastError | null;
    linear: ForecastError;
    best: ForecastMethod;
  } | null;
  seasonality: { period: number; acf: number; significant: boolean } | null;
  notes: string[];
};

export type ForecastBundle = {
  items: ForecastResult[];
  skipped: { column: string; reason: string }[];
};

export const FORECAST_LIMITS = {
  /** Minimal periode reguler supaya ARIMA + holdout masuk akal. */
  minPeriods: 20,
  /** Box-Jenkins menyarankan ≥ 50 observasi. */
  recommendedPeriods: 50,
  maxPeriods: 500,
  maxGapShare: 0.1,
  /** Periode tepi dengan cakupan hari < 80% dianggap belum lengkap. */
  minEdgeCoverage: 0.8,
  minTrain: 16,
  maxColumns: 3,
  historyPoints: 120,
};

// ============================================================
// DERET REGULER
// ============================================================

const DAY = 86_400_000;
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function dayLabel(day: number): string {
  const d = new Date(day * DAY);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Cara mengelompokkan epoch (ms, UTC) ke periode. key berurutan & berjarak 1. */
type Bucketer = {
  granularity: Granularity;
  period: number | null;
  /** null = observasi diabaikan (akhir pekan pada deret hari kerja). */
  key: (day: number) => number | null;
  startDay: (key: number) => number;
  days: (key: number) => number;
  label: (key: number) => string;
};

const ymd = (day: number) => {
  const d = new Date(day * DAY);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
};
const utcDay = (y: number, m: number) => Date.UTC(y, m, 1) / DAY;
/** 0 = Senin … 6 = Minggu (1 Jan 1970 = Kamis). */
const weekday = (day: number) => (((day + 3) % 7) + 7) % 7;

const BUCKETERS: Record<"day" | "bday" | "week" | "month" | "quarter" | "year", Bucketer> = {
  day: {
    granularity: "hari",
    period: 7,
    key: (day) => day,
    startDay: (k) => k,
    days: () => 1,
    label: dayLabel,
  },
  bday: {
    granularity: "hari kerja",
    period: 5,
    key: (day) => {
      const wd = weekday(day);
      return wd < 5 ? Math.floor((day + 3) / 7) * 5 + wd : null;
    },
    startDay: (k) => Math.floor(k / 5) * 7 - 3 + (k % 5),
    days: () => 1,
    label: (k) => dayLabel(Math.floor(k / 5) * 7 - 3 + (k % 5)),
  },
  week: {
    granularity: "minggu",
    period: 52,
    key: (day) => Math.floor((day + 3) / 7),
    startDay: (k) => k * 7 - 3,
    days: () => 7,
    label: (k) => `Mg ${dayLabel(k * 7 - 3)}`,
  },
  month: {
    granularity: "bulan",
    period: 12,
    key: (day) => {
      const { y, m } = ymd(day);
      return y * 12 + m;
    },
    startDay: (k) => utcDay(Math.floor(k / 12), k % 12),
    days: (k) => utcDay(Math.floor((k + 1) / 12), (k + 1) % 12) - utcDay(Math.floor(k / 12), k % 12),
    label: (k) => `${BULAN[k % 12]} ${Math.floor(k / 12)}`,
  },
  quarter: {
    granularity: "kuartal",
    period: 4,
    key: (day) => {
      const { y, m } = ymd(day);
      return y * 4 + Math.floor(m / 3);
    },
    startDay: (k) => utcDay(Math.floor(k / 4), (k % 4) * 3),
    days: (k) => utcDay(Math.floor((k + 1) / 4), ((k + 1) % 4) * 3) - utcDay(Math.floor(k / 4), (k % 4) * 3),
    label: (k) => `K${(k % 4) + 1} ${Math.floor(k / 4)}`,
  },
  year: {
    granularity: "tahun",
    period: null,
    key: (day) => ymd(day).y,
    startDay: (k) => utcDay(k, 0),
    days: (k) => utcDay(k + 1, 0) - utcDay(k, 0),
    label: (k) => String(k),
  },
};

export type RegularSeries = {
  values: number[];
  labels: string[];
  futureLabels: (h: number) => string[];
  granularity: Granularity;
  seasonalPeriod: number | null;
  /** Periode kosong yang diisi interpolasi linear. */
  filled: number;
  /** Label periode tepi yang dibuang karena belum lengkap. */
  droppedEdges: string[];
};

type Bucket = { s: number; c: number; days: Set<number> };

function bucketize(days: number[], ys: number[], b: Bucketer): Map<number, Bucket> {
  const m = new Map<number, Bucket>();
  for (let i = 0; i < days.length; i++) {
    const k = b.key(days[i]);
    if (k === null) continue;
    const cur = m.get(k);
    if (cur) {
      cur.s += ys[i];
      cur.c += 1;
      cur.days.add(days[i]);
    } else {
      m.set(k, { s: ys[i], c: 1, days: new Set([days[i]]) });
    }
  }
  return m;
}

/** Isi nilai NaN di tengah deret dengan interpolasi linear antar tetangga. */
function interpolate(v: number[]): number[] {
  const out = v.slice();
  let i = 0;
  while (i < out.length) {
    if (Number.isFinite(out[i])) {
      i++;
      continue;
    }
    const lo = i - 1;
    let hi = i;
    while (hi < out.length && !Number.isFinite(out[hi])) hi++;
    for (let j = i; j < hi; j++) out[j] = out[lo] + ((out[hi] - out[lo]) * (j - lo)) / (hi - lo);
    i = hi;
  }
  return out;
}

/** Bangun deret reguler dari Map key → bucket. */
function fromBuckets(
  m: Map<number, Bucket>,
  agg: "sum" | "mean",
  b: Pick<Bucketer, "granularity" | "period" | "label"> & Partial<Pick<Bucketer, "startDay" | "days">>,
  checkEdges: boolean,
): RegularSeries | null {
  const keys = Array.from(m.keys()).sort((a, c) => a - c);
  if (keys.length < 2) return null;
  let first = keys[0];
  let last = keys[keys.length - 1];
  const droppedEdges: string[] = [];

  // Periode tepi parsial — hanya relevan untuk metrik yang dijumlah dan data
  // yang lebih halus dari periodenya (banyak hari pengamatan per periode).
  if (checkEdges && agg === "sum" && b.startDay && b.days && keys.length >= 4) {
    const distinct = keys.map((k) => m.get(k)!.days.size).sort((a, c) => a - c);
    if (distinct[Math.floor(distinct.length / 2)] >= 3) {
      // Cakupan tepi dibandingkan dengan periode-periode di tengah — data yang
      // memang selalu jatuh di awal bulan (tgl 1–3) tidak boleh dianggap parsial.
      const cov = (k: number, edge: "first" | "last") => {
        const ds = Array.from(m.get(k)!.days);
        const start = b.startDay!(k);
        const len = b.days!(k);
        return edge === "first" ? (start + len - Math.min(...ds)) / len : (Math.max(...ds) - start + 1) / len;
      };
      const median = (v: number[]) => v.sort((a, c) => a - c)[Math.floor(v.length / 2)];
      const inner = keys.slice(1, -1);
      const typicalFirst = median(inner.map((k) => cov(k, "first")));
      const typicalLast = median(inner.map((k) => cov(k, "last")));
      if (cov(first, "first") < FORECAST_LIMITS.minEdgeCoverage * typicalFirst) {
        droppedEdges.push(b.label(first));
        first = keys[1];
      }
      if (last > first && cov(last, "last") < FORECAST_LIMITS.minEdgeCoverage * typicalLast) {
        droppedEdges.push(b.label(last));
        last = keys[keys.length - 2];
      }
    }
  }

  const raw: number[] = [];
  const labels: string[] = [];
  let filled = 0;
  for (let k = first; k <= last; k++) {
    const e = m.get(k);
    if (e) raw.push(agg === "sum" ? e.s : e.s / e.c);
    else {
      raw.push(NaN);
      filled++;
    }
    labels.push(b.label(k));
  }
  return {
    values: interpolate(raw),
    labels,
    futureLabels: (h) => Array.from({ length: h }, (_, i) => b.label(last + 1 + i)),
    granularity: b.granularity,
    seasonalPeriod: b.period,
    filled,
    droppedEdges,
  };
}

const gapShare = (m: Map<number, Bucket>) => {
  const keys = Array.from(m.keys());
  if (keys.length < 2) return 1;
  const span = Math.max(...keys) - Math.min(...keys) + 1;
  return 1 - keys.length / span;
};
const spanOf = (m: Map<number, Bucket>) => {
  const keys = Array.from(m.keys());
  return keys.length ? Math.max(...keys) - Math.min(...keys) + 1 : 0;
};

/**
 * Deret reguler dari (x, y) per baris. Mengembalikan alasan kalau tidak bisa.
 */
export function regularize(
  xRow: number[],
  yRow: number[],
  kind: TimeAxis["kind"],
  agg: "sum" | "mean",
): RegularSeries | { reason: string } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(xRow.length, yRow.length); i++) {
    if (Number.isFinite(xRow[i]) && Number.isFinite(yRow[i])) {
      xs.push(xRow[i]);
      ys.push(yRow[i]);
    }
  }
  if (xs.length < 2) return { reason: "data waktu terlalu sedikit" };

  if (kind !== "epoch") {
    // Tahun / tahun-bulan / bulan: x sudah berupa indeks periode berjarak 1.
    const BUL = (k: number) => `${BULAN[((k % 12) + 12) % 12]} ${Math.floor(k / 12)}`;
    const spec =
      kind === "year"
        ? { granularity: "tahun" as const, period: null, label: (k: number) => String(k) }
        : kind === "yearMonth"
          ? { granularity: "bulan" as const, period: 12, label: BUL }
          : { granularity: "bulan" as const, period: null, label: (k: number) => BULAN[(k - 1 + 12) % 12] ?? String(k) };
    const m = new Map<number, Bucket>();
    xs.forEach((x, i) => {
      const k = Math.round(x);
      const cur = m.get(k);
      if (cur) {
        cur.s += ys[i];
        cur.c++;
      } else m.set(k, { s: ys[i], c: 1, days: new Set() });
    });
    if (gapShare(m) > FORECAST_LIMITS.maxGapShare) return { reason: "terlalu banyak periode kosong di sumbu waktu" };
    return fromBuckets(m, agg, spec, false) ?? { reason: "data waktu terlalu sedikit" };
  }

  // Epoch: pilih granularitas terhalus yang cukup rapat.
  const days = xs.map((x) => Math.floor(x / DAY));
  for (const id of ["day", "week", "month", "quarter", "year"] as const) {
    let b = BUCKETERS[id];
    let m = bucketize(days, ys, b);
    if (id === "day" && gapShare(m) > FORECAST_LIMITS.maxGapShare) {
      // Hampir tidak ada data akhir pekan → deret hari kerja (pola data bursa).
      const weekend = days.filter((d) => weekday(d) >= 5).length / days.length;
      if (weekend <= 0.02) {
        b = BUCKETERS.bday;
        m = bucketize(days, ys, b);
      }
    }
    if (gapShare(m) <= FORECAST_LIMITS.maxGapShare && spanOf(m) <= FORECAST_LIMITS.maxPeriods) {
      return fromBuckets(m, agg, b, true) ?? { reason: "data waktu terlalu sedikit" };
    }
  }
  return { reason: "periode waktu tidak teratur (terlalu banyak periode kosong)" };
}

// ============================================================
// PERSAMAAN MODEL
// ============================================================

const SUP_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];
const superscript = (k: number) =>
  String(k)
    .split("")
    .map((ch) => SUP_DIGITS[Number(ch)])
    .join("");

/**
 * Bentuk operator backshift:
 *   φ(B)Φ(B^s)(1−B)^d(1−B^s)^D yₜ = c + θ(B)Θ(B^s) eₜ, dengan c = μ(1 − Σφ)(1 − ΣΦ).
 * `ascii` untuk PDF (font bawaan jsPDF tidak punya −, ², ₜ).
 */
export function arimaEquation(m: ForecastResult["model"], ascii = false): string {
  const minus = ascii ? "-" : "−";
  const pow = (k: number) => (k === 1 ? "" : ascii ? `^${k}` : superscript(k));
  const sub = ascii ? "_t" : "ₜ";
  const coef = (v: number) => Math.abs(v).toFixed(3);
  const s = m.s ?? 0;
  const factor = (c: number[], lag: number, arSign: boolean) =>
    c.length
      ? `(1 ${c.map((v, i) => `${(v >= 0) === arSign ? minus : "+"} ${coef(v)}B${pow((i + 1) * lag)}`).join(" ")})`
      : "";
  const ar = factor(m.phi, 1, true) + factor(m.Phi ?? [], s, true);
  const ma = factor(m.theta, 1, false) + factor(m.Theta ?? [], s, false);
  const diff =
    (m.d === 0 ? "" : `(1 ${minus} B)${pow(m.d)}`) +
    (s && (m.D ?? 0) > 0 ? `(1 ${minus} B${pow(s)})${(m.D ?? 0) > 1 ? pow(m.D!) : ""}` : "");
  if (m.trendLine) {
    // Tren deterministik: y = a + b·t + N, dengan N mengikuti ARMA.
    const { intercept, slope } = m.trendLine;
    const sign = slope >= 0 ? "+" : minus;
    const times = ascii ? "*" : "·";
    const arma = `${ar}N${sub} = ${ma}e${sub}`;
    return `y${sub} = ${compactNumber(intercept)} ${sign} ${compactNumber(Math.abs(slope))}${times}t + N${sub};  ${arma}`;
  }
  const c =
    m.mu * (1 - m.phi.reduce((a, v) => a + v, 0)) * (1 - (m.Phi ?? []).reduce((a, v) => a + v, 0));
  const right = `${m.constant ? `${compactNumber(c)} + ` : ""}${ma}e${sub}`;
  return `${ar}${diff}y${sub} = ${right}`;
}

/** Label baris uji KPSS untuk tabel identifikasi. */
export function kpssStepLabel(k: DifferencingStep): string {
  if (k.test === "trend") return "asli, di sekitar tren";
  if (k.D) return k.d === 0 ? "difference musiman" : `difference musiman + ke-${k.d}`;
  return k.d === 0 ? "asli" : `difference ke-${k.d}`;
}

/** Kesimpulan tahap identifikasi dalam satu kalimat. */
export function identificationText(
  m: ForecastResult["model"],
  season?: ForecastResult["identification"]["season"],
): string {
  const parts: string[] = [];
  if (season && season.strength !== null) {
    const fs = season.strength.toFixed(2);
    parts.push(
      season.differenced
        ? `Kekuatan musiman F_s = ${fs} > 0,64 → difference musiman lag ${season.period} (D = 1).`
        : `Kekuatan musiman F_s = ${fs} ≤ 0,64 → tanpa difference musiman.`,
    );
  }
  if (m.trendLine) {
    parts.push("Deret stasioner di sekitar tren linear (tren deterministik) → tidak di-difference; tren dimodelkan sebagai garis + ARMA.");
  } else {
    const after = m.D ? "difference musiman" : "deret asli";
    parts.push(m.d === 0 ? `Setelah ${after}, deret sudah stasioner → d = 0.` : `Deret stasioner setelah ${m.d}× difference biasa → d = ${m.d}.`);
  }
  return parts.join(" ");
}

// ============================================================
// METRIK AKURASI
// ============================================================

export function forecastErrors(actual: number[], pred: number[]): ForecastError {
  const n = actual.length;
  let se = 0;
  let ae = 0;
  let ape = 0;
  let mapeOk = true;
  for (let i = 0; i < n; i++) {
    const e = actual[i] - pred[i];
    se += e * e;
    ae += Math.abs(e);
    if (Math.abs(actual[i]) < 1e-9) mapeOk = false;
    else ape += Math.abs(e / actual[i]);
  }
  return { rmse: Math.sqrt(se / n), mae: ae / n, mape: mapeOk ? (ape / n) * 100 : null };
}

/** Kriteria MAPE Lewis (1982) — lazim dipakai di mata kuliah peramalan. */
export function mapeLabel(mape: number): string {
  if (mape < 10) return "sangat akurat";
  if (mape < 20) return "baik";
  if (mape < 50) return "wajar";
  return "tidak akurat";
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Evaluasi holdout: model dilatih tanpa h periode terakhir lalu meramal h
 * periode itu. Pembanding: naif, regresi linear, dan — untuk data musiman —
 * naif musiman (nilai periode yang sama satu musim sebelumnya).
 */
export function holdoutEvaluate(y: number[], s: number | null = null): ForecastResult["holdout"] {
  const n = y.length;
  let h = clamp(Math.round(n * 0.2), 3, 12);
  if (n - h < FORECAST_LIMITS.minTrain) h = n - FORECAST_LIMITS.minTrain;
  if (h < 3) return null;
  const train = y.slice(0, n - h);
  const test = y.slice(n - h);

  const auto = autoArima(train, { s });
  if (!auto) return null;
  const fa = forecastArima(train, auto.model, h).mean;
  const naive = new Array<number>(h).fill(train[train.length - 1]);
  const t = train.map((_, i) => i);
  const lr = linreg(t, train);
  const linear = test.map((_, i) => lr.intercept + lr.slope * (train.length + i));
  const snaive =
    s && s >= 2 && train.length >= s ? test.map((_, j) => train[train.length - s + (j % s)]) : null;

  const errors: Record<ForecastMethod, ForecastError | null> = {
    arima: forecastErrors(test, fa),
    naive: forecastErrors(test, naive),
    snaive: snaive ? forecastErrors(test, snaive) : null,
    linear: forecastErrors(test, linear),
  };
  // Seri dimenangkan ARIMA (urutan prioritas).
  const best = (["arima", "snaive", "naive", "linear"] as const)
    .filter((k) => errors[k])
    .reduce((a, b) => (errors[b]!.rmse < errors[a]!.rmse ? b : a));
  return {
    h,
    model: arimaLabel(auto.model),
    arima: errors.arima!,
    naive: errors.naive!,
    seasonalNaive: errors.snaive,
    linear: errors.linear!,
    best,
  };
}

// ============================================================
// PIPELINE PER KOLOM
// ============================================================

function modelSummary(m: ArimaModel): ForecastResult["model"] {
  return {
    label: arimaLabel(m),
    p: m.p,
    d: m.d,
    q: m.q,
    constant: m.constant,
    phi: m.phi,
    theta: m.theta,
    mu: m.mu,
    sigma2: m.sigma2,
    aicc: m.aicc,
    nEff: m.nEff,
    trendLine: m.trendLine ?? null,
    ...(isSeasonal(m) ? { P: m.P, D: m.D, Q: m.Q, s: m.s, Phi: m.Phi, Theta: m.Theta } : {}),
  };
}

export function forecastSeries(
  column: string,
  series: RegularSeries,
  agg: "sum" | "mean",
): ForecastResult | { reason: string } {
  const y = series.values;
  const n = y.length;
  if (n < FORECAST_LIMITS.minPeriods) {
    return { reason: `ARIMA butuh minimal ${FORECAST_LIMITS.minPeriods} periode (tersedia ${n} ${series.granularity})` };
  }
  const s = series.seasonalPeriod;
  const auto = autoArima(y, { s });
  if (!auto) return { reason: "model ARIMA tidak bisa diestimasi" };
  const m = auto.model;
  const seasonalModel = isSeasonal(m);

  const h = clamp(Math.round(n / 6), 3, 12);
  const fc = forecastArima(y, m, h);

  // Identifikasi: ACF/PACF deret yang sudah stasioner.
  // Deret yang dimodelkan ARMA: hasil detrend (tren deterministik) atau difference (biasa + musiman).
  const w = m.trendLine
    ? y.map((v, t) => v - m.trendLine!.intercept - m.trendLine!.slope * t)
    : differenceAll(y, m.d, m.D ?? 0, m.s ?? 0);
  // Lag korelogram mencakup dua musim kalau ada periode musiman (lag s & 2s terlihat).
  const wantLags = s && s <= ARIMA_LIMITS.maxSeasonalPeriod ? Math.max(20, 2 * s) : 20;
  const K = Math.min(wantLags, Math.max(4, Math.floor(w.length / 3)));
  const bound = 1.96 / Math.sqrt(w.length);

  // Diagnostik residual (Ljung-Box lag 2s untuk data musiman, 10 untuk lainnya; df dikurangi semua parameter ARMA).
  const lbLags = Math.min(s && s <= ARIMA_LIMITS.maxSeasonalPeriod ? 2 * s : 10, Math.floor(m.residuals.length / 5));
  const lb = ljungBox(m.residuals, lbLags, m.p + m.q + m.Phi.length + m.Theta.length);
  const resBound = 1.96 / Math.sqrt(m.residuals.length);

  // Sisa musiman: ACF positif signifikan di lag musiman deret yang dimodelkan (butuh ≥ 3 siklus).
  let seasonality: ForecastResult["seasonality"] = null;
  if (s && w.length >= 3 * s) {
    const r = acf(w, s)[s - 1];
    seasonality = { period: s, acf: r, significant: r > bound };
  }

  const holdout = holdoutEvaluate(y, s);

  const notes: string[] = [];
  if (series.droppedEdges.length) {
    notes.push(`Periode belum lengkap tidak diikutkan: ${series.droppedEdges.join(", ")}.`);
  }
  if (series.filled > 0) notes.push(`${series.filled} periode kosong diisi interpolasi linear.`);
  if (n < FORECAST_LIMITS.recommendedPeriods) {
    notes.push(`Box-Jenkins menyarankan ≥ ${FORECAST_LIMITS.recommendedPeriods} observasi; dengan ${n} periode estimasi kurang stabil.`);
  }
  if (seasonality?.significant && !seasonalModel) {
    notes.push(
      s && s > ARIMA_LIMITS.maxSeasonalPeriod
        ? `ACF lag ${seasonality.period} signifikan (r = ${seasonality.acf.toFixed(2)}): ada pola musiman per ${seasonality.period} ${series.granularity}, tapi periode sepanjang ini belum dimodelkan (SARIMA dibatasi s ≤ ${ARIMA_LIMITS.maxSeasonalPeriod}). Coba agregasi bulanan.`
        : `ACF lag ${seasonality.period} signifikan (r = ${seasonality.acf.toFixed(2)}): ada pola musiman per ${seasonality.period} ${series.granularity} yang tidak tertangkap model — ramalan bisa meleset di puncak/lembah musim.`,
    );
  }
  if (lb && lb.pValue < 0.05) {
    notes.push(`Residual masih berpola (Ljung-Box p = ${lb.pValue.toFixed(3)}): model belum menangkap seluruh struktur, tafsirkan dengan hati-hati.`);
  }
  if (holdout && holdout.best !== "arima") {
    notes.push(`Pada ${holdout.h} periode uji, metode ${methodLabel(holdout.best)} lebih akurat dari ${seasonalModel ? "SARIMA" : "ARIMA"}.`);
  }
  if (m.d === 2) notes.push("d = 2: deret sangat tidak stasioner, rentang ramalan melebar cepat.");
  // Kandidat ber-AICc lebih baik yang ditolak karena akarnya di batas.
  const betterRejected = auto.rejected.filter((r) => r.aicc < m.aicc);
  if (betterRejected.some((r) => r.overDifferenced)) {
    notes.push(
      "Model dengan MA mendekati −1 (θ(1) ≈ 0) ditolak: indikasi over-differencing — deret kemungkinan stasioner di sekitar tren deterministik.",
    );
  } else if (betterRejected.length > 0) {
    notes.push(
      `${betterRejected.length} kandidat ber-AICc lebih kecil ditolak karena akar AR/MA terlalu dekat lingkaran satuan (|z| < 1,01) — estimasinya tidak stabil.`,
    );
  }

  const keep = Math.min(n, FORECAST_LIMITS.historyPoints);
  return {
    column,
    aggregation: agg,
    granularity: series.granularity,
    n,
    history: { labels: series.labels.slice(-keep), values: y.slice(-keep) },
    future: { labels: series.futureLabels(h), mean: fc.mean, lower: fc.lower, upper: fc.upper },
    model: modelSummary(m),
    identification: {
      kpss: auto.differencing.steps,
      season: auto.differencing.s
        ? { period: auto.differencing.s, strength: auto.differencing.seasonalStrength, differenced: auto.differencing.D > 0 }
        : null,
      acf: acf(w, K),
      pacf: pacf(w, K),
      bound,
    },
    candidates: auto.candidates.slice(0, 5).map((c) => ({ label: arimaLabel(c), aicc: c.aicc })),
    diagnostics: {
      ljungBox: lb,
      whiteNoise: lb ? lb.pValue >= 0.05 : null,
      residualAcf: acf(m.residuals, K),
      bound: resBound,
    },
    holdout,
    seasonality,
    notes,
  };
}

/**
 * Ramalan ARIMA untuk metrik utama yang punya sumbu waktu (maks 3 kolom).
 * null kalau dataset tidak berdimensi waktu.
 */
export function computeForecasts(analysis: Analysis, profiles: ColProfile[]): ForecastBundle | null {
  const axis = analysis.timeAxis;
  if (!axis) return null;
  const timeX = resolveTimeX(profiles, axis);
  const items: ForecastResult[] = [];
  const skipped: ForecastBundle["skipped"] = [];
  const columns = analysis.trends.map((t) => t.column).slice(0, FORECAST_LIMITS.maxColumns);
  for (const column of columns) {
    const prof = profiles.find((p) => p.name === column);
    if (!prof?.numericVector) continue;
    const agg = aggregationFor(prof);
    const series = regularize(timeX, prof.numericVector, axis.kind, agg);
    if ("reason" in series) {
      skipped.push({ column, reason: series.reason });
      continue;
    }
    const r = forecastSeries(column, series, agg);
    if ("reason" in r) skipped.push({ column, reason: r.reason });
    else items.push(r);
  }
  return { items, skipped };
}
