/**
 * Grafio PDF Report — Editorial / Academic Paper Style.
 *
 * Filosofi desain (target: LaTeX/Overleaf quality untuk soft launch):
 *   - PAPER WHITE background. Dark theme di slide cantik tapi di PDF terlihat
 *     unprofessional & boros tinta. Putih = LaTeX, McKinsey, scientific paper.
 *   - SERIF body (Times) untuk paragraf — gaya LaTeX. SANS (Helvetica) untuk
 *     heading & label. MONO (Courier) untuk angka tabular.
 *   - Hierarchy: nomor seksi besar di kiri (1., 2., …) + judul jelas.
 *     Sub-section pakai uppercase tracking spaced.
 *   - Tabel: ALTERNATING row tint pakai abu-abu tipis (slate-50) — kontras
 *     tinggi dengan teks gelap, tidak invisible kayak dark theme dulu.
 *   - Header/footer minimal — cuma hairline + caption kecil. Tidak ada
 *     ornamen background yang bikin sibuk.
 *   - Cover: 1 logo, 1 judul besar, 1 subtitle, 1 metadata block. Lainnya
 *     diserahkan ke executive summary (page 2).
 *
 * Helvetica/Times jsPDF tidak support Unicode native. safeText() me-mapping
 * ke ASCII equivalents. Cukup untuk Bahasa Indonesia + simbol matematika
 * dasar yang dipakai.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EngineResult } from "@/lib/engine";
import { kmoLabel } from "@/lib/engine/multivariate";
import { compactNumber, formatByType, formatP } from "@/lib/engine/stats";
import { arimaEquation, identificationText, kpssStepLabel, mapeLabel, methodLabel } from "@/lib/engine/forecast";
import { SITE_HOST } from "@/lib/site";

// ============================================================
// LOGO CACHE
// ============================================================

type LogoAsset = { dataUrl: string; alias: string };
let _logoCache: LogoAsset | null = null;

async function loadLogo(): Promise<LogoAsset | null> {
  if (typeof window === "undefined") return null;
  if (_logoCache) return _logoCache;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/grafio-logo.png";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Logo load failed"));
      setTimeout(() => reject(new Error("Logo load timeout")), 3000);
    });

    // Logo asli BG hitam — di paper putih kita perlu inverted (transparent atau
    // light). Render ke canvas dengan BG putih supaya nyatu dengan kertas.
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, 0, 0, 256, 256);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    _logoCache = { dataUrl, alias: "grafio-logo-light" };
    return _logoCache;
  } catch {
    return null;
  }
}

// ============================================================
// THEME — Editorial light palette
// ============================================================

const TH = {
  // Paper
  paper: [255, 255, 255] as [number, number, number],
  paperOff: [250, 250, 250] as [number, number, number], // very subtle off-white
  rowAlt: [248, 250, 252] as [number, number, number], // slate-50

  // Text
  ink: [15, 23, 42] as [number, number, number], // slate-900 — body & headers
  inkSoft: [51, 65, 85] as [number, number, number], // slate-700
  inkMuted: [100, 116, 139] as [number, number, number], // slate-500
  inkFaint: [148, 163, 184] as [number, number, number], // slate-400

  // Brand
  brand: [6, 95, 175] as [number, number, number], // deep editorial blue
  brandLight: [219, 234, 254] as [number, number, number], // blue tint
  brandDark: [12, 74, 110] as [number, number, number], // accent for dividers

  // Status
  positive: [21, 128, 61] as [number, number, number], // green-700
  negative: [185, 28, 28] as [number, number, number], // red-700
  warning: [180, 83, 9] as [number, number, number], // amber-700
  insight: [124, 58, 237] as [number, number, number], // violet-600

  // Layout
  rule: [203, 213, 225] as [number, number, number], // slate-300
  ruleSoft: [226, 232, 240] as [number, number, number], // slate-200
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56; // ~2cm — academic
const MARGIN_TOP = 80;
const MARGIN_BOTTOM = 70;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

// ============================================================
// TEXT SANITIZATION — strip non-ASCII (Helvetica/Times built-in tidak support)
// ============================================================

function safeText(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/≠/g, "!=")
    .replace(/×/g, "x").replace(/÷/g, "/")
    .replace(/→/g, "->").replace(/←/g, "<-").replace(/↔/g, "<->")
    .replace(/⇒/g, "=>").replace(/⇐/g, "<=")
    .replace(/●|•/g, "*").replace(/▲/g, "^").replace(/▼/g, "v").replace(/★|☆/g, "*")
    .replace(/…/g, "...").replace(/—/g, "--").replace(/–/g, "-")
    .replace(/“|”/g, '"').replace(/‘|’/g, "'")
    .replace(/Σ/g, "Sum").replace(/Δ/g, "delta").replace(/π/g, "pi").replace(/√/g, "sqrt")
    .replace(/[ -⁯]/g, " ") // general punctuation block (em-space etc.)
    .replace(/[^\x20-\x7E\n\r\t]/g, "");
}

function trunc(s: string, n: number): string {
  const safe = safeText(s);
  if (safe.length <= n) return safe;
  return safe.slice(0, n - 1) + "...";
}

// Number formatting — Indonesian locale dengan thousand separator
function fmtNum(n: number, maxFrac = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: maxFrac });
}

// ============================================================
// PAGE BUILDER
// ============================================================

class Paper {
  doc: jsPDF;
  y: number;
  fileName: string;
  /** Section counter — incremented setiap section() call. */
  sectionNum = 0;

  constructor(fileName: string) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.y = MARGIN_TOP;
    this.fileName = fileName;
    this.paintBg();
  }

  paintBg(): void {
    this.doc.setFillColor(...TH.paper);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  ensureSpace(needed: number): void {
    if (this.y + needed > PAGE_H - MARGIN_BOTTOM) this.newPage();
  }

  newPage(): void {
    if (this.doc.getNumberOfPages() >= 30) return;
    this.doc.addPage();
    this.paintBg();
    this.y = MARGIN_TOP;
  }

  // -------------- Primitives --------------

  /** Section header dengan nomor besar (1., 2., …) — gaya jurnal akademik. */
  section(title: string, subtitle?: string): void {
    this.sectionNum++;
    this.ensureSpace(80);

    // Section number (large blue) + title
    this.doc.setFont("times", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TH.brand);
    const numStr = `${this.sectionNum}`;
    this.doc.text(numStr, MARGIN_X, this.y);

    this.doc.setFont("times", "bold");
    this.doc.setFontSize(20);
    this.doc.setTextColor(...TH.ink);
    const numWidth = this.doc.getTextWidth(numStr + "  ");
    this.doc.text(safeText(title), MARGIN_X + numWidth, this.y);

    this.y += 8;
    // Subtle blue underline beneath section title
    this.doc.setDrawColor(...TH.brand);
    this.doc.setLineWidth(1);
    this.doc.line(MARGIN_X, this.y, MARGIN_X + 36, this.y);

    if (subtitle) {
      this.y += 18;
      this.doc.setFont("times", "italic");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...TH.inkMuted);
      const lines = this.doc.splitTextToSize(safeText(subtitle), CONTENT_W) as string[];
      lines.forEach((ln, i) => this.doc.text(ln, MARGIN_X, this.y + i * 13));
      this.y += lines.length * 13 + 12;
    } else {
      this.y += 20;
    }
  }

  /**
   * Sub-section: uppercase tracked-out label. `keepWith` = tinggi konten
   * sesudahnya (chart) supaya judul tidak tertinggal sendirian di dasar halaman.
   */
  subhead(text: string, keepWith = 0): void {
    this.ensureSpace(22 + keepWith);
    this.y += 6;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...TH.brand);
    this.doc.setCharSpace(1.5);
    this.doc.text(safeText(text).toUpperCase(), MARGIN_X, this.y);
    this.doc.setCharSpace(0);
    this.y += 6;
    this.doc.setDrawColor(...TH.rule);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_X, this.y, MARGIN_X + 30, this.y);
    this.y += 12;
  }

  /** Body paragraph — Times serif, justified-ish (line wrap). */
  paragraph(text: string, opts: { color?: [number, number, number]; italic?: boolean; size?: number } = {}): void {
    const safe = safeText(text);
    if (!safe.trim()) return;
    this.doc.setFont("times", opts.italic ? "italic" : "normal");
    this.doc.setFontSize(opts.size ?? 10.5);
    this.doc.setTextColor(...(opts.color ?? TH.ink));
    const lines = this.doc.splitTextToSize(safe, CONTENT_W) as string[];
    const lh = (opts.size ?? 10.5) * 1.35;
    for (const ln of lines) {
      this.ensureSpace(lh);
      this.doc.text(ln, MARGIN_X, this.y);
      this.y += lh;
    }
    this.y += 4;
  }

  /** Pull quote — blockquote with vertical rule on left (LaTeX `quote` env style). */
  pullQuote(text: string, label?: string): void {
    const safe = safeText(text);
    if (!safe.trim()) return;
    this.ensureSpace(40);
    const lines = this.doc.splitTextToSize(safe, CONTENT_W - 30) as string[];
    const blockH = lines.length * 14 + 14;
    this.ensureSpace(blockH);
    // Left rule
    this.doc.setDrawColor(...TH.brand);
    this.doc.setLineWidth(2.5);
    this.doc.line(MARGIN_X, this.y, MARGIN_X, this.y + blockH - 6);
    // Quote text
    this.doc.setFont("times", "italic");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TH.inkSoft);
    lines.forEach((ln, i) => this.doc.text(ln, MARGIN_X + 14, this.y + 12 + i * 14));
    this.y += blockH;
    if (label) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...TH.inkMuted);
      this.doc.setCharSpace(1);
      this.doc.text("-- " + safeText(label).toUpperCase(), MARGIN_X + 14, this.y);
      this.doc.setCharSpace(0);
      this.y += 14;
    }
    this.y += 8;
  }

  /** Definition list — key=value pairs (Tipografi LaTeX `description`). */
  defList(items: { label: string; value: string }[]): void {
    for (const it of items) {
      this.ensureSpace(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...TH.inkMuted);
      const lbl = safeText(it.label).toUpperCase() + "  ";
      this.doc.text(lbl, MARGIN_X, this.y);
      const lblW = this.doc.getTextWidth(lbl);
      this.doc.setFont("times", "normal");
      this.doc.setFontSize(10);
      this.doc.setTextColor(...TH.ink);
      const valLines = this.doc.splitTextToSize(safeText(it.value), CONTENT_W - lblW) as string[];
      valLines.forEach((ln, i) => this.doc.text(ln, MARGIN_X + lblW, this.y + i * 13));
      this.y += Math.max(14, valLines.length * 13 + 2);
    }
    this.y += 4;
  }

  /** KPI strip — 4 metric boxes in a row, clean editorial style. */
  kpiStrip(kpis: { label: string; value: string; change?: number | null }[]): void {
    if (kpis.length === 0) return;
    const items = kpis.slice(0, 4);
    const gap = 12;
    const w = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const h = 78;
    this.ensureSpace(h + 14);

    const startY = this.y;
    items.forEach((k, i) => {
      const x = MARGIN_X + i * (w + gap);
      // Card: no fill (white paper), border + accent top line
      this.doc.setDrawColor(...TH.rule);
      this.doc.setLineWidth(0.6);
      this.doc.rect(x, startY, w, h);
      // Top accent
      this.doc.setFillColor(...TH.brand);
      this.doc.rect(x, startY, w, 2.5, "F");
      // Label
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...TH.inkMuted);
      this.doc.setCharSpace(1.2);
      let label = safeText(k.label).toUpperCase();
      while (label.length > 4 && this.doc.getTextWidth(label) > w - 20) label = label.slice(0, -2) + ".";
      this.doc.text(label, x + 12, startY + 20);
      this.doc.setCharSpace(0);
      // Value
      this.doc.setFont("times", "bold");
      this.doc.setFontSize(20);
      this.doc.setTextColor(...TH.ink);
      const valTxt = trunc(k.value, 14);
      this.doc.text(valTxt, x + 12, startY + 48);
      // Change
      if (typeof k.change === "number") {
        const positive = k.change >= 0;
        this.doc.setFont("helvetica", "bold");
        this.doc.setFontSize(8.5);
        this.doc.setTextColor(...(positive ? TH.positive : TH.negative));
        const arrow = positive ? "^" : "v";
        this.doc.text(`${arrow} ${Math.abs(k.change).toFixed(1)}%`, x + 12, startY + 66);
      }
    });
    this.y += h + 14;
  }

  /** Table — clean editorial style with alternating row tint. */
  table({
    head,
    body,
    align,
  }: {
    head: string[];
    body: (string | number)[][];
    /** Optional per-column alignment: "left" | "right" | "center". */
    align?: ("left" | "right" | "center")[];
  }): void {
    if (body.length === 0) return;
    this.ensureSpace(60);

    autoTable(this.doc, {
      startY: this.y,
      head: [head.map((h) => safeText(h))],
      body: body.map((row) => row.map((c) => safeText(String(c)))),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: TH.ink,
        fillColor: TH.paper,
        lineColor: TH.ruleSoft,
        lineWidth: 0.3,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
        overflow: "linebreak",
      },
      headStyles: {
        font: "helvetica",
        fontStyle: "bold",
        fillColor: TH.paper,
        textColor: TH.brand,
        fontSize: 8,
        lineColor: TH.ink,
        lineWidth: 0,
        cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
      },
      alternateRowStyles: { fillColor: TH.rowAlt },
      // Draw thick rule above + below header
      didParseCell: (data) => {
        if (data.section === "head") {
          // bottom border
          data.cell.styles.lineWidth = 0;
        }
        // Per-column alignment
        if (align && align[data.column.index]) {
          data.cell.styles.halign = align[data.column.index];
        }
      },
      didDrawCell: (data) => {
        if (data.section === "head" && data.column.index === 0) {
          // Single line above header row (across full row width)
          const tableX = data.table.settings.margin.left as number;
          const tableW = data.table.getWidth(this.doc.internal.pageSize.getWidth()) ?? CONTENT_W;
          this.doc.setDrawColor(...TH.ink);
          this.doc.setLineWidth(1);
          this.doc.line(tableX, data.cell.y, tableX + tableW, data.cell.y);
          // Line below header
          this.doc.setDrawColor(...TH.ink);
          this.doc.setLineWidth(0.4);
          this.doc.line(tableX, data.cell.y + data.cell.height, tableX + tableW, data.cell.y + data.cell.height);
        }
      },
      // top/bottom: tabel yang berlanjut ke halaman baru tidak menimpa header/footer.
      // JANGAN cat background di didDrawPage — hook itu jalan SETELAH tabel
      // digambar, jadi persegi putihnya menutupi seluruh isi halaman. Kertas
      // PDF sudah putih secara default.
      margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP, bottom: MARGIN_BOTTOM },
    });

    // Bottom border below table
    const finalY = (this.doc as any).lastAutoTable.finalY as number;
    this.doc.setDrawColor(...TH.ink);
    this.doc.setLineWidth(0.8);
    this.doc.line(MARGIN_X, finalY, MARGIN_X + CONTENT_W, finalY);
    this.y = finalY + 14;
  }

  /** Insight callout box — accent left bar, badge top-right. */
  insightCallout(opts: {
    title: string;
    body: string;
    kind?: "trend" | "anomaly" | "target" | "idea";
  }): void {
    const colorMap = {
      trend: TH.brand,
      anomaly: TH.warning,
      target: TH.positive,
      idea: TH.insight,
    };
    const color = colorMap[opts.kind ?? "trend"];
    const safeBody = safeText(opts.body).slice(0, 320);
    const lines = this.doc.splitTextToSize(safeBody, CONTENT_W - 30) as string[];
    const bodyH = lines.length * 13;
    const cardH = 16 + 8 + bodyH + 16;
    this.ensureSpace(cardH + 8);

    // Left accent bar
    this.doc.setFillColor(...color);
    this.doc.rect(MARGIN_X, this.y, 3, cardH, "F");
    // Body bg (very light off-white)
    this.doc.setFillColor(...TH.paperOff);
    this.doc.setDrawColor(...TH.ruleSoft);
    this.doc.setLineWidth(0.3);
    this.doc.rect(MARGIN_X + 3, this.y, CONTENT_W - 3, cardH, "FD");

    // Title
    this.doc.setFont("times", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TH.ink);
    this.doc.text(trunc(opts.title, 90), MARGIN_X + 16, this.y + 18);

    // Kind label (top-right)
    if (opts.kind) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...color);
      this.doc.setCharSpace(1.5);
      const kindTxt = opts.kind.toUpperCase();
      const kindW = this.doc.getTextWidth(kindTxt);
      this.doc.text(kindTxt, MARGIN_X + CONTENT_W - kindW - 10, this.y + 18);
      this.doc.setCharSpace(0);
    }

    // Body
    this.doc.setFont("times", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...TH.inkSoft);
    lines.forEach((ln, i) => this.doc.text(ln, MARGIN_X + 16, this.y + 36 + i * 13));

    this.y += cardH + 8;
  }

  /** Horizontal correlation bar — clean editorial chart-style. */
  corrBar(c: { a: string; b: string; r: number; strength: string }): void {
    this.ensureSpace(50);
    const labelTxt = `${trunc(c.a, 26)}  vs.  ${trunc(c.b, 26)}`;
    this.doc.setFont("times", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...TH.ink);
    this.doc.text(safeText(labelTxt), MARGIN_X, this.y);

    const positive = c.r > 0;
    const rText = `r = ${c.r.toFixed(3)}`;
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...(positive ? TH.positive : TH.negative));
    const rW = this.doc.getTextWidth(rText);
    this.doc.text(rText, MARGIN_X + CONTENT_W - rW, this.y);

    this.y += 8;
    // Bar track
    const barH = 5;
    this.doc.setFillColor(...TH.ruleSoft);
    this.doc.rect(MARGIN_X, this.y, CONTENT_W, barH, "F");
    // Bar fill (centered on 0, extending left or right based on sign — like
    // diverging chart). Untuk simplicity, gambar dari kiri proporsional.
    this.doc.setFillColor(...(positive ? TH.positive : TH.negative));
    this.doc.rect(MARGIN_X, this.y, CONTENT_W * Math.abs(c.r), barH, "F");

    this.y += barH + 4;
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8);
    this.doc.setTextColor(...TH.inkMuted);
    this.doc.text(`${c.strength}, ${positive ? "positif" : "negatif"}`, MARGIN_X, this.y);
    this.y += 18;
  }

  /** Numbered recommendation — McKinsey style. */
  recommendation(num: number, title: string, body: string): void {
    const safeBody = safeText(body).slice(0, 400);
    const lines = this.doc.splitTextToSize(safeBody, CONTENT_W - 36) as string[];
    const cardH = 24 + lines.length * 13 + 16;
    this.ensureSpace(cardH + 10);

    // Number in serif circle
    this.doc.setFont("times", "bold");
    this.doc.setFontSize(22);
    this.doc.setTextColor(...TH.brand);
    this.doc.text(String(num) + ".", MARGIN_X, this.y + 16);
    const numW = this.doc.getTextWidth(String(num) + ". ");

    // Title
    this.doc.setFont("times", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(...TH.ink);
    this.doc.text(trunc(title, 80), MARGIN_X + numW + 4, this.y + 14);

    // Body
    this.doc.setFont("times", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...TH.inkSoft);
    lines.forEach((ln, i) => this.doc.text(ln, MARGIN_X + numW + 4, this.y + 30 + i * 13));

    this.y += cardH + 4;
  }

  /**
   * Scree plot — batang % variasi per komponen. Garis putus-putus = kriteria
   * Kaiser: nilai eigen 1 setara dengan 1/p variasi (rata-rata satu kolom).
   */
  screeChart(explained: number[]): void {
    const n = explained.length;
    if (n === 0) return;
    const h = 110;
    const padTop = 14;
    this.ensureSpace(h + padTop + 30);
    const x0 = MARGIN_X + 30;
    const w = CONTENT_W - 30;
    const y0 = this.y + padTop;
    const kaiser = 1 / n;
    const yMax = Math.min(1, Math.ceil(Math.max(...explained, kaiser) * 10) / 10);
    const sy = (v: number) => y0 + h - (v / yMax) * h;
    const doc = this.doc;

    // Sumbu Y: 0, setengah, maks
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TH.inkMuted);
    for (const t of [0, yMax / 2, yMax]) {
      const label = `${Math.round(t * 100)}%`;
      doc.text(label, x0 - 6 - doc.getTextWidth(label), sy(t) + 2.5);
      doc.setDrawColor(...TH.ruleSoft);
      doc.setLineWidth(0.3);
      doc.line(x0, sy(t), x0 + w, sy(t));
    }

    const slot = w / n;
    const barW = Math.min(34, slot * 0.6);
    explained.forEach((e, i) => {
      const cx = x0 + (i + 0.5) * slot;
      const top = sy(e);
      doc.setFillColor(...(e > kaiser ? TH.brand : TH.brandLight));
      doc.rect(cx - barW / 2, top, barW, y0 + h - top, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...TH.ink);
      const v = `${(e * 100).toFixed(0)}%`;
      doc.text(v, cx - doc.getTextWidth(v) / 2, top - 3);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TH.inkMuted);
      const lbl = `PC${i + 1}`;
      doc.text(lbl, cx - doc.getTextWidth(lbl) / 2, y0 + h + 11);
    });

    // Garis Kaiser
    const ky = sy(kaiser);
    doc.setDrawColor(...TH.warning);
    doc.setLineWidth(0.7);
    doc.setLineDashPattern([3, 2], 0);
    doc.line(x0, ky, x0 + w, ky);
    doc.setLineDashPattern([], 0);
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...TH.warning);
    const kl = "Kaiser (nilai eigen = 1)";
    doc.text(kl, x0 + w - doc.getTextWidth(kl), ky - 3);

    this.y = y0 + h + 26;
  }

  /**
   * Scatter plot PC1 x PC2. `g` = nomor klaster (1..k) untuk warna, 0 = tanpa klaster.
   */
  scatterPlot(opts: {
    points: { x: number; y: number; g: number }[];
    colors: [number, number, number][];
    legend: { label: string; g: number }[];
    xLabel: string;
    yLabel: string;
  }): void {
    const pts = opts.points;
    if (pts.length === 0) return;
    const h = 220;
    this.ensureSpace(h + 56);
    const doc = this.doc;
    const x0 = MARGIN_X + 18;
    const w = CONTENT_W - 18;
    const y0 = this.y;

    const extent = (vs: number[]): [number, number] => {
      let lo = Math.min(...vs);
      let hi = Math.max(...vs);
      if (hi - lo < 1e-9) {
        lo -= 1;
        hi += 1;
      }
      const pad = (hi - lo) * 0.06;
      return [lo - pad, hi + pad];
    };
    const [xmin, xmax] = extent(pts.map((p) => p.x));
    const [ymin, ymax] = extent(pts.map((p) => p.y));
    const sx = (v: number) => x0 + ((v - xmin) / (xmax - xmin)) * w;
    const sy = (v: number) => y0 + h - ((v - ymin) / (ymax - ymin)) * h;

    // Bingkai + garis nol (rata-rata setelah standardisasi)
    doc.setDrawColor(...TH.rule);
    doc.setLineWidth(0.5);
    doc.rect(x0, y0, w, h);
    doc.setDrawColor(...TH.ruleSoft);
    doc.setLineDashPattern([2, 2], 0);
    if (xmin < 0 && xmax > 0) doc.line(sx(0), y0, sx(0), y0 + h);
    if (ymin < 0 && ymax > 0) doc.line(x0, sy(0), x0 + w, sy(0));
    doc.setLineDashPattern([], 0);

    for (const p of pts) {
      const c = p.g > 0 ? opts.colors[(p.g - 1) % opts.colors.length] : TH.brand;
      doc.setFillColor(...c);
      doc.circle(sx(p.x), sy(p.y), 1.7, "F");
    }

    // Label sumbu
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TH.inkMuted);
    const xl = safeText(opts.xLabel);
    doc.text(xl, x0 + w / 2 - doc.getTextWidth(xl) / 2, y0 + h + 12);
    const yl = safeText(opts.yLabel);
    doc.text(yl, x0 - 6, y0 + h / 2 + doc.getTextWidth(yl) / 2, { angle: 90 });

    // Legenda
    let lx = x0;
    let ly = y0 + h + 28;
    doc.setFontSize(8);
    for (const item of opts.legend) {
      const txt = safeText(item.label);
      const itemW = 12 + doc.getTextWidth(txt) + 14;
      if (lx + itemW > x0 + w) {
        lx = x0;
        ly += 12;
      }
      const c = item.g > 0 ? opts.colors[(item.g - 1) % opts.colors.length] : TH.brand;
      doc.setFillColor(...c);
      doc.circle(lx + 3, ly - 2.5, 3, "F");
      doc.setTextColor(...TH.inkSoft);
      doc.text(txt, lx + 10, ly);
      lx += itemW;
    }
    this.y = ly + 16;
  }

  /**
   * Grafik ramalan: aktual (biru) + ramalan (amber putus-putus) + pita 95%.
   */
  forecastChart(opts: {
    labels: string[];
    history: number[];
    futureLabels: string[];
    mean: number[];
    lower: number[];
    upper: number[];
    format: (v: number) => string;
  }): void {
    const { history, mean, lower, upper } = opts;
    const n = history.length;
    const h = mean.length;
    if (n === 0 || h === 0) return;
    const H = 170;
    this.ensureSpace(H + 40);
    const doc = this.doc;
    const x0 = MARGIN_X + 44;
    const w = CONTENT_W - 44;
    const y0 = this.y;

    let lo = Math.min(...history, ...lower);
    let hi = Math.max(...history, ...upper);
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    const total = n + h;
    const sx = (i: number) => x0 + (i / (total - 1)) * w;
    const sy = (v: number) => y0 + H - ((v - lo) / (hi - lo)) * H;

    // Grid + label sumbu Y
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    for (const t of [0, 0.5, 1]) {
      const v = lo + pad + t * (hi - lo - 2 * pad);
      doc.setDrawColor(...TH.ruleSoft);
      doc.setLineWidth(0.3);
      doc.line(x0, sy(v), x0 + w, sy(v));
      doc.setTextColor(...TH.inkMuted);
      const label = safeText(opts.format(v));
      doc.text(label, x0 - 5 - doc.getTextWidth(label), sy(v) + 2.5);
    }

    // Pita 95% (poligon: atas maju, bawah mundur) — disambung ke aktual terakhir.
    const bandUp = [[n - 1, history[n - 1]], ...upper.map((v, i) => [n + i, v])];
    const bandLo = [[n - 1, history[n - 1]], ...lower.map((v, i) => [n + i, v])].reverse();
    const poly = [...bandUp, ...bandLo].map(([i, v]) => [sx(i), sy(v)]);
    const segs = poly.slice(1).map((pt, k) => [pt[0] - poly[k][0], pt[1] - poly[k][1]]);
    doc.setFillColor(254, 243, 199); // amber-100
    doc.lines(segs, poly[0][0], poly[0][1], [1, 1], "F", true);

    // Garis aktual
    doc.setDrawColor(...TH.brand);
    doc.setLineWidth(1.1);
    for (let i = 1; i < n; i++) doc.line(sx(i - 1), sy(history[i - 1]), sx(i), sy(history[i]));

    // Garis ramalan (putus-putus)
    doc.setDrawColor(...TH.warning);
    doc.setLineWidth(1.3);
    doc.setLineDashPattern([4, 2.5], 0);
    let px = sx(n - 1);
    let py = sy(history[n - 1]);
    mean.forEach((v, i) => {
      doc.line(px, py, sx(n + i), sy(v));
      px = sx(n + i);
      py = sy(v);
    });
    doc.setLineDashPattern([], 0);

    // Pemisah aktual | ramalan
    doc.setDrawColor(...TH.rule);
    doc.setLineWidth(0.4);
    doc.line(sx(n - 1), y0, sx(n - 1), y0 + H);

    // Label sumbu X: awal, akhir aktual, akhir ramalan
    doc.setFontSize(7);
    doc.setTextColor(...TH.inkMuted);
    const xl = (i: number, txt: string, align: "left" | "center" | "right") => {
      const t = safeText(txt);
      const tw = doc.getTextWidth(t);
      const x = align === "left" ? sx(i) : align === "right" ? sx(i) - tw : sx(i) - tw / 2;
      doc.text(t, x, y0 + H + 10);
    };
    xl(0, opts.labels[0] ?? "", "left");
    if (n > 2) xl(n - 1, opts.labels[n - 1] ?? "", "center");
    xl(total - 1, opts.futureLabels[h - 1] ?? "", "right");

    // Legenda
    const ly = y0 + H + 24;
    let lx = x0;
    const legend: [string, [number, number, number], "line" | "dash" | "band"][] = [
      ["Aktual", TH.brand, "line"],
      ["Ramalan", TH.warning, "dash"],
      ["Rentang 95%", [254, 243, 199], "band"],
    ];
    doc.setFontSize(8);
    for (const [label, color, kind] of legend) {
      if (kind === "band") {
        doc.setFillColor(...color);
        doc.rect(lx, ly - 5, 14, 6, "F");
      } else {
        doc.setDrawColor(...color);
        doc.setLineWidth(1.3);
        if (kind === "dash") doc.setLineDashPattern([3, 2], 0);
        doc.line(lx, ly - 2, lx + 14, ly - 2);
        doc.setLineDashPattern([], 0);
      }
      doc.setTextColor(...TH.inkSoft);
      doc.text(label, lx + 18, ly);
      lx += 18 + doc.getTextWidth(label) + 16;
    }
    this.y = ly + 14;
  }

  spacer(h: number): void {
    this.y += h;
  }

  /**
   * Stamp page header + footer on every page EXCEPT cover (page 1).
   * Header: minimal — brand left, file right
   * Footer: page number center, copyright caption right
   */
  finalize(logo: LogoAsset | null): void {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      if (i === 1) continue;

      // HEADER hairline
      this.doc.setDrawColor(...TH.rule);
      this.doc.setLineWidth(0.3);
      this.doc.line(MARGIN_X, 50, PAGE_W - MARGIN_X, 50);

      // Brand mark (left)
      if (logo) {
        this.doc.addImage(logo.dataUrl, "JPEG", MARGIN_X, 28, 16, 16, logo.alias, "FAST");
      }
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...TH.ink);
      this.doc.text("Grafio", MARGIN_X + (logo ? 22 : 0), 40);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...TH.inkMuted);
      this.doc.text("· Analytics Report", MARGIN_X + (logo ? 22 : 0) + 32, 40);

      // File name (right)
      this.doc.setFont("times", "italic");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...TH.inkMuted);
      const fn = trunc(this.fileName, 50);
      const fnW = this.doc.getTextWidth(fn);
      this.doc.text(fn, PAGE_W - MARGIN_X - fnW, 40);

      // FOOTER hairline
      this.doc.setDrawColor(...TH.rule);
      this.doc.setLineWidth(0.3);
      this.doc.line(MARGIN_X, PAGE_H - 50, PAGE_W - MARGIN_X, PAGE_H - 50);

      // Page number (center, serif — academic feel)
      this.doc.setFont("times", "normal");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...TH.ink);
      const pn = `- ${i} -`;
      this.doc.text(pn, PAGE_W / 2 - this.doc.getTextWidth(pn) / 2, PAGE_H - 35);

      // Caption (right)
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...TH.inkFaint);
      const cap = SITE_HOST;
      this.doc.text(cap, PAGE_W - MARGIN_X - this.doc.getTextWidth(cap), PAGE_H - 35);
      // Caption (left)
      this.doc.text("See Beyond The Numbers", MARGIN_X, PAGE_H - 35);
    }
  }
}

// ============================================================
// COVER — editorial title page (no header/footer)
// ============================================================

function buildCover(p: Paper, result: EngineResult, logo: LogoAsset | null) {
  const doc = p.doc;
  const cx = PAGE_W / 2;

  // Top thin accent bar — minimal branding signal
  doc.setFillColor(...TH.brand);
  doc.rect(0, 0, PAGE_W, 4, "F");

  // === HEADER STRIP (top) ===
  if (logo) {
    doc.addImage(logo.dataUrl, "JPEG", MARGIN_X, 30, 22, 22, logo.alias, "FAST");
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TH.ink);
  doc.text("GRAFIO", MARGIN_X + 30, 46);
  doc.setFont("times", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...TH.inkMuted);
  doc.text("See Beyond The Numbers", MARGIN_X + 30, 56);

  // Date right
  const dateLong = new Date().toLocaleDateString("id-ID", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TH.inkMuted);
  doc.text(dateLong, PAGE_W - MARGIN_X - doc.getTextWidth(dateLong), 46);
  doc.setFont("times", "italic");
  doc.setFontSize(8);
  const issueId = `ID-${Date.now().toString(36).toUpperCase().slice(-7)}`;
  doc.text(`Issue ${issueId}`, PAGE_W - MARGIN_X - doc.getTextWidth(`Issue ${issueId}`), 56);

  // Header hairline
  doc.setDrawColor(...TH.rule);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, 70, PAGE_W - MARGIN_X, 70);

  // === EDITORIAL LABEL ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TH.brand);
  doc.setCharSpace(2);
  doc.text("ANALYTICS REPORT  /  VOL. 01", MARGIN_X, 110);
  doc.setCharSpace(0);

  // === MAIN TITLE ===
  // Big serif title — academic / editorial feel
  doc.setFont("times", "bold");
  doc.setFontSize(48);
  doc.setTextColor(...TH.ink);
  const titleLines = doc.splitTextToSize(safeText(result.fileName.replace(/\.[^.]+$/, "")), CONTENT_W - 20) as string[];
  let titleY = 160;
  titleLines.slice(0, 2).forEach((ln) => {
    doc.text(ln, MARGIN_X, titleY);
    titleY += 50;
  });

  // Domain subtitle
  doc.setFont("times", "italic");
  doc.setFontSize(15);
  doc.setTextColor(...TH.inkSoft);
  doc.text(safeText(`Studi ${result.domain.name}`), MARGIN_X, titleY + 8);

  // Metadata block — like LaTeX \author + \date
  const metaY = titleY + 50;
  doc.setDrawColor(...TH.ink);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, metaY, MARGIN_X + 50, metaY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TH.inkMuted);
  doc.setCharSpace(1.5);
  doc.text("DATASET", MARGIN_X, metaY + 16);
  doc.text("CAKUPAN", MARGIN_X + 180, metaY + 16);
  doc.text("DIANALISIS OLEH", MARGIN_X + 340, metaY + 16);
  doc.setCharSpace(0);

  doc.setFont("times", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...TH.ink);
  doc.text(trunc(result.fileName, 28), MARGIN_X, metaY + 32);
  doc.text(`${result.rowCount.toLocaleString("id")} baris, ${result.columnCount} kolom`, MARGIN_X + 180, metaY + 32);
  const aiName = result._meta?.model
    ? (result._meta.model.split("/")[1]?.split(":")[0] ?? "Grafio AI")
    : "Grafio Engine v1.2";
  doc.text(trunc(aiName, 24), MARGIN_X + 340, metaY + 32);

  // === ABSTRACT / EXECUTIVE LEAD ===
  const abstractY = metaY + 70;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TH.brand);
  doc.setCharSpace(1.5);
  doc.text("ABSTRAK", MARGIN_X, abstractY);
  doc.setCharSpace(0);

  doc.setDrawColor(...TH.brand);
  doc.setLineWidth(1);
  doc.line(MARGIN_X, abstractY + 6, MARGIN_X + 30, abstractY + 6);

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TH.ink);
  const summaryText = safeText(result.summary ?? "").slice(0, 700);
  const summaryLines = doc.splitTextToSize(
    summaryText || "Ringkasan otomatis sedang diproses. Lihat halaman berikutnya untuk konten lengkap.",
    CONTENT_W,
  ) as string[];
  summaryLines.slice(0, 8).forEach((ln, i) => {
    doc.text(ln, MARGIN_X, abstractY + 26 + i * 16);
  });

  // === KEY FACTS row di bawah abstract ===
  const factY = PAGE_H - 240;
  doc.setDrawColor(...TH.rule);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, factY - 18, PAGE_W - MARGIN_X, factY - 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TH.brand);
  doc.setCharSpace(1.5);
  doc.text("KEY FACTS", MARGIN_X, factY - 4);
  doc.setCharSpace(0);

  const facts = [
    { num: result.rowCount.toLocaleString("id"), label: "Observasi" },
    { num: String(result.numericColCount), label: "Variabel Numerik" },
    { num: String(result.analysis.trends.length), label: "Tren Terdeteksi" },
    { num: String(result.analysis.correlations.length), label: "Korelasi Kuat" },
  ];
  const fw = CONTENT_W / facts.length;
  facts.forEach((f, i) => {
    const fx = MARGIN_X + i * fw;
    doc.setFont("times", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...TH.ink);
    doc.text(f.num, fx, factY + 32);
    doc.setFont("times", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...TH.inkMuted);
    doc.text(f.label, fx, factY + 48);
  });

  // === FOOTER ===
  doc.setDrawColor(...TH.rule);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, PAGE_H - 80, PAGE_W - MARGIN_X, PAGE_H - 80);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TH.ink);
  doc.text("GRAFIO", MARGIN_X, PAGE_H - 60);
  doc.setFont("times", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TH.inkMuted);
  doc.text("Editorial analytics, diterbitkan untuk kebutuhan internal & distribusi terbatas.", MARGIN_X + 38, PAGE_H - 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TH.inkFaint);
  const proc = `Dianalisis dalam ${result.durationMs.toFixed(0)} ms  ·  ${SITE_HOST}`;
  doc.text(proc, PAGE_W - MARGIN_X - doc.getTextWidth(proc), PAGE_H - 60);

  doc.setFont("times", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...TH.inkFaint);
  doc.text("/ See Beyond The Numbers /", MARGIN_X, PAGE_H - 30);
}

// ============================================================
// CONTENT SECTIONS
// ============================================================

function buildSummary(p: Paper, result: EngineResult, aiReport: AiReportContent | null) {
  p.section("Ringkasan Eksekutif", `Konteks ${result.domain.name.toLowerCase()} — narasi disusun oleh Grafio AI atas dasar output engine statistik.`);

  // Main summary as flowing paragraph
  p.paragraph(result.summary ?? "Ringkasan otomatis sedang diproses.");

  // AI extended narrative (cap 3 paragraf, 600 char/paragraf)
  if (aiReport?.narrative) {
    const paragraphs = aiReport.narrative
      .split(/\n{2,}|\r\n\r\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    for (const para of paragraphs) p.paragraph(para.slice(0, 600));
  }

  // User context — pull quote
  if (result.userContext && result.userContext.trim()) {
    p.pullQuote(result.userContext, "Konteks dari pengguna");
  }

  // Conclusion — pull quote
  if (result.conclusion && result.conclusion.trim()) {
    p.pullQuote(result.conclusion, "Pendapat AI tentang temuan");
  }

  // Cleaning summary
  if (result.cleaning.imputedCells > 0 || result.cleaning.cappedCells > 0 || result.cleaning.removedRows > 0 || result.cleaning.removedColumns.length > 0) {
    p.subhead("Pra-pemrosesan Data");
    const ops: string[] = [];
    if (result.cleaning.removedRows > 0) ops.push(`${result.cleaning.removedRows} baris dibuang`);
    if (result.cleaning.removedColumns.length > 0) ops.push(`${result.cleaning.removedColumns.length} kolom dibuang`);
    if (result.cleaning.imputedCells > 0) ops.push(`${result.cleaning.imputedCells} sel kosong diisi median/modus`);
    if (result.cleaning.cappedCells > 0) ops.push(`${result.cleaning.cappedCells} outlier di-cap pada 1.5x IQR`);
    p.paragraph(
      `Sebelum analisis: ${ops.join(", ")}. Health score data meningkat dari ${result.cleaning.healthScoreBefore} menjadi ${result.cleaning.healthScoreAfter} dari skala 100.`,
      { italic: true, color: TH.inkSoft },
    );
  }

  p.subhead("Key Metrics");
  p.kpiStrip(result.kpis.slice(0, 4));

  p.subhead("Karakteristik Dataset");
  p.defList([
    { label: "Kolom Numerik", value: `${result.numericColCount} dari ${result.columnCount}` },
    { label: "Kolom Kategorikal", value: String(result.categoricalColCount) },
    { label: "Kolom Tanggal", value: String(result.dateColCount) },
    {
      label: "Tren Statistik",
      value: !result.analysis.timeAxis && result.analysis.trends.length === 0
        ? "tidak dihitung (tanpa kolom waktu)"
        : `${result.analysis.trends.filter((t) => t.direction !== "datar").length} signifikan dari ${result.analysis.trends.length} diuji`,
    },
    { label: "Pasangan Korelasi", value: `${result.analysis.correlations.length} signifikan (|r| >= 0.3, q < 0.05)` },
    { label: "Outlier (di luar 1.5x IQR)", value: String(result.analysis.anomalies.reduce((a, x) => a + x.count, 0)) },
    {
      label: "Klaster k-means",
      value: result.multivariate?.clusters
        ? `k = ${result.multivariate.clusters.k}, silhouette ${result.multivariate.clusters.silhouette.toFixed(2)} (struktur ${result.multivariate.clusters.structure})`
        : "tidak dihitung",
    },
    {
      label: "Peramalan",
      value: result.forecasts?.items.length
        ? result.forecasts.items.map((f) => `${f.column}: ${f.model.label}`).join("; ")
        : "tidak dihitung",
    },
    { label: "Format Angka", value: result.numberFormat.toUpperCase() },
    { label: "Total Observasi", value: result.rowCount.toLocaleString("id") },
  ]);
}

function buildInsights(p: Paper, result: EngineResult) {
  p.newPage();
  p.section("Temuan Utama", "Insight bermakna yang muncul dari analisis statistik dan kontekstualisasi AI.");

  const insights = result.insights.slice(0, 8);
  if (insights.length === 0) {
    p.paragraph("Tidak ada temuan signifikan terdeteksi pada dataset ini.", { italic: true });
    return;
  }
  insights.forEach((ins) => {
    p.insightCallout({
      title: ins.title,
      body: ins.body,
      kind: (ins.type as "trend" | "anomaly" | "target" | "idea") ?? "trend",
    });
  });
}

function buildProfile(p: Paper, result: EngineResult) {
  p.newPage();
  p.section("Profil Variabel", `Tipe data, persentase missing, dan statistik ringkas untuk ${result.columnCount} kolom.`);

  // Limit to 30 to keep table reasonable — academic tables jarang lebih dari 1-2 hal
  const rows = result.profile.slice(0, 30).map((col) => [
    (col.isLikelyTarget ? "* " : "") + col.name,
    col.type,
    String(col.unique),
    `${(col.missingPct * 100).toFixed(0)}%`,
    col.summary
      ? fmtNum(col.summary.mean)
      : (col.topValues?.[0]?.value ?? "-"),
    col.summary
      ? `${fmtNum(col.summary.min, 1)} - ${fmtNum(col.summary.max, 1)}`
      : `${col.topValues?.length ?? 0} kategori`,
    String(col.outlierCount ?? 0),
  ]);

  p.table({
    head: ["Variabel", "Tipe", "Unik", "Missing", "Rata-rata / Modus", "Rentang / Kategori", "Outlier"],
    body: rows,
    align: ["left", "left", "right", "right", "right", "right", "right"],
  });

  if (result.profile.length > 30) {
    p.doc.setFont("times", "italic");
    p.doc.setFontSize(9);
    p.doc.setTextColor(...TH.inkMuted);
    p.doc.text(
      `Catatan. Menampilkan 30 variabel pertama dari total ${result.profile.length}. Tanda (*) menandai kolom yang diidentifikasi engine sebagai kandidat variabel target.`,
      MARGIN_X,
      p.y,
    );
    p.y += 16;
  }
}

function buildCorrelations(p: Paper, result: EngineResult) {
  if (result.analysis.correlations.length === 0) return;
  p.newPage();
  p.section(
    "Analisis Korelasi",
    "Koefisien Pearson untuk pasangan numerik dengan |r| >= 0.3 yang signifikan setelah koreksi Benjamini-Hochberg (q < 0.05).",
  );

  for (const c of result.analysis.correlations.slice(0, 10)) {
    p.corrBar({ a: c.a, b: c.b, r: c.r, strength: c.strength });
  }

  // Interpretation note
  p.spacer(6);
  p.paragraph(
    "Catatan interpretasi. Koefisien korelasi mengukur asosiasi linier, bukan kausalitas. Nilai r mendekati +/-1 mengindikasikan hubungan kuat, namun verifikasi melalui domain knowledge atau eksperimen terkontrol tetap diperlukan sebelum mengambil kesimpulan kausal.",
    { italic: true, color: TH.inkMuted, size: 9.5 },
  );
}

/** Warna klaster untuk kertas putih — urutan sama dengan panel dashboard. */
const CLUSTER_RGB: [number, number, number][] = [
  [6, 95, 175], // biru
  [217, 119, 6], // amber
  [219, 39, 119], // pink
  [21, 128, 61], // hijau
  [124, 58, 237], // violet
  [100, 116, 139], // abu
];

function buildMultivariate(p: Paper, result: EngineResult) {
  const mv = result.multivariate;
  if (!mv || (!mv.pca && !mv.clusters)) return;
  const { pca, clusters } = mv;

  p.newPage();
  p.section(
    "Analisis Multivariat",
    `PCA matriks korelasi dan klaster k-means pada ${mv.n.toLocaleString("id")} baris lengkap x ${mv.columns.length} kolom numerik yang distandardisasi (z-score): ${mv.columns.join(", ")}.`,
  );

  if (pca) {
    const reasons = [
      ...(pca.bartlett.pValue >= 0.05 ? ["uji Bartlett tidak signifikan"] : []),
      ...((pca.kmo ?? 0) < 0.6 ? [`KMO ${pca.kmo === null ? "tidak terhitung" : pca.kmo.toFixed(3)} < 0.6`] : []),
    ];
    p.subhead("Uji Kelayakan PCA");
    p.defList([
      {
        label: "Bartlett",
        value: `chi-kuadrat = ${pca.bartlett.chi2.toFixed(1)} (df ${pca.bartlett.df}), ${formatP(pca.bartlett.pValue)} -- ${
          pca.bartlett.pValue < 0.05 ? "matriks korelasi berbeda nyata dari matriks identitas" : "korelasi antar kolom tidak signifikan"
        }`,
      },
      // 3 desimal: 0.598 tidak boleh tampil "0.60" lalu dinyatakan < 0.6.
      { label: "KMO", value: pca.kmo === null ? "tidak terhitung (matriks singular)" : `${pca.kmo.toFixed(3)} (${kmoLabel(pca.kmo)})` },
      { label: "Kaiser", value: `${pca.kaiserComponents} komponen dengan nilai eigen > 1` },
    ]);
    if (reasons.length) {
      p.paragraph(
        `Syarat kelayakan belum terpenuhi (${reasons.join("; ")}): pola korelasi antar kolom kurang mendukung peringkasan dengan PCA. Tafsirkan komponen dengan hati-hati.`,
        { italic: true, color: TH.warning, size: 9.5 },
      );
    }

    p.subhead("Variansi Dijelaskan (Scree Plot)", 150);
    p.screeChart(pca.explained);
    p.paragraph(
      `PC1 dan PC2 bersama-sama menjelaskan ${(pca.cumulative[Math.min(1, pca.cumulative.length - 1)] * 100).toFixed(0)}% variasi data.`,
      { size: 10 },
    );

    p.subhead("Loading Komponen");
    p.table({
      head: ["Kolom", "PC1", "PC2"],
      body: pca.columns.map((c, i) => {
        const cell = (v: number) => `${v.toFixed(2)}${Math.abs(v) >= 0.5 ? " *" : ""}`;
        return [c, cell(pca.loadings[i][0]), cell(pca.loadings[i][1] ?? 0)];
      }),
      align: ["left", "right", "right"],
    });
    p.paragraph(
      "Loading = korelasi kolom dengan komponen. Tanda (*) menandai |loading| >= 0.5: kolom tersebut ikut membentuk komponen.",
      { italic: true, color: TH.inkMuted, size: 9 },
    );
  }

  if (pca && mv.points.length > 0) {
    const tiny = new Set(clusters?.tinyClusters ?? []);
    p.subhead("Proyeksi PC1 x PC2", 280);
    p.scatterPlot({
      points: mv.points.map((pt) => ({ x: pt.x, y: pt.y, g: pt.cluster })),
      colors: CLUSTER_RGB,
      legend: clusters
        ? clusters.profiles.map((g) => ({
            g: g.cluster,
            label: `Kelompok ${g.cluster} (${Math.round(g.share * 100)}%)${tiny.has(g.cluster) ? " - outlier?" : ""}`,
          }))
        : [{ g: 0, label: "Baris data" }],
      xLabel: `PC1 (${(pca.explained[0] * 100).toFixed(0)}% variasi)`,
      yLabel: `PC2 (${((pca.explained[1] ?? 0) * 100).toFixed(0)}% variasi)`,
    });
    if (mv.points.length < mv.n) {
      p.paragraph(`Menampilkan ${mv.points.length} dari ${mv.n.toLocaleString("id")} baris (sampel sistematis).`, {
        italic: true,
        color: TH.inkMuted,
        size: 9,
      });
    }
  }

  if (clusters) {
    const tiny = new Set(clusters.tinyClusters ?? []);
    const fmt = (col: string, v: number) => {
      const prof = result.profile.find((x) => x.name === col);
      return prof ? formatByType(v, prof.type, prof.name) : fmtNum(v);
    };
    p.subhead("Klaster k-means");
    p.paragraph(
      `k = ${clusters.k} dipilih dari silhouette tertinggi (${clusters.silhouetteByK
        .map((s) => `k${s.k} = ${s.silhouette.toFixed(2)}`)
        .join(", ")}). Silhouette ${clusters.silhouette.toFixed(2)} berarti struktur kelompok ${clusters.structure} (Kaufman & Rousseeuw: > 0.70 kuat, > 0.50 wajar, > 0.25 lemah).`,
    );
    if (clusters.structure === "tidak ada") {
      p.paragraph(
        "Data tidak membentuk kelompok yang jelas pada kolom-kolom ini. Pembagian di bawah hanya potongan dari satu sebaran, bukan segmen alami.",
        { italic: true, color: TH.warning, size: 9.5 },
      );
    }
    p.table({
      head: ["Kelompok", "Baris", "Porsi", "Ciri utama (rata-rata kelompok)"],
      body: clusters.profiles.map((g) => [
        `${g.cluster}${tiny.has(g.cluster) ? " (outlier?)" : ""}`,
        g.size.toLocaleString("id"),
        `${Math.round(g.share * 100)}%`,
        [
          ...g.high.map((x) => `${x.column} tinggi (${fmt(x.column, g.centroid[x.column])})`),
          ...g.low.map((x) => `${x.column} rendah (${fmt(x.column, g.centroid[x.column])})`),
        ].join("; ") || "mendekati rata-rata di semua kolom",
      ]),
      align: ["left", "right", "right", "left"],
    });
    if (tiny.size > 0) {
      p.paragraph(
        "Kelompok berisi < 5% baris ditandai sebagai kemungkinan outlier, bukan segmen: periksa barisnya satu per satu sebelum dijadikan target.",
        { italic: true, color: TH.inkMuted, size: 9 },
      );
    }
  }

  // Kolom yang tidak diikutkan, dikelompokkan per alasan.
  const byReason = new Map<string, string[]>();
  for (const e of mv.excluded) byReason.set(e.reason, [...(byReason.get(e.reason) ?? []), e.column]);
  const notes = [
    ...mv.notes,
    ...Array.from(byReason, ([reason, columns]) => `Tidak diikutkan (${reason}): ${columns.join(", ")}.`),
  ];
  if (notes.length) {
    p.subhead("Catatan Metode");
    for (const n of notes) p.paragraph(n, { italic: true, color: TH.inkMuted, size: 9 });
  }
  p.paragraph(
    "PCA dan klaster bersifat eksploratif: keduanya merangkum pola, bukan membuktikan sebab-akibat. Validasi kelompok dengan konteks bisnis sebelum dipakai untuk keputusan.",
    { italic: true, color: TH.inkMuted, size: 9 },
  );
}

function buildTrends(p: Paper, result: EngineResult) {
  p.newPage();
  p.section(
    "Tren dan Anomali",
    "Tren: OLS pada data yang diagregasi per periode, uji slope (alpha 5%). Outlier: di luar pagar Tukey 1.5x IQR.",
  );

  if (result.analysis.trends.length > 0) {
    p.subhead("Tren Terdeteksi");
    p.table({
      head: ["Metrik", "Arah", "% (garis tren)", "R-kuadrat", "p-value", "Periode", "Forecast 3 periode"],
      body: result.analysis.trends.slice(0, 8).map((t) => [
        t.column,
        t.direction,
        `${t.pctChange >= 0 ? "+" : ""}${t.pctChange.toFixed(1)}%`,
        t.r2.toFixed(2),
        t.pValue !== undefined ? (t.pValue < 0.001 ? "<0.001" : t.pValue.toFixed(3)) : "-",
        t.periods !== undefined ? String(t.periods) : "-",
        t.forecast.length ? t.forecast.map((v) => fmtNum(v, 1)).join(", ") : "-",
      ]),
      align: ["left", "left", "right", "right", "right", "right", "left"],
    });
  } else if (!result.analysis.timeAxis) {
    p.paragraph(
      "Dataset tidak memiliki kolom waktu (tanggal/tahun/bulan), sehingga tren tidak dihitung. Urutan baris di file bukan urutan waktu.",
      { italic: true, color: TH.inkMuted, size: 9.5 },
    );
  }

  if (result.analysis.anomalies.length > 0) {
    p.subhead("Outlier Statistik");
    p.table({
      head: ["Variabel", "Jumlah Outlier", "z robust", "Nilai Ekstrem", "Lokasi"],
      body: result.analysis.anomalies.slice(0, 10).map((a) => [
        a.column,
        String(a.count),
        a.topExample ? a.topExample.zscore.toFixed(2) : "-",
        a.topExample ? fmtNum(a.topExample.value) : "-",
        a.topExample ? `Baris ${a.topExample.rowIndex + 1}` : "-",
      ]),
      align: ["left", "right", "right", "right", "left"],
    });
  }

  if (result.analysis.segments.length > 0) {
    const seg = result.analysis.segments[0];
    p.subhead(`Perbandingan Segmen: ${seg.groupCol}`);
    p.table({
      head: [seg.groupCol, `Rata-rata ${seg.metricCol}`, "Total", "Jumlah Observasi"],
      body: seg.groups.slice(0, 12).map((g) => [
        g.name,
        fmtNum(g.mean),
        fmtNum(g.sum, 0),
        String(g.count),
      ]),
      align: ["left", "right", "right", "right"],
    });
  }
}

function buildClassification(p: Paper, result: EngineResult) {
  const r = result.classification?.result;
  if (!r) return;
  const pc = (v: number) => `${(v * 100).toFixed(1)}%`;
  const binary = r.classes.length === 2;
  p.newPage();
  p.section(
    "Klasifikasi",
    `Apa yang menentukan ${r.target}? Pohon keputusan (CART, Gini) dan Naive Bayes dibandingkan dengan baseline kelas mayoritas. Data dibagi stratified 70/30; kedalaman pohon dipilih dengan 5-fold cross-validation + aturan 1-SE.`,
  );
  p.defList([
    { label: "Data", value: `${r.n} baris (latih ${r.nTrain}, uji ${r.nTest}); kelas: ${r.classes.map((c) => `${c.label} ${c.count}`).join(", ")}` },
    { label: "Fitur", value: r.features.map((f) => f.name).join(", ") },
  ]);

  p.subhead("Perbandingan Model (data uji)");
  p.table({
    head: ["Model", "Akurasi", "Balanced acc.", "F1 makro", ...(binary ? ["AUC"] : [])],
    body: (
      [
        ["tree", `Pohon keputusan (kedalaman ${r.tree.depth})`, r.tree],
        ["naiveBayes", "Naive Bayes", r.naiveBayes],
        ["baseline", `Baseline (selalu "${r.baseline.majority}")`, r.baseline],
      ] as const
    ).map(([key, label, m]) => [
      `${label}${r.best === key ? " *" : ""}`,
      pc(m.accuracy),
      pc(m.balancedAccuracy),
      pc(m.macroF1),
      ...(binary ? [m.auc === null ? "-" : m.auc.toFixed(3)] : []),
    ]),
    align: ["left", "right", "right", "right", "right"],
  });
  const mc = r.mcnemar;
  p.paragraph(
    `Tanda (*) = model terbaik menurut balanced accuracy.${
      mc
        ? ` Uji McNemar pohon vs Naive Bayes: b = ${mc.b}, c = ${mc.c}, p = ${mc.pValue.toFixed(3)} (${mc.exact ? "binomial eksak" : "chi-kuadrat dengan koreksi kontinuitas"}) -- ${mc.pValue < 0.05 ? "berbeda signifikan" : "tidak berbeda signifikan"}.`
        : ""
    }`,
    { italic: true, color: TH.inkMuted, size: 9 },
  );

  const best = r.best === "naiveBayes" ? r.naiveBayes : r.tree;
  const labels = best.perClass.map((c) => c.label);
  p.subhead(`Confusion Matrix -- ${r.best === "naiveBayes" ? "Naive Bayes" : "Pohon Keputusan"}`);
  p.table({
    head: ["Aktual / Prediksi", ...labels],
    body: best.confusion.map((row, i) => [labels[i], ...row.map(String)]),
    align: ["left", ...labels.map(() => "right" as const)],
  });
  p.table({
    head: ["Kelas", "Precision", "Recall", "F1", "n uji"],
    body: best.perClass.map((c) => [c.label, pc(c.precision), pc(c.recall), pc(c.f1), String(c.support)]),
    align: ["left", "right", "right", "right", "right"],
  });

  p.subhead("Aturan Pohon Keputusan");
  r.tree.rules.forEach((rule, i) =>
    p.paragraph(
      `${i + 1}. JIKA ${rule.conditions.join(" DAN ") || "(semua baris)"} MAKA ${r.target} = ${rule.prediction} (${(rule.confidence * 100).toFixed(0)}% dari ${rule.n} baris latih).`,
      { size: 10 },
    ),
  );
  if (r.tree.importance.length) {
    p.subhead("Kolom Paling Berpengaruh");
    p.table({
      head: ["Kolom", "Kepentingan (penurunan Gini)"],
      body: r.tree.importance.slice(0, 8).map((f) => [f.feature, pc(f.value)]),
      align: ["left", "right"],
    });
  }
  for (const n of r.notes) p.paragraph(n, { italic: true, color: TH.inkMuted, size: 9 });
  p.paragraph(
    "Kepentingan fitur dan aturan pohon menunjukkan asosiasi pada data ini, bukan sebab-akibat. Validasi dengan data baru sebelum dipakai untuk keputusan.",
    { italic: true, color: TH.inkMuted, size: 9 },
  );
}

function buildForecast(p: Paper, result: EngineResult) {
  const fc = result.forecasts;
  if (!fc || (fc.items.length === 0 && fc.skipped.length === 0)) return;
  p.newPage();
  p.section(
    "Peramalan ARIMA",
    "Metode Box-Jenkins (SARIMA bila datanya musiman): identifikasi (uji KPSS, kekuatan musiman, ACF/PACF), estimasi (conditional sum of squares, AICc), diagnostik (Ljung-Box), dan evaluasi holdout terhadap metode naif, naif musiman & regresi linear.",
  );

  fc.items.forEach((f, idx) => {
    if (idx > 0) p.newPage();
    const prof = result.profile.find((x) => x.name === f.column);
    const fmt = (v: number) => (prof ? formatByType(v, prof.type, prof.name) : fmtNum(v));
    const ho = f.holdout;
    const lb = f.diagnostics.ljungBox;

    p.subhead(`${f.column} -- ${f.model.label}`, 220);
    const show = Math.min(60, f.history.values.length);
    p.forecastChart({
      labels: f.history.labels.slice(-show),
      history: f.history.values.slice(-show),
      futureLabels: f.future.labels,
      mean: f.future.mean,
      lower: f.future.lower,
      upper: f.future.upper,
      format: fmt,
    });

    p.defList([
      { label: "Data", value: `${f.n} periode, ${f.aggregation === "sum" ? "total" : "rata-rata"} per ${f.granularity}` },
      {
        label: "1. Identifikasi",
        value: `KPSS ${f.identification.kpss
          .map((k) => `${kpssStepLabel(k)} ${k.stat.toFixed(3)} (${k.stationary ? "stasioner" : "belum stasioner"})`)
          .join("; ")}. ${identificationText(f.model, f.identification.season)}`,
      },
      { label: "2. Estimasi", value: `${arimaEquation(f.model, true)}; sigma^2 = ${compactNumber(f.model.sigma2)}, AICc = ${f.model.aicc.toFixed(1)}.` },
      {
        label: "3. Diagnostik",
        value: lb
          ? `Ljung-Box Q = ${lb.q.toFixed(2)} (lag ${lb.lags}, df ${lb.df}), p = ${lb.pValue.toFixed(3)} -- ${
              lb.pValue >= 0.05 ? "residual white noise, model memadai" : "residual masih berpola"
            }.`
          : "deret terlalu pendek untuk uji Ljung-Box.",
      },
      {
        label: "4. Evaluasi",
        value: ho
          ? `${ho.h} periode terakhir: RMSE ${ho.model.split("(")[0]} ${fmt(ho.arima.rmse)}${ho.seasonalNaive ? `, naif musiman ${fmt(ho.seasonalNaive.rmse)}` : ""}, naif ${fmt(ho.naive.rmse)}, linear ${fmt(ho.linear.rmse)}${
              ho.arima.mape !== null ? `; MAPE ${ho.model.split("(")[0]} ${ho.arima.mape.toFixed(1)}% (${mapeLabel(ho.arima.mape)})` : ""
            } -- terbaik: ${methodLabel(ho.best, ho.model.split("(")[0])}.`
          : "deret terlalu pendek untuk evaluasi holdout.",
      },
    ]);

    p.table({
      head: ["Periode", "Ramalan", "Batas bawah 95%", "Batas atas 95%"],
      body: f.future.labels.map((l, i) => [l, fmt(f.future.mean[i]), fmt(f.future.lower[i]), fmt(f.future.upper[i])]),
      align: ["left", "right", "right", "right"],
    });
    if (f.candidates.length > 1) {
      p.paragraph(
        `Kandidat AICc terbaik: ${f.candidates.map((c) => `${c.label} (${c.aicc.toFixed(1)})`).join(", ")}.`,
        { italic: true, color: TH.inkMuted, size: 9 },
      );
    }
    for (const n of f.notes) p.paragraph(n, { italic: true, color: TH.inkMuted, size: 9 });
  });

  for (const s of fc.skipped) {
    p.paragraph(`${s.column} tidak diramal: ${s.reason}.`, { italic: true, color: TH.inkMuted, size: 9 });
  }
  p.paragraph(
    "Ramalan mengasumsikan pola masa lalu berlanjut. Rentang 95% melebar makin jauh ke depan; kejadian luar biasa (promo, libur, krisis) tidak tercakup model.",
    { italic: true, color: TH.inkMuted, size: 9 },
  );
}

function buildRecommendations(p: Paper, result: EngineResult, aiReport: AiReportContent | null) {
  p.newPage();
  p.section("Rekomendasi", "Langkah konkret yang dapat diambil berdasarkan temuan analitis.");

  if (aiReport?.recommendations && aiReport.recommendations.length > 0) {
    const sorted = [...aiReport.recommendations].sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.impact ?? "medium"] ?? 1) - (order[b.impact ?? "medium"] ?? 1);
    });
    sorted.slice(0, 6).forEach((r, i) => {
      const body = `Aksi. ${r.action}\n\nAlasan. ${r.rationale}`;
      p.recommendation(i + 1, r.title, body);
    });
  } else {
    // Heuristik fallback dari engine output
    const recs: { title: string; body: string }[] = [];
    if (result.analysis.anomalies.length > 0) {
      const a = result.analysis.anomalies[0];
      recs.push({
        title: `Verifikasi outlier pada ${a.column}`,
        body: `Terdeteksi ${a.count} nilai di luar pagar 1.5x IQR. Periksa apakah berasal dari kesalahan input, kasus istimewa yang sah, atau sinyal pasar yang patut diinvestigasi.`,
      });
    }
    if (result.analysis.correlations.find((c) => Math.abs(c.r) > 0.7)) {
      const c = result.analysis.correlations.find((cor) => Math.abs(cor.r) > 0.7)!;
      recs.push({
        title: `Eksplorasi kausalitas ${c.a} dan ${c.b}`,
        body: `Korelasi ${c.strength} (r=${c.r.toFixed(2)}). Pertimbangkan analisis difference-in-differences atau A/B test untuk memastikan asosiasi bukan korelasi semu.`,
      });
    }
    const hasMissing = result.profile.find((pp) => pp.missingPct > 0.3);
    if (hasMissing) {
      recs.push({
        title: "Tingkatkan kualitas data",
        body: `Kolom ${hasMissing.name} memiliki lebih dari 30% nilai kosong. Pertimbangkan imputasi (median/modus), atau drop kolom bila tidak kritikal untuk hipotesis utama.`,
      });
    }
    if (result.cleaning.healthScoreAfter < 80) {
      recs.push({
        title: "Audit pipeline data hulu",
        body: `Health score pasca-cleaning ${result.cleaning.healthScoreAfter}/100. Audit konsistensi tipe, encoding karakter, dan duplikasi sebelum data masuk ke sistem analitis.`,
      });
    }
    recs.push({
      title: "Iterasi analisis lanjutan",
      body: "Pertimbangkan (i) menambah dimensi waktu jika belum ada, (ii) melengkapi dengan data eksternal (benchmark industri, indikator makro), dan (iii) menjalankan A/B test untuk validasi temuan kausal.",
    });
    recs.slice(0, 5).forEach((r, i) => p.recommendation(i + 1, r.title, r.body));
  }

  // Closing colophon
  p.spacer(20);
  p.ensureSpace(40);
  p.doc.setDrawColor(...TH.ink);
  p.doc.setLineWidth(0.6);
  p.doc.line(MARGIN_X, p.y, MARGIN_X + 60, p.y);
  p.y += 12;
  p.doc.setFont("times", "italic");
  p.doc.setFontSize(10);
  p.doc.setTextColor(...TH.inkMuted);
  p.doc.text(
    "Laporan ini diakhiri di sini. Untuk eksplorasi interaktif lebih lanjut, kunjungi dashboard Grafio.",
    MARGIN_X,
    p.y,
  );
}

// ============================================================
// MAIN ENTRY
// ============================================================

export type AiReportContent = {
  narrative?: string;
  recommendations?: { title: string; action: string; rationale: string; impact?: "low" | "medium" | "high" }[];
};

export async function generateReport(
  result: EngineResult,
  aiReport: AiReportContent | null = null,
): Promise<Blob> {
  const p = new Paper(result.fileName);
  const logo = await loadLogo();

  buildCover(p, result, logo);
  p.newPage();
  buildSummary(p, result, aiReport);
  buildInsights(p, result);
  buildProfile(p, result);
  buildCorrelations(p, result);
  buildMultivariate(p, result);
  buildTrends(p, result);
  buildForecast(p, result);
  buildClassification(p, result);
  buildRecommendations(p, result, aiReport);

  p.finalize(logo);
  return p.doc.output("blob");
}

async function fetchAiReport(result: EngineResult): Promise<AiReportContent | null> {
  if (typeof window === "undefined") return null;
  const ac = new AbortController();
  const stop = setTimeout(() => ac.abort(), 25_000);
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({
        mode: "report",
        context: {
          fileName: result.fileName,
          rowCount: result.rowCount,
          domain: `${result.domain.name}${result.domain.description ? " — " + result.domain.description : ""}`,
          summary: result.summary,
          columns: result.profile.slice(0, 12).map((col) => ({
            name: col.name,
            type: col.type,
            mean: col.summary?.mean,
            min: col.summary?.min,
            max: col.summary?.max,
          })),
          trends: result.analysis.trends.slice(0, 4).map((t) => ({
            column: t.column,
            direction: t.direction,
            pctChange: t.pctChange,
            r2: t.r2,
          })),
          correlations: result.analysis.correlations.slice(0, 4).map((c) => ({
            a: c.a, b: c.b, r: c.r, strength: c.strength,
          })),
          anomalies: result.analysis.anomalies.slice(0, 4).map((a) => ({
            column: a.column, count: a.count,
          })),
          kpis: result.kpis.slice(0, 4),
          insights: result.insights.slice(0, 4),
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return {
      narrative: typeof data.narrative === "string" ? data.narrative : undefined,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(stop);
  }
}

export async function downloadReport(result: EngineResult): Promise<void> {
  const aiReport = await fetchAiReport(result);
  const blob = await generateReport(result, aiReport);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = result.fileName.replace(/\.[^.]+$/, "").replace(/[^\w-]/g, "_") || "report";
  a.download = `Grafio_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
