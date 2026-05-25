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

  /** Sub-section: uppercase tracked-out label. */
  subhead(text: string): void {
    this.ensureSpace(22);
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
  kpiStrip(kpis: { label: string; value: string; change?: number }[]): void {
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
      this.doc.text(safeText(k.label).toUpperCase(), x + 12, startY + 20);
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
      margin: { left: MARGIN_X, right: MARGIN_X },
      didDrawPage: () => this.paintBg(),
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
      const cap = "grafio.app";
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
  const proc = `Dianalisis dalam ${result.durationMs.toFixed(0)} ms  ·  grafio.app`;
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
    { label: "Tren Statistik", value: `${result.analysis.trends.length} terdeteksi` },
    { label: "Pasangan Korelasi", value: `${result.analysis.correlations.length} signifikan (|r| >= 0.3)` },
    { label: "Outlier (z >= 2.5)", value: String(result.analysis.anomalies.reduce((a, x) => a + x.count, 0)) },
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
    "Koefisien Pearson untuk pasangan variabel numerik dengan |r| >= 0.3.",
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

function buildTrends(p: Paper, result: EngineResult) {
  p.newPage();
  p.section("Tren dan Anomali", "Arah pertumbuhan jangka pendek (OLS) dan outlier statistik (z-score >= 2.5).");

  if (result.analysis.trends.length > 0) {
    p.subhead("Tren Terdeteksi");
    p.table({
      head: ["Metrik", "Arah", "% Perubahan", "R-kuadrat", "Awal", "Akhir", "Forecast 3 langkah"],
      body: result.analysis.trends.slice(0, 8).map((t) => [
        t.column,
        t.direction,
        `${t.pctChange >= 0 ? "+" : ""}${t.pctChange.toFixed(1)}%`,
        t.r2.toFixed(2),
        fmtNum(t.startValue),
        fmtNum(t.endValue),
        t.forecast.length ? t.forecast.map((v) => fmtNum(v, 1)).join(", ") : "-",
      ]),
      align: ["left", "left", "right", "right", "right", "right", "left"],
    });
  }

  if (result.analysis.anomalies.length > 0) {
    p.subhead("Outlier Statistik");
    p.table({
      head: ["Variabel", "Jumlah Outlier", "Z-max", "Nilai Ekstrem", "Lokasi"],
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
        body: `Terdeteksi ${a.count} nilai dengan z-score >= 2.5. Periksa apakah berasal dari kesalahan input, kasus istimewa yang sah, atau sinyal pasar yang patut diinvestigasi.`,
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
  buildTrends(p, result);
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
