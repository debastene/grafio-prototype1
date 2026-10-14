"use client";
/**
 * Panel Analisis Multivariat — PCA + klaster k-means (lib/engine/multivariate.ts).
 *
 * Disusun seperti laporan praktikum: uji kelayakan dulu (Bartlett, KMO),
 * baru hasil (scree, loading, proyeksi), lalu klaster beserta evaluasinya
 * (silhouette per k). Kalau syarat tidak terpenuhi, alasannya ditampilkan.
 */

import Card from "@/components/ui/Card";
import BarChart from "@/components/ui/charts/BarChart";
import ScatterChart from "@/components/ui/charts/ScatterChart";
import ChartFrame from "@/components/ui/charts/ChartFrame";
import { PALETTE } from "@/components/ui/charts/registry";
import type { MultivariateResult } from "@/lib/engine/multivariate";
import { kmoLabel } from "@/lib/engine/multivariate";
import type { ColProfile } from "@/lib/engine/profile";
import { compactNumber, formatByType, formatP } from "@/lib/engine/stats";

type Props = {
  mv: MultivariateResult;
  profiles: ColProfile[];
  fileName: string;
};

/**
 * Warna klaster yang kontras satu sama lain (bukan dua gradasi cyan
 * berdampingan) — tetap terbedakan untuk deuteranopia: cyan/amber/pink/mint.
 */
const CLUSTER_COLORS = [PALETTE.cyan, PALETTE.amber, PALETTE.pink, PALETTE.mint, PALETTE.blue, PALETTE.silver];

const STRUCTURE_COLOR: Record<string, string> = {
  kuat: "text-mint border-mint/30 bg-mint/10",
  wajar: "text-cyan border-cyan/30 bg-cyan/10",
  lemah: "text-warning border-warning/30 bg-warning/10",
  "tidak ada": "text-muted border-borderColor bg-bgElevated",
};

export default function MultivariatePanel({ mv, profiles, fileName }: Props) {
  const { pca, clusters } = mv;
  const fmt = (col: string, v: number) => {
    const p = profiles.find((x) => x.name === col);
    return p ? formatByType(v, p.type, p.name) : compactNumber(v);
  };
  const tiny = new Set(clusters?.tinyClusters ?? []);

  // Seri scatter: satu seri per klaster (warna dari palet), atau satu seri polos.
  const k = clusters?.k ?? 0;
  const series =
    k > 0
      ? clusters!.profiles.map((g) => ({
          label: `Kelompok ${g.cluster} (${Math.round(g.share * 100)}%)${tiny.has(g.cluster) ? " · outlier?" : ""}`,
          data: mv.points.filter((pt) => pt.cluster === g.cluster).map(({ x, y }) => ({ x, y })),
          color: CLUSTER_COLORS[(g.cluster - 1) % CLUSTER_COLORS.length],
        }))
      : [{ label: "Baris data", data: mv.points.map(({ x, y }) => ({ x, y })) }];

  return (
    <section className="space-y-5" aria-labelledby="mv-heading">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-cyan">Analisis Multivariat</p>
        <h3 id="mv-heading" className="font-syne font-bold text-white text-lg">
          PCA & Klaster k-means
        </h3>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          {mv.n} baris lengkap × {mv.columns.length} kolom numerik ({mv.columns.join(", ")}), distandardisasi
          (z-score) sebelum dianalisis.
          {mv.transformed?.length ? ` Kolom sangat miring di-log(1+x): ${mv.transformed.join(", ")}.` : ""}
        </p>
      </div>

      {pca && (
        <div className="grid lg:grid-cols-2 gap-5">
          <ChartFrame
            id="chart-pca-projection"
            name="Proyeksi PCA (PC1 × PC2)"
            category="Multivariate"
            subtitle={`Sumbu X = PC1 (${(pca.explained[0] * 100).toFixed(0)}% variasi), Y = PC2 (${(pca.explained[1] * 100).toFixed(0)}%)${k ? " · warna = klaster k-means" : ""} · ${mv.points.length} titik`}
            source={fileName}
            detail={{
              chartKind: "scatter",
              columnsUsed: mv.columns.map((c) => ({ name: c, role: "input PCA (terstandardisasi)" })),
              renderChart: (h) => <ScatterChart height={h} series={series} />,
            }}
          >
            <ScatterChart height={280} series={series} />
          </ChartFrame>

          <ChartFrame
            id="chart-pca-scree"
            name="Scree Plot — Variansi Dijelaskan"
            category="Multivariate"
            subtitle={`${pca.kaiserComponents} komponen dengan nilai eigen > 1 (kriteria Kaiser) · kumulatif PC1–PC2 ${(pca.cumulative[1] * 100).toFixed(0)}%`}
            source={fileName}
            detail={{
              chartKind: "bar",
              columnsUsed: [{ name: "komponen utama", role: "PC1…PCp, urut nilai eigen" }],
              renderChart: (h) => (
                <BarChart
                  height={h}
                  labels={pca.explained.map((_, i) => `PC${i + 1}`)}
                  series={[{ label: "% variasi", data: pca.explained.map((e) => +(e * 100).toFixed(1)) }]}
                />
              ),
            }}
          >
            <BarChart
              height={280}
              labels={pca.explained.map((_, i) => `PC${i + 1}`)}
              series={[{ label: "% variasi", data: pca.explained.map((e) => +(e * 100).toFixed(1)) }]}
            />
          </ChartFrame>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {pca && (
          <Card>
            <p className="text-[10px] uppercase tracking-widest text-cyan mb-1">Kelayakan & Loading PCA</p>
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <Stat label="Bartlett χ²" value={`${pca.bartlett.chi2.toFixed(1)} (df ${pca.bartlett.df})`} sub={formatP(pca.bartlett.pValue)} ok={pca.bartlett.pValue < 0.05} />
              <Stat label="KMO" value={pca.kmo === null ? "–" : pca.kmo.toFixed(2)} sub={pca.kmo === null ? "matriks singular" : kmoLabel(pca.kmo)} ok={(pca.kmo ?? 0) >= 0.6} />
              <Stat label="Kaiser" value={`${pca.kaiserComponents} PC`} sub="nilai eigen > 1" ok />
            </div>
            {(pca.bartlett.pValue >= 0.05 || (pca.kmo ?? 0) < 0.6) && (
              <p className="text-[11px] text-warning bg-warning/5 border border-warning/25 rounded-md p-2 mb-3 leading-relaxed">
                Korelasi antar kolom {pca.bartlett.pValue >= 0.05 ? "tidak signifikan" : "kurang kuat (KMO < 0,6)"} — PCA
                kurang bermanfaat untuk meringkas data ini. Tafsirkan komponen dengan hati-hati.
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted text-[10px] uppercase tracking-wider">
                  <th className="text-left font-normal pb-1">Kolom</th>
                  <th className="text-right font-normal pb-1">PC1</th>
                  <th className="text-right font-normal pb-1">PC2</th>
                </tr>
              </thead>
              <tbody>
                {pca.columns.map((c, i) => (
                  <tr key={c} className="border-t border-borderColor/60">
                    <td className="py-1.5 pr-2 text-white truncate max-w-[160px]" title={c}>{c}</td>
                    <Loading v={pca.loadings[i][0]} />
                    <Loading v={pca.loadings[i][1] ?? 0} />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              Loading = korelasi kolom dengan komponen. |loading| ≥ 0,5 (tebal) berarti kolom itu ikut membentuk
              komponen tersebut.
            </p>
          </Card>
        )}

        {clusters && (
          <Card>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-cyan">Klaster k-means</p>
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STRUCTURE_COLOR[clusters.structure]}`}>
                struktur {clusters.structure}
              </span>
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              k = {clusters.k} dipilih dari silhouette tertinggi:{" "}
              {clusters.silhouetteByK.map((s) => (
                <span key={s.k} className={`font-mono ${s.k === clusters.k ? "text-white" : ""}`}>
                  k{s.k}={s.silhouette.toFixed(2)}{" "}
                </span>
              ))}
            </p>
            {clusters.structure === "tidak ada" ? (
              <p className="text-xs text-white/90 leading-relaxed">
                Silhouette {clusters.silhouette.toFixed(2)} &lt; 0,25 — data tidak membentuk kelompok yang jelas pada
                kolom-kolom ini. Pembagian di bawah hanya potongan dari satu sebaran, bukan segmen alami.
              </p>
            ) : null}
            <div className="space-y-2 mt-2">
              {clusters.profiles.map((g) => (
                <div key={g.cluster} className="rounded-md border border-borderColor bg-bgSurface/60 p-2.5">
                  <p className="text-xs text-white font-semibold flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: CLUSTER_COLORS[(g.cluster - 1) % CLUSTER_COLORS.length] }}
                    />
                    Kelompok {g.cluster}{" "}
                    <span className="text-muted font-normal">
                      · {g.size} baris ({Math.round(g.share * 100)}%)
                    </span>
                    {tiny.has(g.cluster) && <span className="ml-2 text-[10px] text-warning">kemungkinan outlier</span>}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    {[
                      ...g.high.map((h) => `${h.column} tinggi (${fmt(h.column, g.centroid[h.column])})`),
                      ...g.low.map((l) => `${l.column} rendah (${fmt(l.column, g.centroid[l.column])})`),
                    ].join(" · ") || "Mendekati rata-rata di semua kolom"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {mv.notes.length > 0 && (
        <ul className="text-[11px] text-muted space-y-1">
          {mv.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, sub, ok }: { label: string; value: string; sub: string; ok: boolean }) {
  return (
    <div className="rounded-md border border-borderColor bg-bgSurface/60 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-white font-mono text-sm">{value}</p>
      <p className={`text-[10px] ${ok ? "text-mint" : "text-warning"}`}>{sub}</p>
    </div>
  );
}

function Loading({ v }: { v: number }) {
  const strong = Math.abs(v) >= 0.5;
  return (
    <td
      className={`py-1.5 text-right font-mono ${
        strong ? (v < 0 ? "text-danger font-semibold" : "text-white font-semibold") : "text-muted"
      }`}
    >
      {v >= 0 ? " " : "−"}
      {Math.abs(v).toFixed(2)}
    </td>
  );
}
