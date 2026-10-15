"use client";
/**
 * Panel Peramalan ARIMA (lib/engine/forecast.ts). Urutannya mengikuti
 * Box-Jenkins seperti laporan praktikum Analisis Deret Waktu:
 * identifikasi (KPSS, ACF/PACF) → estimasi (model, AICc) → diagnostik
 * (Ljung-Box) → evaluasi (holdout vs naif & linear) → ramalan.
 */

import { useState } from "react";
import Card from "@/components/ui/Card";
import ChartFrame from "@/components/ui/charts/ChartFrame";
import ForecastChart from "@/components/ui/charts/ForecastChart";
import { PALETTE } from "@/components/ui/charts/registry";
import type { ForecastBundle, ForecastError, ForecastMethod } from "@/lib/engine/forecast";
import { arimaEquation, identificationText, kpssStepLabel, mapeLabel } from "@/lib/engine/forecast";
import type { ColProfile } from "@/lib/engine/profile";
import { compactNumber, formatByType } from "@/lib/engine/stats";

type Props = {
  fc: ForecastBundle;
  profiles: ColProfile[];
  fileName: string;
};

const pText = (p: number) => (p >= 0.1 ? "≥ 0,10" : p <= 0.01 ? "≤ 0,01" : p.toFixed(3).replace(".", ","));

export default function ForecastPanel({ fc, profiles, fileName }: Props) {
  const [idx, setIdx] = useState(0);
  if (fc.items.length === 0) {
    if (fc.skipped.length === 0) return null;
    return (
      <Card>
        <p className="text-[10px] uppercase tracking-widest text-cyan mb-1">Peramalan ARIMA</p>
        <p className="text-xs text-muted leading-relaxed">
          Tidak dihitung — {fc.skipped.map((s) => `${s.column}: ${s.reason}`).join("; ")}.
        </p>
      </Card>
    );
  }
  const f = fc.items[Math.min(idx, fc.items.length - 1)];
  const prof = profiles.find((p) => p.name === f.column);
  const fmt = (v: number) => (prof ? formatByType(v, prof.type, prof.name) : compactNumber(v));
  const show = Math.min(60, f.history.values.length);
  const chart = (h: number) => (
    <ForecastChart
      height={h}
      labels={f.history.labels.slice(-show)}
      history={f.history.values.slice(-show)}
      futureLabels={f.future.labels}
      mean={f.future.mean}
      lower={f.future.lower}
      upper={f.future.upper}
      format={fmt}
    />
  );
  const ho = f.holdout;
  const lb = f.diagnostics.ljungBox;

  return (
    <section className="space-y-5" aria-labelledby="fc-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cyan">Peramalan Deret Waktu</p>
          <h3 id="fc-heading" className="font-syne font-bold text-white text-lg">
            {f.model.s ? "SARIMA" : "ARIMA"} — metode Box-Jenkins
          </h3>
          <p className="text-xs text-muted mt-1">
            {f.column} ({f.aggregation === "sum" ? "total" : "rata-rata"} per {f.granularity}), {f.n} periode ·{" "}
            <span className="text-white font-mono">{f.model.label}</span>
          </p>
        </div>
        {fc.items.length > 1 && (
          <div role="tablist" aria-label="Pilih metrik" className="flex flex-wrap gap-1.5">
            {fc.items.map((it, i) => (
              <button
                key={it.column}
                role="tab"
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  i === idx ? "border-cyan text-cyan bg-cyan/10" : "border-borderColor text-muted hover:text-white"
                }`}
              >
                {it.column}
              </button>
            ))}
          </div>
        )}
      </div>

      <ChartFrame
        id={`chart-forecast-${f.column}`}
        name={`Ramalan ${f.column}`}
        category="Forecast"
        subtitle={`${f.model.label} · ${f.future.labels.length} ${f.granularity} ke depan · pita = rentang 95%`}
        source={fileName}
        detail={{
          chartKind: "line",
          columnsUsed: [
            { name: f.column, role: `axis Y — ${f.aggregation === "sum" ? "total" : "rata-rata"} per ${f.granularity}` },
            { name: "ramalan ARIMA", role: "garis putus-putus + pita interval 95%" },
          ],
          renderChart: chart,
        }}
      >
        {chart(300)}
      </ChartFrame>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <Step n={1} title="Identifikasi" />
          <p className="text-xs text-muted mb-2">
            Uji KPSS (H0: stasioner, α = 5%) — level lalu tren — membedakan tren stokastik (perlu difference) dari tren
            deterministik (cukup detrend).{f.identification.season ? " Kekuatan musiman F_s menentukan difference musiman." : ""}{" "}
            <span className="text-white">{identificationText(f.model, f.identification.season)}</span>
          </p>
          <table className="w-full text-xs mb-3">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left font-normal pb-1">Deret</th>
                <th className="text-right font-normal pb-1">KPSS</th>
                <th className="text-right font-normal pb-1">p</th>
                <th className="text-right font-normal pb-1">Keputusan</th>
              </tr>
            </thead>
            <tbody>
              {f.identification.kpss.map((k) => (
                <tr key={`${k.d}-${k.test ?? "level"}`} className="border-t border-borderColor/60">
                  <td className="py-1 text-white">{kpssStepLabel(k)}</td>
                  <td className="py-1 text-right font-mono">{k.stat.toFixed(3)}</td>
                  <td className="py-1 text-right font-mono">{pText(k.pValue)}</td>
                  <td className={`py-1 text-right ${k.stationary ? "text-mint" : "text-warning"}`}>
                    {k.stationary ? "stasioner" : "belum stasioner"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-3">
            <Correlogram title="ACF" values={f.identification.acf} bound={f.identification.bound} season={f.identification.season?.period} />
            <Correlogram title="PACF" values={f.identification.pacf} bound={f.identification.bound} season={f.identification.season?.period} />
          </div>
          <p className="text-[10px] text-muted mt-1">
            Batang amber melewati batas ±1,96/√n (garis putus-putus) = autokorelasi signifikan.
          </p>
        </Card>

        <Card>
          <Step n={2} title="Estimasi" />
          <p className="text-xs text-muted mb-2">
            Orde (p, q) dipilih dari AICc terkecil; parameter diestimasi dengan conditional sum of squares.
          </p>
          <p className="font-mono text-[13px] text-white bg-bgSurface/60 border border-borderColor rounded-md px-3 py-2 mb-3 overflow-x-auto whitespace-nowrap">
            {arimaEquation(f.model)}
          </p>
          <p className="text-[11px] text-muted mb-2">
            σ² = {compactNumber(f.model.sigma2)} · AICc = {f.model.aicc.toFixed(1)} · n efektif = {f.model.nEff}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left font-normal pb-1">Kandidat</th>
                <th className="text-right font-normal pb-1">AICc</th>
                <th className="text-right font-normal pb-1">Δ</th>
              </tr>
            </thead>
            <tbody>
              {f.candidates.map((c, i) => (
                <tr key={c.label} className={`border-t border-borderColor/60 ${i === 0 ? "text-white" : "text-muted"}`}>
                  <td className="py-1 font-mono">{c.label}</td>
                  <td className="py-1 text-right font-mono">{c.aicc.toFixed(1)}</td>
                  <td className="py-1 text-right font-mono">{i === 0 ? "—" : `+${(c.aicc - f.candidates[0].aicc).toFixed(1)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <Step n={3} title="Diagnostik residual" />
          {lb ? (
            <p className="text-xs leading-relaxed mb-3">
              <span className="text-muted">Ljung-Box Q = </span>
              <span className="font-mono text-white">{lb.q.toFixed(2)}</span>
              <span className="text-muted"> (lag {lb.lags}, df {lb.df}), p = </span>
              <span className="font-mono text-white">{lb.pValue.toFixed(3).replace(".", ",")}</span>
              <span className="text-muted"> → </span>
              <span className={f.diagnostics.whiteNoise ? "text-mint" : "text-warning"}>
                {f.diagnostics.whiteNoise ? "residual white noise (model memadai)" : "residual masih berpola"}
              </span>
            </p>
          ) : (
            <p className="text-xs text-muted mb-3">Deret terlalu pendek untuk uji Ljung-Box.</p>
          )}
          <Correlogram title="ACF residual" values={f.diagnostics.residualAcf} bound={f.diagnostics.bound} season={f.identification.season?.period} />
        </Card>

        <Card>
          <Step n={4} title="Evaluasi holdout" />
          {ho ? (
            <>
              <p className="text-xs text-muted mb-2">
                Model dilatih tanpa {ho.h} periode terakhir, lalu meramal periode itu. Pembanding: metode naif (nilai
                terakhir){ho.seasonalNaive ? ", naif musiman (nilai musim lalu)," : ""} dan regresi linear.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left font-normal pb-1">Metode</th>
                    <th className="text-right font-normal pb-1">RMSE</th>
                    <th className="text-right font-normal pb-1">MAE</th>
                    <th className="text-right font-normal pb-1">MAPE</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["arima", ho.model, ho.arima],
                      ["snaive", "Naif musiman", ho.seasonalNaive ?? null],
                      ["naive", "Naif", ho.naive],
                      ["linear", "Regresi linear", ho.linear],
                    ] as [ForecastMethod, string, ForecastError | null][]
                  )
                    .filter((row): row is [ForecastMethod, string, ForecastError] => row[2] !== null)
                    .map(([key, label, e]) => (
                    <tr key={key} className={`border-t border-borderColor/60 ${ho.best === key ? "text-mint" : "text-muted"}`}>
                      <td className="py-1">{label}{ho.best === key ? " ✓" : ""}</td>
                      <td className="py-1 text-right font-mono">{fmt(e.rmse)}</td>
                      <td className="py-1 text-right font-mono">{fmt(e.mae)}</td>
                      <td className="py-1 text-right font-mono">{e.mape === null ? "–" : `${e.mape.toFixed(1)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ho.arima.mape !== null && (
                <p className="text-[10px] text-muted mt-2">
                  MAPE {ho.model.split("(")[0]} {ho.arima.mape.toFixed(1)}% → {mapeLabel(ho.arima.mape)} (kriteria Lewis: &lt;10% sangat
                  akurat, 10–20% baik, 20–50% wajar, &gt;50% tidak akurat).
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Deret terlalu pendek untuk evaluasi holdout.</p>
          )}
        </Card>
      </div>

      <Card>
        <p className="text-[10px] uppercase tracking-widest text-cyan mb-2">Ramalan {f.future.labels.length} {f.granularity} ke depan</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left font-normal pb-1">Periode</th>
                <th className="text-right font-normal pb-1">Ramalan</th>
                <th className="text-right font-normal pb-1">Batas bawah 95%</th>
                <th className="text-right font-normal pb-1">Batas atas 95%</th>
              </tr>
            </thead>
            <tbody>
              {f.future.labels.map((l, i) => (
                <tr key={l} className="border-t border-borderColor/60">
                  <td className="py-1 text-white">{l}</td>
                  <td className="py-1 text-right font-mono text-white">{fmt(f.future.mean[i])}</td>
                  <td className="py-1 text-right font-mono text-muted">{fmt(f.future.lower[i])}</td>
                  <td className="py-1 text-right font-mono text-muted">{fmt(f.future.upper[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted mt-2">
          Rentang 95% melebar makin jauh ke depan — ketidakpastian ramalan menumpuk tiap periode.
        </p>
      </Card>

      {(f.notes.length > 0 || fc.skipped.length > 0) && (
        <ul className="text-[11px] text-muted space-y-1">
          {f.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
          {fc.skipped.map((s) => (
            <li key={s.column}>• {s.column} tidak diramal: {s.reason}.</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-cyan mb-1">
      <span className="text-white font-mono mr-1.5">{n}</span>
      {title}
    </p>
  );
}

/**
 * Korelogram mini: batang per lag + garis batas signifikansi ±bound.
 * `season` → garis tipis di lag s, 2s, … supaya lonjakan musiman mudah dilihat.
 */
function Correlogram({
  title,
  values,
  bound,
  season,
}: {
  title: string;
  values: number[];
  bound: number;
  season?: number;
}) {
  const W = 240;
  const H = 72;
  const mid = H / 2;
  const scale = mid - 4;
  const bw = W / Math.max(1, values.length);
  const y = (v: number) => mid - Math.max(-1, Math.min(1, v)) * scale;
  const sig = values.filter((v) => Math.abs(v) > bound).length;
  const seasonLags = season ? Array.from({ length: Math.floor(values.length / season) }, (_, k) => (k + 1) * season) : [];
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[72px]"
        role="img"
        aria-label={`${title} lag 1–${values.length}: ${sig} lag signifikan${seasonLags.length ? `; lag musiman ${seasonLags.join(", ")} ditandai` : ""}`}
      >
        {seasonLags.map((lag) => (
          <line key={lag} x1={(lag - 0.5) * bw} x2={(lag - 0.5) * bw} y1={0} y2={H} stroke="rgba(255,255,255,0.18)" />
        ))}
        <line x1={0} x2={W} y1={mid} y2={mid} stroke="rgba(255,255,255,0.15)" />
        {[bound, -bound].map((b) => (
          <line key={b} x1={0} x2={W} y1={y(b)} y2={y(b)} stroke={PALETTE.amber} strokeOpacity={0.5} strokeDasharray="3 3" />
        ))}
        {values.map((v, i) => {
          const top = Math.min(y(v), mid);
          return (
            <rect
              key={i}
              x={i * bw + bw * 0.2}
              y={top}
              width={bw * 0.6}
              height={Math.max(1, Math.abs(y(v) - mid))}
              fill={Math.abs(v) > bound ? PALETTE.amber : PALETTE.cyan}
              fillOpacity={Math.abs(v) > bound ? 0.95 : 0.55}
            >
              <title>{`lag ${i + 1}: ${v.toFixed(3)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="text-[10px] text-muted flex justify-between">
        <span>{title}</span>
        <span>
          lag 1–{values.length}
          {seasonLags.length ? ` · garis = lag ${seasonLags.join(", ")}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
