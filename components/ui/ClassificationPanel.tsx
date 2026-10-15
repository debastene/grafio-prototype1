"use client";
/**
 * Panel Klasifikasi (lib/engine/classify.ts): pohon keputusan vs Naive Bayes
 * vs baseline kelas mayoritas — disusun seperti laporan praktikum Pembelajaran
 * Mesin: data & split → pemilihan model (CV 1-SE) → evaluasi di data uji →
 * interpretasi (aturan JIKA–MAKA, kepentingan fitur).
 *
 * Di dashboard (baris data tersedia) target bisa diganti; hitungan ulang
 * berjalan di browser. Di halaman proyek (snapshot) hanya hasil tersimpan.
 */

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import type { ClassificationBundle, ClassificationResult, ModelEval } from "@/lib/engine/classify";
import { classifyTable, CLASSIFY_LIMITS } from "@/lib/engine/classify";
import type { ColProfile } from "@/lib/engine/profile";
import type { ParsedRow } from "@/lib/engine/parse";

type Props = {
  cl: ClassificationBundle;
  profiles: ColProfile[];
  /** Baris data bersih — kalau ada, user bisa mengganti kolom target. */
  rows?: ParsedRow[];
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ClassificationPanel({ cl, profiles, rows }: Props) {
  const canRetarget = !!rows && rows.length >= CLASSIFY_LIMITS.minRows;
  const [target, setTarget] = useState<string | null>(cl.result?.target ?? null);
  const [computed, setComputed] = useState<{ target: string; out: ClassificationResult | { reason: string } } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target || target === cl.result?.target || !canRetarget) return;
    setBusy(true);
    // Beri browser kesempatan menggambar status "menghitung" dulu.
    const id = setTimeout(() => {
      setComputed({ target, out: classifyTable(rows!, profiles, target) });
      setBusy(false);
    }, 30);
    return () => clearTimeout(id);
  }, [target, cl.result?.target, canRetarget, rows, profiles]);

  const current = useMemo(() => {
    if (!target) return null;
    if (target === cl.result?.target) return cl.result;
    return computed?.target === target ? computed.out : null;
  }, [target, cl.result, computed]);

  if (!cl.result && cl.candidates.length === 0) return null;
  const result = current && !("reason" in current) ? current : null;
  const reason = current && "reason" in current ? current.reason : !target ? cl.reason : null;

  return (
    <section className="space-y-5" aria-labelledby="cls-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cyan">Klasifikasi</p>
          <h3 id="cls-heading" className="font-syne font-bold text-white text-lg">
            {target ? `Apa yang menentukan ${target}?` : "Pohon keputusan & Naive Bayes"}
          </h3>
          {result && (
            <p className="text-xs text-muted mt-1">
              {result.n} baris · latih {result.nTrain} / uji {result.nTest} (stratified 70/30) · {result.features.length} fitur
            </p>
          )}
        </div>
        {cl.candidates.length > 0 && (canRetarget || !cl.result) && (
          <div role="group" aria-label="Pilih kolom target" className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] uppercase tracking-widest text-muted mr-1">Target</span>
            {cl.candidates.map((c) => (
              <button
                key={c}
                disabled={!canRetarget && c !== cl.result?.target}
                aria-pressed={c === target}
                onClick={() => setTarget(c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                  c === target ? "border-cyan text-cyan bg-cyan/10" : "border-borderColor text-muted hover:text-white"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {busy && (
        <Card>
          <p className="text-xs text-muted">Melatih pohon keputusan & Naive Bayes untuk {target}…</p>
        </Card>
      )}

      {!busy && !result && (
        <Card>
          <p className="text-xs text-muted leading-relaxed">
            {reason ?? "Pilih kolom target."}{" "}
            {!canRetarget && cl.candidates.length > 0 && (
              <>Sebutkan target di arahan analisis, mis. &quot;klasifikasi {cl.candidates[0]}&quot;.</>
            )}
          </p>
        </Card>
      )}

      {!busy && result && <ResultView r={result} />}
    </section>
  );
}

function ResultView({ r }: { r: ClassificationResult }) {
  const bestModel = r.best === "naiveBayes" ? r.naiveBayes : r.tree;
  const bestName = r.best === "naiveBayes" ? "Naive Bayes" : "Pohon keputusan";
  const binary = r.classes.length === 2;
  const mc = r.mcnemar;
  const rows: [ClassificationResult["best"], string, ModelEval][] = [
    ["tree", `Pohon keputusan (kedalaman ${r.tree.depth}, ${r.tree.leaves} daun)`, r.tree],
    ["naiveBayes", "Naive Bayes", r.naiveBayes],
    ["baseline", `Baseline: selalu "${r.baseline.majority}"`, r.baseline],
  ];
  const cvTop = r.tree.cv.reduce((a, b) => (b.mean > a.mean ? b : a));

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {r.classes.map((c) => (
          <span key={c.label} className="text-[11px] px-2 py-0.5 rounded-full border border-borderColor text-muted">
            <span className="text-white">{c.label}</span> {c.count} ({((c.count / r.n) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <Step n={1} title="Perbandingan model (data uji)" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted text-[10px] uppercase tracking-wider">
                  <th className="text-left font-normal pb-1">Model</th>
                  <th className="text-right font-normal pb-1">Akurasi</th>
                  <th className="text-right font-normal pb-1" title="Rata-rata recall tiap kelas">Bal. acc</th>
                  <th className="text-right font-normal pb-1">F1 makro</th>
                  {binary && <th className="text-right font-normal pb-1">AUC</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(([key, label, m]) => (
                  <tr key={key} className={`border-t border-borderColor/60 ${r.best === key ? "text-mint" : "text-muted"}`}>
                    <td className="py-1 pr-2">{label}{r.best === key ? " ✓" : ""}</td>
                    <td className="py-1 text-right font-mono">{pct(m.accuracy)}</td>
                    <td className="py-1 text-right font-mono">{pct(m.balancedAccuracy)}</td>
                    <td className="py-1 text-right font-mono">{pct(m.macroF1)}</td>
                    {binary && <td className="py-1 text-right font-mono">{m.auc === null ? "–" : m.auc.toFixed(3)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            Model terbaik dipilih dari balanced accuracy (rata-rata recall tiap kelas) supaya kelas minoritas tidak
            diabaikan.{binary && r.positiveClass ? ` AUC untuk kelas "${r.positiveClass}".` : ""}
          </p>
          {mc && (
            <p className="text-[11px] mt-2 leading-relaxed">
              <span className="text-muted">Uji McNemar pohon vs Naive Bayes: hanya pohon benar {mc.b}, hanya NB benar {mc.c}, </span>
              <span className="font-mono text-white">p = {mc.pValue.toFixed(3).replace(".", ",")}</span>
              <span className="text-muted">{mc.exact ? " (binomial eksak)" : " (χ², koreksi kontinuitas)"} → </span>
              <span className={mc.pValue < 0.05 ? "text-mint" : "text-muted"}>
                {mc.pValue < 0.05 ? "berbeda signifikan" : "tidak berbeda signifikan"}
              </span>
            </p>
          )}
        </Card>

        <Card>
          <Step n={2} title={`Confusion matrix — ${bestName}`} />
          <ConfusionMatrix m={bestModel} />
          <table className="w-full text-xs mt-3">
            <thead>
              <tr className="text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left font-normal pb-1">Kelas</th>
                <th className="text-right font-normal pb-1">Precision</th>
                <th className="text-right font-normal pb-1">Recall</th>
                <th className="text-right font-normal pb-1">F1</th>
                <th className="text-right font-normal pb-1">n uji</th>
              </tr>
            </thead>
            <tbody>
              {bestModel.perClass.map((c) => (
                <tr key={c.label} className="border-t border-borderColor/60">
                  <td className="py-1 text-white">{c.label}</td>
                  <td className="py-1 text-right font-mono">{pct(c.precision)}</td>
                  <td className="py-1 text-right font-mono">{pct(c.recall)}</td>
                  <td className="py-1 text-right font-mono">{pct(c.f1)}</td>
                  <td className="py-1 text-right font-mono text-muted">{c.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <Step n={3} title="Aturan pohon keputusan" />
          {r.tree.rules.length === 1 && r.tree.rules[0].conditions.length === 0 ? (
            <p className="text-xs text-muted leading-relaxed">
              Tidak ada pemisahan yang membantu di cross-validation → pohon kedalaman 0: semua baris ditebak &quot;
              {r.tree.rules[0].prediction}&quot;.
            </p>
          ) : (
            <ol className="space-y-2">
              {r.tree.rules.map((rule, i) => (
                <li key={i} className="text-xs leading-relaxed rounded-md border border-borderColor bg-bgSurface/60 p-2">
                  <span className="text-muted">JIKA </span>
                  <span className="text-white">{rule.conditions.join(" DAN ") || "(semua baris)"}</span>
                  <span className="text-muted"> MAKA </span>
                  <span className="text-cyan font-semibold">{rule.prediction}</span>
                  <span className="text-muted">
                    {" "}
                    · {(rule.confidence * 100).toFixed(0)}% dari {rule.n} baris latih
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            Kedalaman {r.tree.depth} dipilih dengan 5-fold cross-validation + aturan 1-SE: pohon paling sederhana yang
            skornya masih dalam 1 standard error dari yang terbaik (kedalaman {cvTop.depth}, {pct(cvTop.mean)} ±{" "}
            {pct(cvTop.se)}).
          </p>
          <CvBars cv={r.tree.cv} chosen={r.tree.depth} />
        </Card>

        <Card>
          <Step n={4} title="Kolom paling berpengaruh" />
          {r.tree.importance.length ? (
            <ul className="space-y-1.5">
              {r.tree.importance.slice(0, 8).map((f) => (
                <li key={f.feature} className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-white truncate pr-2" title={f.feature}>{f.feature}</span>
                    <span className="font-mono text-muted">{pct(f.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bgSurface mt-0.5 overflow-hidden">
                    <div className="h-full bg-cyan/70 rounded-full" style={{ width: `${Math.max(2, f.value * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Pohon tidak memakai fitur apa pun.</p>
          )}
          <p className="text-[10px] text-muted mt-2 leading-relaxed">
            Kepentingan = total penurunan impurity Gini oleh kolom itu di pohon (dinormalkan). Menunjukkan asosiasi,
            bukan sebab-akibat.
          </p>
        </Card>
      </div>

      {(r.notes.length > 0 || r.excluded.length > 0) && (
        <ul className="text-[11px] text-muted space-y-1">
          {r.notes.map((n, i) => (
            <li key={i}>• {n}</li>
          ))}
          {r.excluded.length > 0 && (
            <li>• Tidak dipakai sebagai fitur: {r.excluded.map((e) => `${e.column} (${e.reason})`).join(", ")}.</li>
          )}
        </ul>
      )}
    </>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-[10px] uppercase tracking-widest text-cyan mb-2">
      <span className="text-white font-mono mr-1.5">{n}</span>
      {title}
    </p>
  );
}

function ConfusionMatrix({ m }: { m: ModelEval }) {
  const labels = m.perClass.map((c) => c.label);
  const max = Math.max(1, ...m.confusion.flat());
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-[10px] text-muted font-normal text-left pr-2">aktual ↓ / prediksi →</th>
            {labels.map((l) => (
              <th key={l} className="text-[10px] text-muted font-normal px-1 truncate max-w-[80px]" title={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.confusion.map((row, i) => (
            <tr key={labels[i]}>
              <th className="text-[10px] text-white font-normal text-left pr-2 truncate max-w-[100px]" title={labels[i]}>{labels[i]}</th>
              {row.map((v, j) => (
                <td
                  key={j}
                  className={`text-center font-mono rounded px-2 py-1.5 min-w-[44px] ${i === j ? "text-white" : "text-white/80"}`}
                  style={{ background: i === j ? `rgba(0,255,179,${0.12 + 0.5 * (v / max)})` : `rgba(255,77,109,${0.06 + 0.45 * (v / max)})` }}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skor CV per kedalaman (bar = rata-rata, garis = ±1 SE); kedalaman terpilih disorot. */
function CvBars({ cv, chosen }: { cv: { depth: number; mean: number; se: number }[]; chosen: number }) {
  const lo = Math.max(0, Math.min(...cv.map((c) => c.mean - c.se)) - 0.05);
  const hi = Math.min(1, Math.max(...cv.map((c) => c.mean + c.se)) + 0.02);
  const y = (v: number) => 60 - ((v - lo) / (hi - lo || 1)) * 56;
  const W = 240;
  const bw = W / cv.length;
  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${W} 72`} className="w-full h-[72px]" role="img" aria-label={`Balanced accuracy CV per kedalaman; terpilih ${chosen}`}>
        {cv.map((c, i) => {
          const x = i * bw + bw * 0.25;
          const sel = c.depth === chosen;
          return (
            <g key={c.depth}>
              <rect x={x} y={y(c.mean)} width={bw * 0.5} height={60 - y(c.mean)} fill={sel ? "#00FFB3" : "#00D4FF"} fillOpacity={sel ? 0.9 : 0.4} />
              <line x1={x + bw * 0.25} x2={x + bw * 0.25} y1={y(c.mean + c.se)} y2={y(c.mean - c.se)} stroke="#E2E8F0" strokeOpacity={0.6} />
              <text x={x + bw * 0.25} y={70} textAnchor="middle" fontSize={8} fill="#7A88AC">{c.depth}</text>
              <title>{`kedalaman ${c.depth}: ${(c.mean * 100).toFixed(1)}% ± ${(c.se * 100).toFixed(1)}%`}</title>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[10px] text-muted">Balanced accuracy CV per kedalaman pohon (hijau = terpilih)</figcaption>
    </figure>
  );
}
