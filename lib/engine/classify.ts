/**
 * Klasifikasi: Decision Tree (CART, Gini) + Naive Bayes, dibandingkan dengan
 * baseline kelas mayoritas — dihitung 100% di browser.
 *
 *   - Target: kolom kategorikal 2–10 kelas (dari arahan user atau nama yang
 *     jelas seperti churn/status/lulus). Kalau tidak jelas → tidak menebak.
 *   - Data dibagi stratified 70/30 (seed tetap). Imputasi median & level
 *     "(kosong)" dihitung dari data latih saja (tanpa kebocoran ke data uji).
 *   - Kedalaman pohon dipilih dengan 5-fold CV + aturan 1-SE (seperti rpart):
 *     pohon paling sederhana yang skornya masih dalam 1 standard error dari
 *     yang terbaik. Skor = balanced accuracy supaya kelas minoritas tidak
 *     diabaikan.
 *   - Evaluasi di data uji: confusion matrix, precision/recall/F1 per kelas,
 *     balanced accuracy, AUC (biner), dan uji McNemar pohon vs Naive Bayes.
 */

import { ColProfile } from "./profile";
import { isNumericType, ParsedRow } from "./parse";
import { ParsedIntent } from "./intent";
import { chiSquareSurvival, compactNumber, systematicSample } from "./stats";
import { mulberry32 } from "./multivariate";

// ============================================================
// TIPE
// ============================================================

export type ModelEval = {
  accuracy: number;
  balancedAccuracy: number;
  macroF1: number;
  /** AUC kelas positif (hanya biner). */
  auc: number | null;
  /** confusion[aktual][prediksi], urutan kelas = `classes`. */
  confusion: number[][];
  perClass: { label: string; precision: number; recall: number; f1: number; support: number }[];
};

export type TreeRule = { conditions: string[]; prediction: string; n: number; confidence: number };

export type ClassificationResult = {
  target: string;
  classes: { label: string; count: number }[];
  n: number;
  nTrain: number;
  nTest: number;
  features: { name: string; kind: "numeric" | "categorical" }[];
  excluded: { column: string; reason: string }[];
  /** Kelas positif untuk AUC (kelas minoritas) — hanya biner. */
  positiveClass: string | null;
  tree: ModelEval & {
    depth: number;
    leaves: number;
    cv: { depth: number; mean: number; se: number }[];
    rules: TreeRule[];
    importance: { feature: string; value: number }[];
  };
  naiveBayes: ModelEval;
  baseline: ModelEval & { majority: string };
  best: "tree" | "naiveBayes" | "baseline";
  /** Uji McNemar pohon vs Naive Bayes di data uji (b = hanya pohon benar, c = hanya NB benar). */
  mcnemar: { b: number; c: number; stat: number | null; pValue: number; exact: boolean } | null;
  notes: string[];
};

export type ClassificationBundle = {
  result: ClassificationResult | null;
  /** Kolom yang bisa dijadikan target (2–10 kelas). */
  candidates: string[];
  /** Alasan kalau tidak dihitung. */
  reason: string | null;
};

export const CLASSIFY_LIMITS = {
  minClasses: 2,
  maxClasses: 10,
  /** Kelas dengan baris lebih sedikit dari ini dibuang (tidak bisa dibagi & dievaluasi). */
  minPerClass: 5,
  minRows: 40,
  maxRows: 5000,
  maxFeatures: 20,
  maxCategoryLevels: 12,
  testShare: 0.3,
  folds: 5,
  /** Kedalaman kandidat; 0 = tanpa split (tebak kelas mayoritas), seperti akar pohon di rpart. */
  depths: [0, 1, 2, 3, 4, 5],
  bins: 32,
  maxRules: 8,
  seed: 42,
};

const CLASS_HINTS = [
  "churn", "status", "label", "class", "kelas", "target", "outcome", "hasil", "result",
  "diagnosis", "diagnosa", "lulus", "kelulusan", "approved", "approval", "disetujui", "default",
  "fraud", "penipuan", "survived", "selamat", "attrition", "resign", "cancel", "batal",
  "purchased", "converted", "konversi", "spam", "risk", "risiko", "grade", "segment", "tier",
];

// ============================================================
// TARGET
// ============================================================

const tokens = (name: string) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Kolom yang layak jadi target klasifikasi: 2–10 kelas, bukan ID/waktu. */
export function classTargetCandidates(profiles: ColProfile[]): string[] {
  return profiles
    .filter((p) => {
      if (p.isLikelyId || p.timeKind) return false;
      const binaryInt = p.type === "integer" && p.unique === 2;
      if (!(p.type === "categorical" || p.type === "boolean" || binaryInt)) return false;
      return p.unique >= CLASSIFY_LIMITS.minClasses && p.unique <= CLASSIFY_LIMITS.maxClasses;
    })
    .map((p) => p.name);
}

/**
 * Target otomatis: kolom yang disebut user (kalau layak), lalu kolom dengan
 * nama khas target. null kalau tidak ada yang jelas — lebih baik tidak
 * menebak daripada mengklasifikasi kolom sembarangan.
 */
export function pickClassTarget(profiles: ColProfile[], intent: ParsedIntent | null): string | null {
  const cands = classTargetCandidates(profiles);
  const focused = intent?.focusColumns.find((c) => cands.includes(c));
  if (focused) return focused;
  return cands.find((c) => tokens(c).some((t) => CLASS_HINTS.includes(t))) ?? null;
}

// ============================================================
// UTIL
// ============================================================

const labelOf = (v: ParsedRow[string]): string | null =>
  v === null || v === undefined || v === "" ? null : String(v);

/** Pembagian stratified: tiap kelas diacak (seed) lalu ~testShare masuk data uji. */
export function stratifiedSplit(y: number[], testShare: number, seed: number): { train: number[]; test: number[] } {
  const rand = mulberry32(seed);
  const byClass = new Map<number, number[]>();
  y.forEach((c, i) => byClass.set(c, [...(byClass.get(c) ?? []), i]));
  const train: number[] = [];
  const test: number[] = [];
  for (const idx of byClass.values()) {
    const shuffled = shuffle(idx, rand);
    const nTest = Math.max(1, Math.round(shuffled.length * testShare));
    test.push(...shuffled.slice(0, nTest));
    train.push(...shuffled.slice(nTest));
  }
  return { train: train.sort((a, b) => a - b), test: test.sort((a, b) => a - b) };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fold stratified untuk cross-validation. */
export function stratifiedFolds(y: number[], k: number, seed: number): number[][] {
  const rand = mulberry32(seed);
  const folds: number[][] = Array.from({ length: k }, () => []);
  const byClass = new Map<number, number[]>();
  y.forEach((c, i) => byClass.set(c, [...(byClass.get(c) ?? []), i]));
  let offset = 0;
  for (const idx of byClass.values()) {
    shuffle(idx, rand).forEach((i, j) => folds[(j + offset) % k].push(i));
    offset += idx.length;
  }
  return folds;
}

// ============================================================
// METRIK
// ============================================================

export function evaluate(actual: number[], pred: number[], K: number, labels: string[], probs?: number[][], positive?: number): ModelEval {
  const confusion = Array.from({ length: K }, () => new Array<number>(K).fill(0));
  actual.forEach((a, i) => confusion[a][pred[i]]++);
  const n = actual.length;
  let correct = 0;
  for (let c = 0; c < K; c++) correct += confusion[c][c];
  const perClass = labels.map((label, c) => {
    const tp = confusion[c][c];
    const support = confusion[c].reduce((s, v) => s + v, 0);
    const predicted = confusion.reduce((s, row) => s + row[c], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, precision, recall, f1, support };
  });
  const present = perClass.filter((p) => p.support > 0);
  const auc = K === 2 && probs && positive !== undefined ? aucScore(actual, probs.map((p) => p[positive]), positive) : null;
  return {
    accuracy: n ? correct / n : 0,
    balancedAccuracy: present.length ? present.reduce((s, p) => s + p.recall, 0) / present.length : 0,
    macroF1: present.length ? present.reduce((s, p) => s + p.f1, 0) / present.length : 0,
    auc,
    confusion,
    perClass,
  };
}

/** AUC = P(skor positif > skor negatif), seri dihitung ½ (Mann-Whitney). */
export function aucScore(actual: number[], score: number[], positive: number): number | null {
  const pos: number[] = [];
  const neg: number[] = [];
  actual.forEach((a, i) => (a === positive ? pos : neg).push(score[i]));
  if (!pos.length || !neg.length) return null;
  // Rank-sum dengan rata-rata rank untuk nilai seri.
  const all = [...pos.map((s) => ({ s, p: true })), ...neg.map((s) => ({ s, p: false }))].sort((a, b) => a.s - b.s);
  let rankSumPos = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].s === all[i].s) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (all[k].p) rankSumPos += avgRank;
    i = j + 1;
  }
  return (rankSumPos - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

/**
 * Uji McNemar: apakah dua model berbeda akurasinya pada data uji yang sama.
 * b = hanya model A benar, c = hanya model B benar. b + c < 25 → uji binomial
 * eksak; selain itu χ² dengan koreksi kontinuitas (df 1).
 */
export function mcnemarTest(b: number, c: number): { b: number; c: number; stat: number | null; pValue: number; exact: boolean } {
  const n = b + c;
  if (n === 0) return { b, c, stat: null, pValue: 1, exact: true };
  if (n < 25) {
    // P = 2 · Σ_{k ≤ min(b,c)} C(n,k) / 2^n, dihitung dengan log supaya stabil.
    const k0 = Math.min(b, c);
    let logC = 0; // log C(n, 0)
    let tail = 0;
    for (let k = 0; k <= k0; k++) {
      if (k > 0) logC += Math.log((n - k + 1) / k);
      tail += Math.exp(logC - n * Math.LN2);
    }
    return { b, c, stat: null, pValue: Math.min(1, 2 * tail), exact: true };
  }
  const stat = (Math.abs(b - c) - 1) ** 2 / n;
  return { b, c, stat, pValue: chiSquareSurvival(stat, 1), exact: false };
}

// ============================================================
// DATA TERKODE
// ============================================================

type Encoded = {
  features: { name: string; kind: "numeric" | "categorical"; levels: string[] }[];
  /** cols[f][i] = nilai numerik (sudah diimputasi) atau kode level (kategorikal). */
  cols: Float64Array[];
};

/**
 * Kode fitur. Statistik imputasi & daftar level diambil dari baris LATIH saja;
 * level yang tidak pernah muncul di data latih → kode "(lainnya)".
 */
function encode(rows: ParsedRow[], feats: { name: string; kind: "numeric" | "categorical" }[], trainIdx: number[]): Encoded {
  const cols: Float64Array[] = [];
  const features: Encoded["features"] = [];
  for (const f of feats) {
    const col = new Float64Array(rows.length);
    if (f.kind === "numeric") {
      const vals = trainIdx
        .map((i) => rows[i][f.name])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        .sort((a, b) => a - b);
      const median = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
      rows.forEach((r, i) => {
        const v = r[f.name];
        col[i] = typeof v === "number" && Number.isFinite(v) ? v : median;
      });
      features.push({ name: f.name, kind: "numeric", levels: [] });
    } else {
      const counts = new Map<string, number>();
      for (const i of trainIdx) {
        const l = labelOf(rows[i][f.name]) ?? "(kosong)";
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      const levels = Array.from(counts.keys()).sort((a, b) => counts.get(b)! - counts.get(a)!);
      const other = levels.length; // kode untuk level tak dikenal
      rows.forEach((r, i) => {
        const l = labelOf(r[f.name]) ?? "(kosong)";
        const k = levels.indexOf(l);
        col[i] = k >= 0 ? k : other;
      });
      features.push({ name: f.name, kind: "categorical", levels: [...levels, "(lainnya)"] });
    }
    cols.push(col);
  }
  return { features, cols };
}

// ============================================================
// DECISION TREE (CART, Gini)
// ============================================================

export type TreeNode =
  | { leaf: true; counts: number[]; n: number }
  | {
      leaf: false;
      counts: number[];
      n: number;
      feature: number;
      /** numerik: kiri = x ≤ threshold; kategorikal: kiri = (kode == level). */
      threshold?: number;
      level?: number;
      left: TreeNode;
      right: TreeNode;
    };

export function gini(counts: number[], n: number): number {
  if (n === 0) return 0;
  let s = 0;
  for (const c of counts) s += (c / n) ** 2;
  return 1 - s;
}

const argmax = (v: number[]) => v.reduce((best, x, i) => (x > v[best] ? i : best), 0);

/** Ambang kandidat per fitur numerik: kuantil unik data latih (≤ bins), x ≤ ambang. */
function thresholdsFor(col: Float64Array, idx: number[], bins: number): number[] {
  const vals = idx.map((i) => col[i]).sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const v of vals) if (!uniq.length || uniq[uniq.length - 1] !== v) uniq.push(v);
  if (uniq.length <= 1) return [];
  if (uniq.length <= bins) return uniq.slice(0, -1);
  const out: number[] = [];
  for (let k = 1; k < bins; k++) {
    const q = vals[Math.floor((k / bins) * (vals.length - 1))];
    if (q < uniq[uniq.length - 1] && (!out.length || out[out.length - 1] !== q)) out.push(q);
  }
  return out;
}

export function buildTree(
  enc: Encoded,
  y: number[],
  idx: number[],
  K: number,
  opts: { maxDepth: number; minLeaf: number },
  importance?: number[],
): TreeNode {
  const thresholds = enc.features.map((f, j) =>
    f.kind === "numeric" ? thresholdsFor(enc.cols[j], idx, CLASSIFY_LIMITS.bins) : [],
  );
  const grow = (rows: number[], depth: number): TreeNode => {
    const counts = new Array<number>(K).fill(0);
    for (const i of rows) counts[y[i]]++;
    const n = rows.length;
    const imp = gini(counts, n);
    if (depth >= opts.maxDepth || imp === 0 || n < 2 * opts.minLeaf) return { leaf: true, counts, n };

    let best: { gain: number; feature: number; threshold?: number; level?: number } | null = null;
    enc.features.forEach((f, j) => {
      const col = enc.cols[j];
      if (f.kind === "numeric") {
        const th = thresholds[j];
        if (!th.length) return;
        // Histogram kelas per bin (bin = banyak ambang < x) lalu kumulatif.
        const hist = Array.from({ length: th.length + 1 }, () => new Array<number>(K).fill(0));
        for (const i of rows) {
          const x = col[i];
          let lo = 0;
          let hi = th.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (th[mid] < x) lo = mid + 1;
            else hi = mid;
          }
          hist[lo][y[i]]++;
        }
        const left = new Array<number>(K).fill(0);
        let nl = 0;
        for (let t = 0; t < th.length; t++) {
          for (let c = 0; c < K; c++) {
            left[c] += hist[t][c];
            nl += hist[t][c];
          }
          const nr = n - nl;
          if (nl < opts.minLeaf || nr < opts.minLeaf) continue;
          const right = counts.map((c, k) => c - left[k]);
          const gain = imp - (nl / n) * gini(left, nl) - (nr / n) * gini(right, nr);
          if (!best || gain > best.gain + 1e-12) best = { gain, feature: j, threshold: th[t] };
        }
      } else {
        const L = f.levels.length;
        const byLevel = Array.from({ length: L }, () => new Array<number>(K).fill(0));
        for (const i of rows) byLevel[col[i]][y[i]]++;
        for (let l = 0; l < L; l++) {
          const left = byLevel[l];
          const nl = left.reduce((s, v) => s + v, 0);
          const nr = n - nl;
          if (nl < opts.minLeaf || nr < opts.minLeaf) continue;
          const right = counts.map((c, k) => c - left[k]);
          const gain = imp - (nl / n) * gini(left, nl) - (nr / n) * gini(right, nr);
          if (!best || gain > best.gain + 1e-12) best = { gain, feature: j, level: l };
        }
      }
    });
    const b = best as { gain: number; feature: number; threshold?: number; level?: number } | null;
    if (!b || b.gain < 1e-7) return { leaf: true, counts, n };
    if (importance) importance[b.feature] += n * b.gain;
    const col = enc.cols[b.feature];
    if (b.threshold !== undefined) {
      // Seperti CART: ambang di tengah antara nilai terbesar kiri & terkecil kanan
      // (pembagian data latih sama, batasnya lebih adil untuk data baru).
      let maxLeft = -Infinity;
      let minRight = Infinity;
      for (const i of rows) {
        const x = col[i];
        if (x <= b.threshold) maxLeft = Math.max(maxLeft, x);
        else minRight = Math.min(minRight, x);
      }
      if (Number.isFinite(maxLeft) && Number.isFinite(minRight)) b.threshold = (maxLeft + minRight) / 2;
    }
    const goLeft = (i: number) => (b.threshold !== undefined ? col[i] <= b.threshold : col[i] === b.level);
    const L: number[] = [];
    const R: number[] = [];
    for (const i of rows) (goLeft(i) ? L : R).push(i);
    return {
      leaf: false,
      counts,
      n,
      feature: b.feature,
      threshold: b.threshold,
      level: b.level,
      left: grow(L, depth + 1),
      right: grow(R, depth + 1),
    };
  };
  return grow(idx, 0);
}

export function treeProba(node: TreeNode, enc: Encoded, i: number): number[] {
  let cur = node;
  while (!cur.leaf) {
    const v = enc.cols[cur.feature][i];
    cur = (cur.threshold !== undefined ? v <= cur.threshold : v === cur.level) ? cur.left : cur.right;
  }
  return cur.counts.map((c) => c / cur.n);
}

function countLeaves(node: TreeNode): number {
  return node.leaf ? 1 : countLeaves(node.left) + countLeaves(node.right);
}

/** Aturan JIKA–MAKA dari daun, kondisi pada fitur yang sama digabung. */
/**
 * Untuk tampilan: gabungkan dua daun bersaudara yang prediksinya sama. Split
 * seperti itu menurunkan Gini tapi tidak mengubah keputusan — hanya menambah
 * aturan yang membingungkan. Prediksi pohon asli tidak berubah.
 */
export function collapseSameClass(node: TreeNode): TreeNode {
  if (node.leaf) return node;
  const left = collapseSameClass(node.left);
  const right = collapseSameClass(node.right);
  if (left.leaf && right.leaf && argmax(left.counts) === argmax(right.counts)) {
    return { leaf: true, counts: node.counts, n: node.n };
  }
  return { ...node, left, right };
}

/** Format ambang: 12 → "12", 2.5 → "2.5", 104900 → "104.9K". */
export function formatThreshold(v: number): string {
  return Math.abs(v) >= 1000 ? compactNumber(v) : String(+v.toFixed(2));
}

export function treeRules(root: TreeNode, enc: Encoded, labels: string[], fmt: (v: number) => string): TreeRule[] {
  const node = collapseSameClass(root);
  const out: TreeRule[] = [];
  type Bound = { lo?: number; hi?: number; eq?: string; neq: string[] };
  const walk = (nd: TreeNode, bounds: Map<number, Bound>) => {
    if (nd.leaf) {
      const k = argmax(nd.counts);
      const conditions = Array.from(bounds.entries()).map(([f, b]) => {
        const name = enc.features[f].name;
        if (b.eq !== undefined) return `${name} = ${b.eq}`;
        if (b.neq.length) return `${name} bukan ${b.neq.join("/")}`;
        if (b.lo !== undefined && b.hi !== undefined) return `${fmt(b.lo)} < ${name} ≤ ${fmt(b.hi)}`;
        return b.hi !== undefined ? `${name} ≤ ${fmt(b.hi)}` : `${name} > ${fmt(b.lo!)}`;
      });
      out.push({ conditions, prediction: labels[k], n: nd.n, confidence: nd.counts[k] / nd.n });
      return;
    }
    const f = nd.feature;
    const prev = bounds.get(f) ?? { neq: [] };
    const leftB = new Map(bounds);
    const rightB = new Map(bounds);
    if (nd.threshold !== undefined) {
      leftB.set(f, { ...prev, neq: [...prev.neq], hi: prev.hi === undefined ? nd.threshold : Math.min(prev.hi, nd.threshold) });
      rightB.set(f, { ...prev, neq: [...prev.neq], lo: prev.lo === undefined ? nd.threshold : Math.max(prev.lo, nd.threshold) });
    } else {
      const lv = enc.features[f].levels[nd.level!];
      leftB.set(f, { eq: lv, neq: [] });
      rightB.set(f, { ...prev, neq: [...prev.neq, lv] });
    }
    walk(nd.left, leftB);
    walk(nd.right, rightB);
  };
  walk(node, new Map());
  return out.sort((a, b) => b.n - a.n);
}

// ============================================================
// NAIVE BAYES (Gaussian + kategorikal dengan smoothing Laplace)
// ============================================================

export type NaiveBayesModel = {
  logPrior: number[];
  /** Per fitur: numerik {mean[k], var[k]}; kategorikal logP[k][level]. */
  params: ({ kind: "numeric"; mean: number[]; variance: number[] } | { kind: "categorical"; logP: number[][] })[];
};

export function fitNaiveBayes(enc: Encoded, y: number[], idx: number[], K: number): NaiveBayesModel {
  const nk = new Array<number>(K).fill(0);
  for (const i of idx) nk[y[i]]++;
  const logPrior = nk.map((c) => Math.log(c / idx.length));
  // var_smoothing seperti scikit-learn: 1e-9 × variansi terbesar antar fitur.
  let maxVar = 0;
  const params = enc.features.map((f, j) => {
    const col = enc.cols[j];
    if (f.kind === "numeric") {
      const sum = new Array<number>(K).fill(0);
      for (const i of idx) sum[y[i]] += col[i];
      const mean = sum.map((s, k) => (nk[k] ? s / nk[k] : 0));
      const ss = new Array<number>(K).fill(0);
      for (const i of idx) ss[y[i]] += (col[i] - mean[y[i]]) ** 2;
      const variance = ss.map((s, k) => (nk[k] ? s / nk[k] : 0));
      let all = 0;
      let allMean = 0;
      for (const i of idx) allMean += col[i] / idx.length;
      for (const i of idx) all += (col[i] - allMean) ** 2 / idx.length;
      maxVar = Math.max(maxVar, all);
      return { kind: "numeric" as const, mean, variance };
    }
    const L = f.levels.length;
    const cnt = Array.from({ length: K }, () => new Array<number>(L).fill(0));
    for (const i of idx) cnt[y[i]][col[i]]++;
    return {
      kind: "categorical" as const,
      logP: cnt.map((row, k) => row.map((c) => Math.log((c + 1) / (nk[k] + L)))),
    };
  });
  const eps = 1e-9 * (maxVar || 1);
  for (const p of params) if (p.kind === "numeric") p.variance = p.variance.map((v) => v + eps);
  return { logPrior, params };
}

export function naiveBayesProba(model: NaiveBayesModel, enc: Encoded, i: number): number[] {
  const K = model.logPrior.length;
  const logp = model.logPrior.slice();
  model.params.forEach((p, j) => {
    const x = enc.cols[j][i];
    for (let k = 0; k < K; k++) {
      if (p.kind === "numeric") {
        const v = p.variance[k];
        logp[k] += -0.5 * Math.log(2 * Math.PI * v) - ((x - p.mean[k]) ** 2) / (2 * v);
      } else {
        logp[k] += p.logP[k][x];
      }
    }
  });
  const m = Math.max(...logp);
  const ex = logp.map((l) => Math.exp(l - m));
  const z = ex.reduce((s, v) => s + v, 0);
  return ex.map((v) => v / z);
}

// ============================================================
// PIPELINE
// ============================================================

/**
 * Klasifikasi `target` dari baris-baris data. `fmt` memformat ambang angka
 * di aturan pohon. Mengembalikan alasan kalau data tidak memenuhi syarat.
 */
export function classifyTable(
  rows: ParsedRow[],
  profiles: ColProfile[],
  target: string,
  fmt: (v: number) => string = formatThreshold,
): ClassificationResult | { reason: string } {
  const L = CLASSIFY_LIMITS;
  const notes: string[] = [];

  // --- Baris & kelas
  let data = rows.filter((r) => labelOf(r[target]) !== null);
  const counts = new Map<string, number>();
  for (const r of data) counts.set(labelOf(r[target])!, (counts.get(labelOf(r[target])!) ?? 0) + 1);
  const rare = Array.from(counts.entries()).filter(([, c]) => c < L.minPerClass);
  if (rare.length) {
    notes.push(`Kelas dengan < ${L.minPerClass} baris tidak diikutkan: ${rare.map(([l, c]) => `${l} (${c})`).join(", ")}.`);
    const drop = new Set(rare.map(([l]) => l));
    data = data.filter((r) => !drop.has(labelOf(r[target])!));
  }
  const labels = Array.from(counts.entries())
    .filter(([, c]) => c >= L.minPerClass)
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l);
  const K = labels.length;
  if (K < L.minClasses) return { reason: `target "${target}" butuh minimal 2 kelas dengan ≥ ${L.minPerClass} baris` };
  if (K > L.maxClasses) return { reason: `target "${target}" punya ${K} kelas (maks ${L.maxClasses})` };
  if (data.length < L.minRows) return { reason: `klasifikasi butuh minimal ${L.minRows} baris berlabel (tersedia ${data.length})` };
  if (data.length > L.maxRows) {
    notes.push(`Memakai sampel sistematis ${L.maxRows} dari ${data.length} baris.`);
    data = systematicSample(data, L.maxRows);
  }
  const y = data.map((r) => labels.indexOf(labelOf(r[target])!));

  // --- Fitur
  const excluded: ClassificationResult["excluded"] = [];
  const feats: { name: string; kind: "numeric" | "categorical" }[] = [];
  for (const p of profiles) {
    if (p.name === target) continue;
    if (p.isLikelyId) excluded.push({ column: p.name, reason: "kolom ID" });
    else if (p.timeKind) excluded.push({ column: p.name, reason: "kolom waktu" });
    else if (isNumericType(p.type)) feats.push({ name: p.name, kind: "numeric" });
    else if ((p.type === "categorical" || p.type === "boolean") && p.unique <= L.maxCategoryLevels) feats.push({ name: p.name, kind: "categorical" });
    else excluded.push({ column: p.name, reason: p.type === "text" || p.type === "date" ? "teks bebas / tanggal" : `lebih dari ${L.maxCategoryLevels} kategori` });
  }
  if (feats.length > L.maxFeatures) {
    for (const f of feats.splice(L.maxFeatures)) excluded.push({ column: f.name, reason: `maksimal ${L.maxFeatures} fitur` });
  }
  if (feats.length === 0) return { reason: "tidak ada kolom fitur yang bisa dipakai" };

  // --- Split & kode
  const { train, test } = stratifiedSplit(y, L.testShare, L.seed);
  const enc = encode(data, feats, train);
  const minLeaf = Math.max(5, Math.round(0.01 * train.length));
  const positive = K === 2 ? 1 : undefined; // kelas minoritas (label diurut dari terbanyak)

  // --- Kedalaman pohon: 5-fold CV (stratified) + aturan 1-SE
  const yTrain = train.map((i) => y[i]);
  const folds = stratifiedFolds(yTrain, L.folds, L.seed + 1).map((f) => f.map((j) => train[j]));
  const cv = L.depths.map((depth) => {
    const scores = folds.map((fold) => {
      const inFold = new Set(fold);
      const fit = train.filter((i) => !inFold.has(i));
      const tree = buildTree(enc, y, fit, K, { maxDepth: depth, minLeaf });
      const pred = fold.map((i) => argmax(treeProba(tree, enc, i)));
      return evaluate(fold.map((i) => y[i]), pred, K, labels).balancedAccuracy;
    });
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, scores.length - 1));
    return { depth, mean, se: sd / Math.sqrt(scores.length) };
  });
  const top = cv.reduce((a, b) => (b.mean > a.mean ? b : a));
  const depth = cv.find((c) => c.mean >= top.mean - top.se)!.depth;

  const importanceRaw = new Array<number>(feats.length).fill(0);
  const tree = buildTree(enc, y, train, K, { maxDepth: depth, minLeaf }, importanceRaw);
  const nb = fitNaiveBayes(enc, y, train, K);

  // --- Evaluasi di data uji
  const yTest = test.map((i) => y[i]);
  const treeP = test.map((i) => treeProba(tree, enc, i));
  const nbP = test.map((i) => naiveBayesProba(nb, enc, i));
  const treePred = treeP.map(argmax);
  const nbPred = nbP.map(argmax);
  const majority = argmax(train.reduce((acc, i) => (acc[y[i]]++, acc), new Array<number>(K).fill(0)));
  const basePred = test.map(() => majority);
  const baseP = test.map(() => labels.map((_, k) => (k === majority ? 1 : 0)));

  const treeEval = evaluate(yTest, treePred, K, labels, treeP, positive);
  const nbEval = evaluate(yTest, nbPred, K, labels, nbP, positive);
  const baseEval = evaluate(yTest, basePred, K, labels, baseP, positive);

  let b = 0;
  let c = 0;
  yTest.forEach((a, i) => {
    const tOk = treePred[i] === a;
    const nOk = nbPred[i] === a;
    if (tOk && !nOk) b++;
    if (!tOk && nOk) c++;
  });

  const totalImp = importanceRaw.reduce((s, v) => s + v, 0);
  const importance = feats
    .map((f, j) => ({ feature: f.name, value: totalImp > 0 ? importanceRaw[j] / totalImp : 0 }))
    .filter((x) => x.value > 0)
    .sort((a, b2) => b2.value - a.value);

  // Terbaik = balanced accuracy tertinggi; seri → model yang lebih sederhana
  // (baseline, lalu pohon yang mudah dijelaskan, lalu Naive Bayes).
  const scored = [
    { key: "baseline" as const, s: baseEval.balancedAccuracy },
    { key: "tree" as const, s: treeEval.balancedAccuracy },
    { key: "naiveBayes" as const, s: nbEval.balancedAccuracy },
  ];
  const best = scored.reduce((a, b2) => (b2.s > a.s + 1e-12 ? b2 : a)).key;

  // --- Catatan jujur
  const share = labels.map((l) => counts.get(l)! / data.length);
  if (Math.max(...share) >= 0.8) {
    notes.push(
      `Kelas tidak seimbang: ${labels[0]} ${(share[0] * 100).toFixed(0)}% dari data — akurasi menyesatkan, perhatikan balanced accuracy & recall kelas minoritas.`,
    );
  }
  const bestBal = Math.max(treeEval.balancedAccuracy, nbEval.balancedAccuracy);
  if (bestBal <= baseEval.balancedAccuracy + 0.02) {
    notes.push("Kedua model tidak lebih baik dari menebak kelas mayoritas — fitur yang ada belum cukup menjelaskan target.");
  }
  if (Math.max(treeEval.accuracy, nbEval.accuracy) >= 0.995 && test.length >= 20) {
    notes.push(
      "Akurasi hampir 100%: periksa kemungkinan kebocoran data (leakage) — ada kolom yang mungkin baru diketahui SETELAH target terjadi.",
    );
  }
  if (test.length < 50) notes.push(`Data uji hanya ${test.length} baris — metrik bisa berubah cukup besar dengan data lain.`);

  return {
    target,
    classes: labels.map((l) => ({ label: l, count: counts.get(l)! })),
    n: data.length,
    nTrain: train.length,
    nTest: test.length,
    features: feats,
    excluded,
    positiveClass: K === 2 ? labels[1] : null,
    tree: {
      ...treeEval,
      depth,
      leaves: countLeaves(tree),
      cv,
      rules: treeRules(tree, enc, labels, fmt).slice(0, L.maxRules),
      importance,
    },
    naiveBayes: nbEval,
    baseline: { ...baseEval, majority: labels[majority] },
    best,
    mcnemar: test.length ? mcnemarTest(b, c) : null,
    notes,
  };
}

/** Langkah pipeline: pilih target lalu klasifikasi. */
export function computeClassification(
  rows: ParsedRow[],
  profiles: ColProfile[],
  intent: ParsedIntent | null,
  fmt?: (v: number) => string,
): ClassificationBundle {
  const candidates = classTargetCandidates(profiles);
  const target = pickClassTarget(profiles, intent);
  if (!target) {
    return {
      result: null,
      candidates,
      reason: candidates.length ? "target tidak disebut — pilih kolom target" : "tidak ada kolom kategorikal 2–10 kelas",
    };
  }
  const r = classifyTable(rows, profiles, target, fmt);
  return "reason" in r ? { result: null, candidates, reason: r.reason } : { result: r, candidates, reason: null };
}
