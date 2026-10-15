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
  ArimaModel,
  arimaLabel,
  autoArima,
  difference,
  DifferencingStep,
  forecastArima,
  ljungBox,
  LjungBox,
  pacf,
} from "./arima";
import { compactNumber, linreg } from "./stats";

export type Granularity = "hari" | "hari kerja" | "minggu" | "bulan" | "kuartal" | "tahun" | "periode";

export type ForecastError = { rmse: number; mae: number; mape: number | null };

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
  };
  identification: {
    /** Langkah uji KPSS: level per orde differencing, plus uji tren di deret asli. */
    kpss: DifferencingStep[];
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
    linear: ForecastError;
    best: "arima" | "naive" | "linear";
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

const SUP: Record<number, string> = { 2: "²", 3: "³", 4: "⁴" };

/**
 * Bentuk operator backshift: φ(B)(1−B)^d yₜ = c + θ(B) eₜ, dengan c = μ(1 − Σφ).
 * `ascii` untuk PDF (font bawaan jsPDF tidak punya −, ², ₜ).
 */
export function arimaEquation(m: ForecastResult["model"], ascii = false): string {
  const minus = ascii ? "-" : "−";
  const pow = (k: number) => (k === 1 ? "" : ascii ? `^${k}` : (SUP[k] ?? `^${k}`));
  const sub = ascii ? "_t" : "ₜ";
  const coef = (v: number) => Math.abs(v).toFixed(3);
  const ar = m.phi.map((v, i) => `${v >= 0 ? minus : "+"} ${coef(v)}B${pow(i + 1)}`).join(" ");
  const ma = m.theta.map((v, i) => `${v >= 0 ? "+" : minus} ${coef(v)}B${pow(i + 1)}`).join(" ");
  const diff = m.d === 0 ? "" : `(1 ${minus} B)${pow(m.d)}`;
  if (m.trendLine) {
    // Tren deterministik: y = a + b·t + N, dengan N mengikuti ARMA.
    const { intercept, slope } = m.trendLine;
    const sign = slope >= 0 ? "+" : minus;
    const times = ascii ? "*" : "·";
    const arma = `${ar ? `(1 ${ar})` : ""}N${sub} = ${ma ? `(1 ${ma})` : ""}e${sub}`;
    return `y${sub} = ${compactNumber(intercept)} ${sign} ${compactNumber(Math.abs(slope))}${times}t + N${sub};  ${arma}`;
  }
  const c = m.mu * (1 - m.phi.reduce((a, v) => a + v, 0));
  const left = `${ar ? `(1 ${ar})` : ""}${diff}y${sub}`;
  const right = `${m.constant ? `${compactNumber(c)} + ` : ""}${ma ? `(1 ${ma})` : ""}e${sub}`;
  return `${left} = ${right}`;
}

/** Label baris uji KPSS untuk tabel identifikasi. */
export function kpssStepLabel(k: DifferencingStep): string {
  if (k.test === "trend") return "asli, di sekitar tren";
  return k.d === 0 ? "asli" : `difference ke-${k.d}`;
}

/** Kesimpulan tahap identifikasi dalam satu kalimat. */
export function identificationText(m: ForecastResult["model"]): string {
  if (m.trendLine) {
    return "Deret stasioner di sekitar tren linear (tren deterministik) → tidak di-difference; tren dimodelkan sebagai garis + ARMA.";
  }
  return m.d === 0 ? "Deret asli sudah stasioner → d = 0." : `Deret stasioner setelah ${m.d}× difference → d = ${m.d}.`;
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

/** Evaluasi holdout: model dilatih tanpa h periode terakhir lalu meramal h periode itu. */
export function holdoutEvaluate(y: number[]): ForecastResult["holdout"] {
  const n = y.length;
  let h = clamp(Math.round(n * 0.2), 3, 12);
  if (n - h < FORECAST_LIMITS.minTrain) h = n - FORECAST_LIMITS.minTrain;
  if (h < 3) return null;
  const train = y.slice(0, n - h);
  const test = y.slice(n - h);

  const auto = autoArima(train);
  if (!auto) return null;
  const fa = forecastArima(train, auto.model, h).mean;
  const naive = new Array<number>(h).fill(train[train.length - 1]);
  const t = train.map((_, i) => i);
  const lr = linreg(t, train);
  const linear = test.map((_, i) => lr.intercept + lr.slope * (train.length + i));

  const arima = forecastErrors(test, fa);
  const nv = forecastErrors(test, naive);
  const ln = forecastErrors(test, linear);
  const best = arima.rmse <= nv.rmse && arima.rmse <= ln.rmse ? "arima" : nv.rmse <= ln.rmse ? "naive" : "linear";
  return { h, model: arimaLabel(auto.model), arima, naive: nv, linear: ln, best };
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
  const auto = autoArima(y);
  if (!auto) return { reason: "model ARIMA tidak bisa diestimasi" };
  const m = auto.model;

  const h = clamp(Math.round(n / 6), 3, 12);
  const fc = forecastArima(y, m, h);

  // Identifikasi: ACF/PACF deret yang sudah stasioner.
  // Deret yang dimodelkan ARMA: hasil detrend (tren deterministik) atau difference.
  const w = m.trendLine
    ? y.map((v, t) => v - m.trendLine!.intercept - m.trendLine!.slope * t)
    : difference(y, m.d);
  const K = Math.min(20, Math.max(4, Math.floor(w.length / 4)));
  const bound = 1.96 / Math.sqrt(w.length);

  // Diagnostik residual.
  const s = series.seasonalPeriod;
  const lbLags = Math.min(s && s <= 24 ? 2 * s : 10, Math.floor(m.residuals.length / 5));
  const lb = ljungBox(m.residuals, lbLags, m.p + m.q);
  const resBound = 1.96 / Math.sqrt(m.residuals.length);

  // Musiman: ACF positif signifikan di lag musiman (butuh ≥ 3 siklus).
  let seasonality: ForecastResult["seasonality"] = null;
  if (s && w.length >= 3 * s) {
    const r = acf(w, s)[s - 1];
    seasonality = { period: s, acf: r, significant: r > bound };
  }

  const holdout = holdoutEvaluate(y);

  const notes: string[] = [];
  if (series.droppedEdges.length) {
    notes.push(`Periode belum lengkap tidak diikutkan: ${series.droppedEdges.join(", ")}.`);
  }
  if (series.filled > 0) notes.push(`${series.filled} periode kosong diisi interpolasi linear.`);
  if (n < FORECAST_LIMITS.recommendedPeriods) {
    notes.push(`Box-Jenkins menyarankan ≥ ${FORECAST_LIMITS.recommendedPeriods} observasi; dengan ${n} periode estimasi kurang stabil.`);
  }
  if (seasonality?.significant) {
    notes.push(
      `ACF lag ${seasonality.period} signifikan (r = ${seasonality.acf.toFixed(2)}): ada pola musiman per ${seasonality.period} ${series.granularity}. ARIMA non-musiman tidak menangkapnya — ramalan bisa meleset di puncak/lembah musim.`,
    );
  }
  if (lb && lb.pValue < 0.05) {
    notes.push(`Residual masih berpola (Ljung-Box p = ${lb.pValue.toFixed(3)}): model belum menangkap seluruh struktur, tafsirkan dengan hati-hati.`);
  }
  if (holdout && holdout.best !== "arima") {
    notes.push(
      `Pada ${holdout.h} periode uji, metode ${holdout.best === "naive" ? "naif (nilai terakhir)" : "regresi linear"} lebih akurat dari ARIMA.`,
    );
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
    identification: { kpss: auto.differencing.steps, acf: acf(w, K), pacf: pacf(w, K), bound },
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
