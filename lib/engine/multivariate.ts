/**
 * Analisis multivariat — PCA & klaster k-means.
 *
 * Mengikuti materi Analisis Data Multivariat (PCA, uji asumsi) dan Data
 * Mining (k-means, evaluasi klaster):
 *   - Kolom numerik distandardisasi (z-score, pembagi n−1) → PCA dari
 *     MATRIKS KORELASI, karena satuan antar kolom berbeda.
 *   - Kelayakan PCA diuji dulu: uji sferisitas Bartlett (H0: R = I) dan
 *     ukuran KMO (Kaiser-Meyer-Olkin).
 *   - Eigen-dekomposisi memakai metode Jacobi (matriks simetris kecil).
 *   - k-means++ dengan seed tetap (hasil deterministik), beberapa restart,
 *     k dipilih dengan rata-rata silhouette (k = 2…6). Silhouette < 0,25
 *     dilaporkan jujur sebagai "tidak ada struktur klaster yang jelas".
 *
 * Hasil yang disimpan ringan (≤ 400 titik plot) supaya muat di snapshot.
 */

import type { ColProfile } from "./profile";
import { chiSquareSurvival, summarize, systematicSample } from "./stats";

// ============================================================
// TIPE
// ============================================================

export type PcaResult = {
  columns: string[];
  /** Nilai eigen matriks korelasi, urut menurun. */
  eigenvalues: number[];
  /** Proporsi variansi yang dijelaskan tiap komponen. */
  explained: number[];
  cumulative: number[];
  /** loadings[i][k] = korelasi kolom i dengan komponen k (eigvec · √λ). */
  loadings: number[][];
  /** Jumlah komponen dengan nilai eigen > 1 (kriteria Kaiser). */
  kaiserComponents: number;
  bartlett: { chi2: number; df: number; pValue: number };
  /** Kaiser-Meyer-Olkin; null kalau matriks korelasi singular. */
  kmo: number | null;
};

export type ClusterProfile = {
  cluster: number;
  size: number;
  share: number;
  /** Rata-rata tiap kolom di klaster ini (satuan asli). */
  centroid: Record<string, number>;
  /** Kolom yang rata-ratanya ≥ 0,5 SD di atas rata-rata keseluruhan. */
  high: { column: string; z: number }[];
  /** Kolom yang rata-ratanya ≤ −0,5 SD di bawah rata-rata keseluruhan. */
  low: { column: string; z: number }[];
};

export type ClusterResult = {
  k: number;
  /** Rata-rata silhouette untuk k terpilih (−1…1). */
  silhouette: number;
  silhouetteByK: { k: number; silhouette: number }[];
  structure: "kuat" | "wajar" | "lemah" | "tidak ada";
  profiles: ClusterProfile[];
  /**
   * Nomor klaster yang porsinya < 5%: biasanya kumpulan outlier, bukan segmen.
   * Silhouette bisa tinggi justru KARENA outlier ini terpisah jauh.
   */
  tinyClusters?: number[];
};

export type MultivariateResult = {
  /** Kolom yang dipakai (sudah lolos seleksi kelengkapan & variansi). */
  columns: string[];
  /** Jumlah baris lengkap (complete cases) yang dianalisis. */
  n: number;
  /** Kolom kandidat yang dikeluarkan + alasannya. */
  excluded: { column: string; reason: string }[];
  /** Kolom yang di-log-transform (log(1+x)) karena sangat miring kanan. */
  transformed?: string[];
  pca: PcaResult | null;
  clusters: ClusterResult | null;
  /** Titik untuk plot PC1 × PC2 (sampel sistematik ≤ 400). */
  points: { x: number; y: number; cluster: number }[];
  notes: string[];
};

export const MV_LIMITS = {
  maxColumns: 8,
  /** Kolom ditambahkan hanya kalau baris lengkap tetap ≥ 70% total baris. */
  minCompleteShare: 0.7,
  minColsPca: 3,
  /** n ≥ 5p (aturan praktis PCA), minimal 10. */
  rowsPerColumnPca: 5,
  minRowsCluster: 20,
  /** Kolom ≥ 0 dengan skewness > batas ini di-log(1+x) sebelum standardisasi. */
  logSkewThreshold: 2,
  /** Klaster dengan porsi < ini dianggap kelompok outlier, bukan segmen. */
  minClusterShare: 0.05,
  maxK: 6,
  fitSample: 3_000,
  silhouetteSample: 1_000,
  plotPoints: 400,
  seed: 42,
} as const;

// ============================================================
// ALJABAR LINEAR
// ============================================================

/**
 * Eigen-dekomposisi matriks simetris dengan rotasi Jacobi siklik (NR §11.1).
 * Return nilai eigen menurun; vectors[i][k] = komponen ke-i eigenvektor k.
 */
export function jacobiEigen(A: number[][], maxSweeps = 100): { values: number[]; vectors: number[][] } {
  const n = A.length;
  const a = A.map((r) => [...r]);
  const v: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[y][y] - a[x][x]);
  return {
    values: order.map((i) => a[i][i]),
    vectors: v.map((row) => order.map((i) => row[i])),
  };
}

/** Matriks korelasi dari data terstandardisasi Z (n × p). */
export function correlationFromZ(Z: number[][]): number[][] {
  const n = Z.length;
  const p = Z[0]?.length ?? 0;
  const R = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (const row of Z) {
    for (let i = 0; i < p; i++) {
      const zi = row[i];
      for (let j = i; j < p; j++) R[i][j] += zi * row[j];
    }
  }
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      R[i][j] /= n - 1;
      R[j][i] = R[i][j];
    }
  }
  return R;
}

// ============================================================
// PCA
// ============================================================

export function kmoLabel(kmo: number): string {
  if (kmo >= 0.9) return "sangat baik";
  if (kmo >= 0.8) return "baik";
  if (kmo >= 0.7) return "cukup";
  if (kmo >= 0.6) return "sedang";
  if (kmo >= 0.5) return "lemah";
  return "tidak layak";
}

/** PCA dari data terstandardisasi. Juga mengembalikan vektor eigen untuk skor. */
export function runPca(Z: number[][], columns: string[]): { result: PcaResult; vectors: number[][] } {
  const n = Z.length;
  const p = columns.length;
  const R = correlationFromZ(Z);
  const { values, vectors } = jacobiEigen(R);
  const lambdas = values.map((v) => Math.max(v, 0));
  const total = lambdas.reduce((s, v) => s + v, 0) || 1;

  // Konvensi tanda: loading terbesar (|nilai|) tiap komponen dibuat positif.
  for (let k = 0; k < p; k++) {
    let best = 0;
    for (let i = 1; i < p; i++) if (Math.abs(vectors[i][k]) > Math.abs(vectors[best][k])) best = i;
    if (vectors[best][k] < 0) for (let i = 0; i < p; i++) vectors[i][k] = -vectors[i][k];
  }

  const explained = lambdas.map((v) => v / total);
  const cumulative: number[] = [];
  explained.reduce((acc, e) => {
    cumulative.push(acc + e);
    return acc + e;
  }, 0);
  const loadings = vectors.map((row) => row.map((v, k) => v * Math.sqrt(lambdas[k])));

  // Uji sferisitas Bartlett: χ² = −(n − 1 − (2p + 5)/6) · ln|R|, df = p(p − 1)/2
  const singular = values.some((v) => v <= 1e-12);
  const lnDet = singular ? -Infinity : values.reduce((s, v) => s + Math.log(v), 0);
  const chi2 = -(n - 1 - (2 * p + 5) / 6) * lnDet;
  const df = (p * (p - 1)) / 2;
  const bartlett = { chi2, df, pValue: singular ? 0 : chiSquareSurvival(chi2, df) };

  // KMO = Σr² / (Σr² + Σa²) dengan a_ij = korelasi parsial dari R⁻¹ = V Λ⁻¹ Vᵀ
  let kmo: number | null = null;
  if (!singular) {
    const inv = Array.from({ length: p }, (_, i) =>
      Array.from({ length: p }, (_, j) => {
        let s = 0;
        for (let k = 0; k < p; k++) s += (vectors[i][k] * vectors[j][k]) / values[k];
        return s;
      }),
    );
    let r2 = 0;
    let a2 = 0;
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        if (i === j) continue;
        r2 += R[i][j] ** 2;
        a2 += (inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j])) ** 2;
      }
    }
    kmo = r2 + a2 > 0 ? r2 / (r2 + a2) : null;
  }

  return {
    result: {
      columns,
      eigenvalues: lambdas,
      explained,
      cumulative,
      loadings,
      kaiserComponents: lambdas.filter((v) => v > 1).length,
      bartlett,
      kmo,
    },
    vectors,
  };
}

// ============================================================
// K-MEANS
// ============================================================

/** PRNG deterministik (mulberry32) — supaya hasil klaster sama tiap dijalankan. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function nearest(point: number[], centroids: number[][]): { idx: number; d2: number } {
  let idx = 0;
  let d2 = Infinity;
  for (let c = 0; c < centroids.length; c++) {
    const d = dist2(point, centroids[c]);
    if (d < d2) {
      d2 = d;
      idx = c;
    }
  }
  return { idx, d2 };
}

function kmeansPlusPlusInit(data: number[][], k: number, rand: () => number): number[][] {
  const centroids = [data[Math.floor(rand() * data.length)].slice()];
  const d2 = data.map((x) => dist2(x, centroids[0]));
  while (centroids.length < k) {
    const total = d2.reduce((s, v) => s + v, 0);
    let pick = Math.floor(rand() * data.length);
    if (total > 0) {
      let r = rand() * total;
      for (let i = 0; i < data.length; i++) {
        r -= d2[i];
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    }
    const c = data[pick].slice();
    centroids.push(c);
    for (let i = 0; i < data.length; i++) d2[i] = Math.min(d2[i], dist2(data[i], c));
  }
  return centroids;
}

export function kmeans(
  data: number[][],
  k: number,
  opts: { nInit?: number; maxIter?: number; seed?: number } = {},
): { centroids: number[][]; labels: number[]; inertia: number } {
  const { nInit = 5, maxIter = 100, seed = MV_LIMITS.seed } = opts;
  const rand = mulberry32(seed + k * 1000);
  const p = data[0].length;
  let best: { centroids: number[][]; labels: number[]; inertia: number } | null = null;

  for (let run = 0; run < nInit; run++) {
    let centroids = kmeansPlusPlusInit(data, k, rand);
    const labels = new Array<number>(data.length).fill(0);
    for (let iter = 0; iter < maxIter; iter++) {
      for (let i = 0; i < data.length; i++) labels[i] = nearest(data[i], centroids).idx;
      const sums = Array.from({ length: k }, () => new Array<number>(p).fill(0));
      const counts = new Array<number>(k).fill(0);
      for (let i = 0; i < data.length; i++) {
        counts[labels[i]]++;
        for (let j = 0; j < p; j++) sums[labels[i]][j] += data[i][j];
      }
      const next = sums.map((s, c) => (counts[c] > 0 ? s.map((v) => v / counts[c]) : centroids[c]));
      // Klaster kosong → pindahkan ke titik terjauh dari centroid-nya.
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) continue;
        let far = 0;
        let farD = -1;
        for (let i = 0; i < data.length; i++) {
          const d = dist2(data[i], next[labels[i]]);
          if (d > farD) {
            farD = d;
            far = i;
          }
        }
        next[c] = data[far].slice();
      }
      const shift = next.reduce((s, c, i) => s + dist2(c, centroids[i]), 0);
      centroids = next;
      if (shift < 1e-12) break;
    }
    let inertia = 0;
    for (let i = 0; i < data.length; i++) {
      const nn = nearest(data[i], centroids);
      labels[i] = nn.idx;
      inertia += nn.d2;
    }
    if (!best || inertia < best.inertia) best = { centroids, labels: [...labels], inertia };
  }
  return best!;
}

/**
 * Rata-rata koefisien silhouette (Rousseeuw, 1987), jarak Euclid.
 * s(i) = (b − a) / max(a, b); anggota klaster tunggal → 0 (konvensi sklearn).
 */
export function silhouetteScore(data: number[][], labels: number[], k: number): number {
  const n = data.length;
  if (n < 2) return 0;
  const counts = new Array<number>(k).fill(0);
  for (const l of labels) counts[l]++;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const sums = new Array<number>(k).fill(0);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      sums[labels[j]] += Math.sqrt(dist2(data[i], data[j]));
    }
    const own = labels[i];
    if (counts[own] <= 1) continue; // s(i) = 0
    const a = sums[own] / (counts[own] - 1);
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === own || counts[c] === 0) continue;
      b = Math.min(b, sums[c] / counts[c]);
    }
    if (!Number.isFinite(b)) continue;
    const m = Math.max(a, b);
    total += m > 0 ? (b - a) / m : 0;
  }
  return total / n;
}

/** Interpretasi silhouette (Kaufman & Rousseeuw, 1990). */
export function silhouetteStructure(s: number): ClusterResult["structure"] {
  if (s > 0.7) return "kuat";
  if (s > 0.5) return "wajar";
  if (s > 0.25) return "lemah";
  return "tidak ada";
}

// ============================================================
// PIPELINE
// ============================================================

type Prepared = {
  columns: string[];
  X: number[][];
  Z: number[][];
  excluded: { column: string; reason: string }[];
  transformed: string[];
};

/**
 * Pilih kolom & baris lengkap. Kolom ditambahkan berurutan (sesuai prioritas)
 * selama baris lengkap tetap ≥ 70% — supaya satu kolom yang banyak kosong
 * tidak membuang sebagian besar data (listwise deletion).
 */
export function prepareMatrix(profiles: ColProfile[], candidates: string[]): Prepared {
  const excluded: { column: string; reason: string }[] = [];
  const vecs: { name: string; v: number[] }[] = [];
  for (const name of candidates) {
    const p = profiles.find((x) => x.name === name);
    if (!p?.numericVector || !p.summary) continue;
    if (p.summary.std === 0) {
      excluded.push({ column: name, reason: "nilainya konstan" });
      continue;
    }
    vecs.push({ name, v: p.numericVector });
  }
  const total = vecs[0]?.v.length ?? 0;
  let complete = new Array<boolean>(total).fill(true);
  const chosen: { name: string; v: number[] }[] = [];
  for (const c of vecs) {
    if (chosen.length >= MV_LIMITS.maxColumns) {
      excluded.push({ column: c.name, reason: `maksimal ${MV_LIMITS.maxColumns} kolom` });
      continue;
    }
    const next = complete.map((ok, i) => ok && Number.isFinite(c.v[i]));
    const kept = next.filter(Boolean).length;
    if (kept < total * MV_LIMITS.minCompleteShare) {
      excluded.push({ column: c.name, reason: "terlalu banyak nilai kosong" });
      continue;
    }
    complete = next;
    chosen.push(c);
  }

  const rows: number[] = [];
  for (let i = 0; i < total; i++) if (complete[i]) rows.push(i);
  const X = rows.map((i) => chosen.map((c) => c.v[i]));

  // Kolom ≥ 0 yang sangat miring kanan (populasi, GDP, omzet) di-log(1+x)
  // dulu: tanpa ini PCA & k-means didominasi segelintir outlier (mis. hanya
  // memisahkan China & India dari negara lain).
  const p = chosen.length;
  const transformed: string[] = [];
  const T = X.map((r) => [...r]);
  for (let j = 0; j < p; j++) {
    const col = X.map((r) => r[j]);
    const min = col.reduce((m, v) => Math.min(m, v), Infinity);
    if (min >= 0 && summarize(col).skewness > MV_LIMITS.logSkewThreshold) {
      for (const r of T) r[j] = Math.log1p(r[j]);
      transformed.push(chosen[j].name);
    }
  }

  // Standardisasi di atas baris lengkap (mean & SD sampel).
  const means = new Array<number>(p).fill(0);
  const sds = new Array<number>(p).fill(0);
  for (const r of T) for (let j = 0; j < p; j++) means[j] += r[j];
  for (let j = 0; j < p; j++) means[j] /= T.length || 1;
  for (const r of T) for (let j = 0; j < p; j++) sds[j] += (r[j] - means[j]) ** 2;
  for (let j = 0; j < p; j++) sds[j] = Math.sqrt(sds[j] / Math.max(1, T.length - 1));

  const keep = sds.map((s) => s > 0);
  const columns = chosen.filter((_, j) => keep[j]).map((c) => c.name);
  chosen.forEach((c, j) => {
    if (!keep[j]) excluded.push({ column: c.name, reason: "konstan di baris lengkap" });
  });
  const Xk = X.map((r) => r.filter((_, j) => keep[j]));
  const Tk = T.map((r) => r.filter((_, j) => keep[j]));
  const mk = means.filter((_, j) => keep[j]);
  const sk = sds.filter((_, j) => keep[j]);
  const Z = Tk.map((r) => r.map((v, j) => (v - mk[j]) / sk[j]));
  return { columns, X: Xk, Z, excluded, transformed: transformed.filter((c) => columns.includes(c)) };
}

export function computeMultivariate(profiles: ColProfile[], candidates: string[]): MultivariateResult | null {
  const { columns, X, Z, excluded, transformed } = prepareMatrix(profiles, candidates);
  const p = columns.length;
  const n = Z.length;
  if (p < 2 || n < 10) return null;
  const notes: string[] = [];

  // ---- PCA
  let pca: PcaResult | null = null;
  let vectors: number[][] | null = null;
  const minRowsPca = Math.max(10, MV_LIMITS.rowsPerColumnPca * p);
  if (p < MV_LIMITS.minColsPca) {
    notes.push(`PCA butuh minimal ${MV_LIMITS.minColsPca} kolom numerik (tersedia ${p}).`);
  } else if (n < minRowsPca) {
    notes.push(`PCA butuh minimal ${minRowsPca} baris lengkap untuk ${p} kolom (tersedia ${n}).`);
  } else {
    const out = runPca(Z, columns);
    pca = out.result;
    vectors = out.vectors;
  }

  // ---- K-MEANS
  let clusters: ClusterResult | null = null;
  let fullLabels: number[] | null = null;
  if (n < MV_LIMITS.minRowsCluster) {
    notes.push(`Klaster butuh minimal ${MV_LIMITS.minRowsCluster} baris lengkap (tersedia ${n}).`);
  } else {
    const idx = Array.from({ length: n }, (_, i) => i);
    const fitIdx = systematicSample(idx, MV_LIMITS.fitSample);
    const fit = fitIdx.map((i) => Z[i]);
    const silIdx = systematicSample(
      fitIdx.map((_, j) => j),
      MV_LIMITS.silhouetteSample,
    );
    const silData = silIdx.map((j) => fit[j]);
    const maxK = Math.min(MV_LIMITS.maxK, Math.floor(fit.length / 5));
    const tried: { k: number; silhouette: number; centroids: number[][] }[] = [];
    for (let k = 2; k <= maxK; k++) {
      const km = kmeans(fit, k);
      const s = silhouetteScore(silData, silIdx.map((j) => km.labels[j]), k);
      tried.push({ k, silhouette: s, centroids: km.centroids });
    }
    if (tried.length > 0) {
      const best = tried.reduce((a, b) => (b.silhouette > a.silhouette + 1e-9 ? b : a));
      // Label semua baris ke centroid terpilih; urutkan klaster dari yang terbesar.
      const raw = Z.map((z) => nearest(z, best.centroids).idx);
      const sizes = new Array<number>(best.k).fill(0);
      for (const l of raw) sizes[l]++;
      const order = sizes.map((s, c) => ({ s, c })).sort((a, b) => b.s - a.s).map((o) => o.c);
      const remap = new Array<number>(best.k);
      order.forEach((c, newIdx) => (remap[c] = newIdx));
      fullLabels = raw.map((l) => remap[l]);

      const profilesOut: ClusterProfile[] = order.map((c, newIdx) => {
        const members: number[] = [];
        fullLabels!.forEach((l, i) => {
          if (l === newIdx) members.push(i);
        });
        const centroid: Record<string, number> = {};
        const zMean: number[] = new Array<number>(p).fill(0);
        for (let j = 0; j < p; j++) {
          let sx = 0;
          let sz = 0;
          for (const i of members) {
            sx += X[i][j];
            sz += Z[i][j];
          }
          centroid[columns[j]] = sx / members.length;
          zMean[j] = sz / members.length;
        }
        const zs = columns.map((col, j) => ({ column: col, z: zMean[j] }));
        return {
          cluster: newIdx + 1,
          size: members.length,
          share: members.length / n,
          centroid,
          high: zs.filter((x) => x.z >= 0.5).sort((a, b) => b.z - a.z).slice(0, 3),
          low: zs.filter((x) => x.z <= -0.5).sort((a, b) => a.z - b.z).slice(0, 3),
        };
      });

      clusters = {
        k: best.k,
        silhouette: best.silhouette,
        silhouetteByK: tried.map(({ k, silhouette }) => ({ k, silhouette })),
        structure: silhouetteStructure(best.silhouette),
        tinyClusters: profilesOut.filter((g) => g.share < MV_LIMITS.minClusterShare).map((g) => g.cluster),
        profiles: profilesOut,
      };
    }
  }

  // ---- Titik plot PC1 × PC2 (butuh PCA)
  let points: MultivariateResult["points"] = [];
  if (vectors) {
    const plotIdx = systematicSample(
      Array.from({ length: n }, (_, i) => i),
      MV_LIMITS.plotPoints,
    );
    points = plotIdx.map((i) => {
      let x = 0;
      let y = 0;
      for (let j = 0; j < p; j++) {
        x += Z[i][j] * vectors![j][0];
        y += Z[i][j] * vectors![j][1];
      }
      return { x, y, cluster: fullLabels ? fullLabels[i] + 1 : 0 };
    });
  }

  if (transformed.length) {
    notes.push(`Kolom sangat miring di-log(1+x) sebelum analisis: ${transformed.join(", ")}.`);
  }
  return { columns, n, excluded, transformed, pca, clusters, points, notes };
}
