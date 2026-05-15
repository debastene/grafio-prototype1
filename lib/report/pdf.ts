/**
 * Grafio PDF Report — magazine-style dark theme.
 *
 * Design principles:
 *   - ASCII-only text (Helvetica built-in font cannot render unicode chars
 *     like ≥, →, ●, etc. — those become artifacts). All special chars are
 *     mapped to ASCII equivalents via safeText().
 *   - ReportBuilder class manages cursor + auto page breaks. Every render
 *     call uses ensureSpace(neededHeight) which adds a new page if needed.
 *   - After all content is built, footer/header page numbers are stamped
 *     using doc.getNumberOfPages() so they're always correct.
 *   - Sections fill organically without big whitespace gaps.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EngineResult } from "@/lib/engine";

/**
 * Logo cache. Mendownload PNG 2MB sekali, lalu resize ke 256x256 + konversi
 * ke JPEG dataURL (~30-50KB). jsPDF dedupe via `alias` parameter sehingga
 * dataURL ini hanya tersimpan SATU KALI di PDF, tidak per-halaman.
 *
 * Sebelumnya: 626 halaman × 2MB PNG = 60MB+ PDF. Sekarang: ~50KB total.
 */
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

    // Resize ke 256x256 dengan canvas — cukup tajam untuk cover 130pt
    // dan header 14pt, sekaligus drop file size dari 2MB ke ~50KB.
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Background hitam (logo asli BG hitam, biar matching saat di-render di PDF dark theme)
    ctx.fillStyle = "#05081A";
    ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, 0, 0, 256, 256);
    // JPEG quality 0.85 — kompak tapi tetap tajam
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    _logoCache = { dataUrl, alias: "grafio-logo" };
    return _logoCache;
  } catch {
    return null;
  }
}

// ===== Theme =====
const TH = {
  bgDeep: [5, 8, 26] as [number, number, number],
  bgSurface: [15, 26, 63] as [number, number, number],
  bgElevated: [20, 35, 80] as [number, number, number],
  cyan: [0, 212, 255] as [number, number, number],
  cyanSoft: [125, 227, 255] as [number, number, number],
  mint: [0, 255, 179] as [number, number, number],
  purple: [123, 94, 167] as [number, number, number],
  warning: [255, 181, 71] as [number, number, number],
  danger: [255, 77, 109] as [number, number, number],
  white: [240, 244, 255] as [number, number, number],
  silver: [226, 232, 240] as [number, number, number],
  muted: [122, 136, 172] as [number, number, number],
  border: [40, 55, 100] as [number, number, number],
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_TOP = 70;
const CONTENT_BOTTOM = PAGE_H - 60; // leaves room for footer

/**
 * Replace all unicode chars that Helvetica can't render with ASCII equivalents.
 * This is critical — the previous PDF showed garbled "z-score "e 2.5" because
 * "≥" rendered as junk.
 */
function safeText(s: string): string {
  if (!s) return "";
  return s
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/×/g, "x")
    .replace(/÷/g, "/")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/↔/g, "<->")
    .replace(/⇒/g, "=>")
    .replace(/●/g, "*")
    .replace(/•/g, "*")
    .replace(/▲/g, "^")
    .replace(/▼/g, "v")
    .replace(/★/g, "*")
    .replace(/☆/g, "o")
    .replace(/…/g, "...")
    .replace(/—/g, "--")
    .replace(/–/g, "-")
    .replace(/“|”/g, '"')
    .replace(/‘|’/g, "'")
    .replace(/Σ/g, "Sum")
    .replace(/Δ/g, "delta")
    .replace(/π/g, "pi")
    .replace(/√/g, "sqrt")
    .replace(/[ -⁯]/g, " ") // general punctuation block (em-space etc.)
    .replace(/[^\x20-\x7E\n\r\t]/g, ""); // strip remaining non-ASCII
}

function trunc(s: string, n: number): string {
  const safe = safeText(s);
  if (safe.length <= n) return safe;
  return safe.slice(0, n - 3) + "...";
}

// ============================================================
// REPORT BUILDER — manages cursor, page breaks, page numbers
// ============================================================

class ReportBuilder {
  doc: jsPDF;
  y: number;
  fileName: string;

  constructor(fileName: string) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.y = CONTENT_TOP;
    this.fileName = fileName;
  }

  /**
   * Ensure enough vertical space remains. Adds a new page if not.
   */
  ensureSpace(needed: number): void {
    if (this.y + needed > CONTENT_BOTTOM) {
      this.newPage();
    }
  }

  newPage(): void {
    // Defensive cap: kalau pernah ada bug yang trigger 600 halaman lagi,
    // page count tidak lebih dari 30 (lebih dari cukup untuk report data
    // sebanyak apapun yang manusiawi).
    if (this.doc.getNumberOfPages() >= 30) return;
    this.doc.addPage();
    this.fillPageBg();
    this.y = CONTENT_TOP;
  }

  fillPageBg(): void {
    this.doc.setFillColor(...TH.bgDeep);
    this.doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  }

  hr(color: [number, number, number] = TH.border, width = 0.5): void {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
  }

  /**
   * Section title with numbered cyan tag.
   */
  section(num: string, title: string, subtitle?: string): void {
    this.ensureSpace(60);
    const startY = this.y;
    // Numbered tag
    this.doc.setFillColor(...TH.cyan);
    this.doc.roundedRect(MARGIN, startY, 28, 20, 3, 3, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...TH.bgDeep);
    this.doc.text(num, MARGIN + 14 - this.doc.getTextWidth(num) / 2, startY + 14);

    // Title
    this.doc.setFontSize(20);
    this.doc.setTextColor(...TH.white);
    this.doc.text(safeText(title), MARGIN + 38, startY + 15);

    if (subtitle) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...TH.muted);
      this.doc.text(safeText(subtitle), MARGIN + 38, startY + 30);
      this.y = startY + 46;
    } else {
      this.y = startY + 36;
    }
  }

  /**
   * Sub-section header (smaller).
   */
  subhead(text: string, color: [number, number, number] = TH.cyan): void {
    this.ensureSpace(20);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(10);
    this.doc.setTextColor(...color);
    this.doc.text(safeText(text), MARGIN, this.y);
    this.y += 14;
  }

  /**
   * Render a card with optional left stripe color, title, body.
   * Returns the height consumed.
   */
  card({
    title,
    titleColor = TH.white,
    body,
    stripe,
    fill = TH.bgSurface,
    border = TH.border,
    badge,
    badgeColor,
  }: {
    title?: string;
    titleColor?: [number, number, number];
    body?: string | string[];
    stripe?: [number, number, number];
    fill?: [number, number, number];
    border?: [number, number, number];
    badge?: string;
    badgeColor?: [number, number, number];
  }): void {
    const innerW = PAGE_W - MARGIN * 2 - 28; // 14 padding each side
    const lines: string[] = [];
    if (body) {
      const bodyText = Array.isArray(body) ? body.join("\n") : body;
      // Hard cap body length supaya tidak ada monster card. 1500 char
      // muat sebagai paragraf panjang tapi tidak meledak halaman.
      const safe = safeText(bodyText).slice(0, 1500);
      const wrapped = this.doc.splitTextToSize(safe, innerW) as string[];
      lines.push(...wrapped);
    }

    // Hard cap baris di kartu: max 32 baris (~ ~600pt body). Kalau lebih,
    // truncate dengan ellipsis. Mencegah card spam-page-break.
    const MAX_LINES = 32;
    if (lines.length > MAX_LINES) {
      lines.length = MAX_LINES;
      lines[MAX_LINES - 1] = lines[MAX_LINES - 1].replace(/\s+\S*$/, "") + "...";
    }

    const titleH = title ? 18 : 0;
    const bodyH = lines.length * 12;
    const padding = 24;
    const cardH = Math.max(50, titleH + bodyH + padding);

    this.ensureSpace(cardH + 10);

    // Fill
    this.doc.setFillColor(...fill);
    this.doc.setDrawColor(...border);
    this.doc.setLineWidth(0.5);
    this.doc.roundedRect(MARGIN, this.y, PAGE_W - MARGIN * 2, cardH, 4, 4, "FD");

    // Stripe
    if (stripe) {
      this.doc.setFillColor(...stripe);
      this.doc.rect(MARGIN, this.y, 4, cardH, "F");
    }

    let textY = this.y + 16;

    // Badge (top-right)
    if (badge && badgeColor) {
      this.doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
      this.doc.setGState(this.doc.GState({ opacity: 0.18 }));
      const badgeW = this.doc.getTextWidth(safeText(badge.toUpperCase())) + 12;
      this.doc.roundedRect(PAGE_W - MARGIN - 14 - badgeW, this.y + 10, badgeW, 14, 2, 2, "F");
      this.doc.setGState(this.doc.GState({ opacity: 1 }));
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...badgeColor);
      this.doc.text(
        safeText(badge.toUpperCase()),
        PAGE_W - MARGIN - 14 - badgeW + 6,
        this.y + 19,
      );
    }

    // Title
    if (title) {
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.setTextColor(...titleColor);
      this.doc.text(trunc(title, 78), MARGIN + 14, textY);
      textY += 16;
    }

    // Body
    if (lines.length > 0) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...TH.silver);
      this.doc.text(lines, MARGIN + 14, textY);
    }

    this.y += cardH + 10;
  }

  /**
   * KPI grid (auto 2-col, 4-card max).
   */
  kpiGrid(kpis: { label: string; value: string; change: number }[]): void {
    if (kpis.length === 0) return;
    const w = (PAGE_W - MARGIN * 2 - 12) / 2;
    const h = 70;
    const rows = Math.ceil(kpis.length / 2);
    this.ensureSpace(rows * (h + 12));

    const startY = this.y;
    kpis.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * (w + 12);
      const yy = startY + row * (h + 12);
      this.doc.setFillColor(...TH.bgSurface);
      this.doc.setDrawColor(...TH.border);
      this.doc.roundedRect(x, yy, w, h, 4, 4, "FD");

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...TH.muted);
      this.doc.text(safeText(k.label.toUpperCase()), x + 14, yy + 16);

      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(20);
      this.doc.setTextColor(...TH.white);
      this.doc.text(trunc(k.value, 18), x + 14, yy + 42);

      const positive = k.change >= 0;
      const txt = `${positive ? "^" : "v"} ${Math.abs(k.change).toFixed(1)}%`;
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...(positive ? TH.mint : TH.danger));
      this.doc.text(safeText(txt), x + 14, yy + 60);
    });
    this.y = startY + rows * (h + 12);
  }

  /**
   * Stats line — comma-separated key=value pairs.
   */
  statsLine(stats: { label: string; value: string }[], color: [number, number, number] = TH.silver): void {
    this.ensureSpace(20);
    let cursorX = MARGIN;
    const cursorY = this.y + 4;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(8.5);
    for (const s of stats) {
      this.doc.setTextColor(...TH.cyan);
      this.doc.text("*", cursorX, cursorY);
      cursorX += 8;
      this.doc.setTextColor(...TH.muted);
      const labelText = `${safeText(s.label)}: `;
      this.doc.text(labelText, cursorX, cursorY);
      cursorX += this.doc.getTextWidth(labelText);
      this.doc.setTextColor(...color);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(safeText(s.value), cursorX, cursorY);
      cursorX += this.doc.getTextWidth(safeText(s.value)) + 14;
      this.doc.setFont("helvetica", "normal");
      // Wrap to next line if needed
      if (cursorX > PAGE_W - MARGIN - 50) {
        cursorX = MARGIN;
        this.y += 14;
        return;
      }
    }
    this.y += 18;
  }

  /**
   * Insight card with type-coded color stripe.
   */
  insightCard(insight: { type: string; title: string; body: string }): void {
    const colorMap: Record<string, [number, number, number]> = {
      trend: TH.cyan,
      anomaly: TH.warning,
      target: TH.mint,
      idea: TH.purple,
    };
    const color = colorMap[insight.type] ?? TH.cyan;
    this.card({
      title: insight.title,
      body: insight.body,
      stripe: color,
      badge: insight.type,
      badgeColor: color,
    });
  }

  /**
   * Auto-table wrapper using jspdf-autotable.
   */
  table({
    head,
    body,
    headColor = TH.cyan,
  }: {
    head: string[];
    body: (string | number)[][];
    headColor?: [number, number, number];
  }): void {
    if (body.length === 0) return;
    this.ensureSpace(60); // need space for header at minimum

    autoTable(this.doc, {
      startY: this.y,
      head: [head.map((h) => safeText(h))],
      body: body.map((row) => row.map((c) => safeText(String(c)))),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8,
        textColor: TH.silver,
        fillColor: TH.bgSurface,
        lineColor: TH.border,
        lineWidth: 0.3,
        cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: headColor,
        textColor: TH.bgDeep,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: TH.bgElevated },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => {
        // Auto-fill bg on page breaks created by autoTable
        this.fillPageBg();
      },
    });

    this.y = (this.doc as any).lastAutoTable.finalY + 10;
  }

  /**
   * Horizontal correlation bars.
   */
  corrBars(
    correlations: { a: string; b: string; r: number; strength: string; direction: string }[],
  ): void {
    const usableW = PAGE_W - MARGIN * 2;
    const barH = 44;
    for (const c of correlations) {
      this.ensureSpace(barH + 8);
      this.doc.setFillColor(...TH.bgSurface);
      this.doc.setDrawColor(...TH.border);
      this.doc.roundedRect(MARGIN, this.y, usableW, barH, 4, 4, "FD");

      // Label
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...TH.white);
      this.doc.text(
        safeText(`${trunc(c.a, 26)}  <->  ${trunc(c.b, 26)}`),
        MARGIN + 12,
        this.y + 16,
      );

      // r value
      const positive = c.r > 0;
      const rText = `r = ${c.r.toFixed(3)}`;
      this.doc.setFontSize(10);
      this.doc.setTextColor(...(positive ? TH.mint : TH.danger));
      const rW = this.doc.getTextWidth(rText);
      this.doc.text(rText, PAGE_W - MARGIN - rW - 12, this.y + 16);

      // Bar
      const barFullW = usableW - 24;
      const barX = MARGIN + 12;
      const barY = this.y + 26;
      this.doc.setFillColor(...TH.bgElevated);
      this.doc.roundedRect(barX, barY, barFullW, 6, 2, 2, "F");
      this.doc.setFillColor(...(positive ? TH.mint : TH.danger));
      this.doc.roundedRect(barX, barY, barFullW * Math.abs(c.r), 6, 2, 2, "F");

      // Strength
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...TH.muted);
      this.doc.text(
        safeText(`${c.strength}, ${c.direction}`),
        barX + barFullW * Math.abs(c.r) + 6,
        barY + 5,
      );

      this.y += barH + 6;
    }
  }

  /**
   * Numbered recommendation card.
   */
  recommendCard(num: number, title: string, body: string): void {
    const innerW = PAGE_W - MARGIN * 2 - 60;
    const wrapped = this.doc.splitTextToSize(safeText(body), innerW) as string[];
    const cardH = Math.max(56, 30 + wrapped.length * 12);
    this.ensureSpace(cardH + 10);

    this.doc.setFillColor(...TH.bgSurface);
    this.doc.setDrawColor(...TH.border);
    this.doc.roundedRect(MARGIN, this.y, PAGE_W - MARGIN * 2, cardH, 4, 4, "FD");

    // Number circle
    this.doc.setFillColor(...TH.cyan);
    this.doc.circle(MARGIN + 22, this.y + 22, 13, "F");
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TH.bgDeep);
    const numStr = String(num);
    this.doc.text(numStr, MARGIN + 22 - this.doc.getTextWidth(numStr) / 2, this.y + 26);

    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.setTextColor(...TH.white);
    this.doc.text(trunc(title, 76), MARGIN + 46, this.y + 22);

    // Body
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...TH.silver);
    this.doc.text(wrapped, MARGIN + 46, this.y + 38);

    this.y += cardH + 8;
  }

  spacer(h: number): void {
    this.y += h;
  }

  /**
   * After all pages built, stamp header + footer + page numbers on every page.
   */
  finalize(logo: LogoAsset | null = null): void {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      // Skip header/footer on cover (page 1)
      if (i === 1) continue;

      // HEADER
      this.doc.setDrawColor(...TH.border);
      this.doc.setLineWidth(0.5);
      this.doc.line(MARGIN, 50, PAGE_W - MARGIN, 50);

      // Brand mark — pakai logo cached (sama alias = embedded sekali, dedup
      // di seluruh halaman). Fallback ke dots kalau logo tidak tersedia.
      if (logo) {
        this.doc.addImage(logo.dataUrl, "JPEG", MARGIN, 22, 14, 14, logo.alias, "FAST");
      } else {
        this.doc.setFillColor(...TH.cyan);
        this.doc.circle(MARGIN + 6, 30, 5, "F");
        this.doc.setFillColor(...TH.bgDeep);
        this.doc.circle(MARGIN + 6, 30, 2, "F");
        this.doc.setFillColor(...TH.silver);
        this.doc.circle(MARGIN + 6, 30, 0.8, "F");
      }

      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(...TH.white);
      this.doc.text("GRAFIO", MARGIN + 20, 33);
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...TH.muted);
      this.doc.text("- Analytics Report", MARGIN + 51, 33);

      this.doc.setFontSize(7);
      this.doc.setTextColor(...TH.muted);
      const right = `${i} / ${total}   -   ${trunc(this.fileName, 38)}`;
      this.doc.text(right, PAGE_W - MARGIN - this.doc.getTextWidth(right), 33);

      // FOOTER
      this.doc.setDrawColor(...TH.border);
      this.doc.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40);
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(7);
      this.doc.setTextColor(...TH.muted);
      const ftext = "See Beyond The Numbers - Generated by Grafio Engine v1.2 - grafio.app";
      this.doc.text(ftext, PAGE_W / 2 - this.doc.getTextWidth(ftext) / 2, PAGE_H - 25);
    }
  }
}

// ============================================================
// COVER (page 1, no header/footer)
// ============================================================

function buildCover(b: ReportBuilder, result: EngineResult, logo: LogoAsset | null) {
  const doc = b.doc;
  const cx = PAGE_W / 2;

  // === BACKGROUND ===
  doc.setFillColor(...TH.bgDeep);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // Subtle vertical gradient (top→bottom: bgSurface tint → bgDeep)
  for (let i = 0; i < 20; i++) {
    const alpha = 1 - i / 20;
    doc.setFillColor(
      Math.round(TH.bgSurface[0] * alpha * 0.4 + TH.bgDeep[0] * (1 - alpha * 0.4)),
      Math.round(TH.bgSurface[1] * alpha * 0.4 + TH.bgDeep[1] * (1 - alpha * 0.4)),
      Math.round(TH.bgSurface[2] * alpha * 0.4 + TH.bgDeep[2] * (1 - alpha * 0.4)),
    );
    doc.rect(0, i * 24, PAGE_W, 24, "F");
  }

  // Top-right cyan glow blob (decorative)
  for (let r = 70; r > 0; r -= 5) {
    const a = 1 - r / 70;
    doc.setFillColor(
      Math.round(TH.bgDeep[0] + (TH.cyan[0] - TH.bgDeep[0]) * a * 0.15),
      Math.round(TH.bgDeep[1] + (TH.cyan[1] - TH.bgDeep[1]) * a * 0.15),
      Math.round(TH.bgDeep[2] + (TH.cyan[2] - TH.bgDeep[2]) * a * 0.15),
    );
    doc.circle(PAGE_W - 50, 80, r, "F");
  }

  // === TOP HEADER STRIP (y=30) ===
  // Mini logo + GRAFIO wordmark (left), report date (right)
  if (logo) {
    doc.addImage(logo.dataUrl, "JPEG", MARGIN, 22, 18, 18, logo.alias, "FAST");
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TH.white);
  doc.text("GRAFIO", MARGIN + 24, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TH.muted);
  doc.text("Analytics Report", MARGIN + 60, 35);

  const dateShort = new Date().toLocaleDateString("id-ID", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.setFontSize(8);
  doc.setTextColor(...TH.muted);
  const dateW = doc.getTextWidth(dateShort);
  doc.text(dateShort, PAGE_W - MARGIN - dateW, 35);

  // Hairline under header
  doc.setDrawColor(...TH.border);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 50, PAGE_W - MARGIN, 50);

  // === HERO LOGO ===
  const heroY = 150;
  const HERO_LOGO = 90;
  if (logo) {
    doc.addImage(
      logo.dataUrl, "JPEG",
      cx - HERO_LOGO / 2, heroY - HERO_LOGO / 2,
      HERO_LOGO, HERO_LOGO,
      logo.alias, "FAST",
    );
  } else {
    // Geometric fallback (small)
    const R = 38, innerR = 12;
    doc.setFillColor(...TH.silver);
    doc.circle(cx, heroY, innerR, "F");
    for (let i = 0; i < 12; i++) {
      const tip = (i * 30 - 90) * (Math.PI / 180);
      const left = ((i - 0.5) * 30 - 90) * (Math.PI / 180);
      const right = ((i + 0.5) * 30 - 90) * (Math.PI / 180);
      doc.triangle(
        cx + R * Math.cos(tip), heroY + R * Math.sin(tip),
        cx + innerR * Math.cos(left), heroY + innerR * Math.sin(left),
        cx + innerR * Math.cos(right), heroY + innerR * Math.sin(right),
        "F",
      );
    }
  }

  // === TITLE BLOCK ===
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  doc.setTextColor(...TH.white);
  const title = "Analytics Report";
  doc.text(title, cx - doc.getTextWidth(title) / 2, 260);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(...TH.cyanSoft);
  const tag = "See Beyond The Numbers";
  doc.text(tag, cx - doc.getTextWidth(tag) / 2, 280);

  // Domain pill
  doc.setFillColor(...TH.cyan);
  const domTag = `${result.domain.emoji} ${result.domain.name}`;
  doc.setFontSize(9);
  const safeDom = safeText(domTag);
  const domW = doc.getTextWidth(safeDom) + 22;
  doc.roundedRect(cx - domW / 2, 295, domW, 20, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TH.bgDeep);
  doc.text(safeDom, cx - doc.getTextWidth(safeDom) / 2, 309);

  // Filename — big & prominent
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...TH.white);
  const fn = safeText(trunc(result.fileName, 60));
  doc.text(fn, cx - doc.getTextWidth(fn) / 2, 345);

  // Filename subtitle (row count + col count)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TH.muted);
  const sub = `${result.rowCount.toLocaleString("id")} baris  ·  ${result.columnCount} kolom  ·  ${result.numberFormat.toUpperCase()} format`;
  doc.text(sub, cx - doc.getTextWidth(sub) / 2, 362);

  // === EXECUTIVE SUMMARY (AI-written) ===
  // Section divider
  doc.setDrawColor(...TH.cyan);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 390, MARGIN + 30, 390);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TH.cyan);
  doc.text("RINGKASAN EKSEKUTIF", MARGIN, 405);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TH.silver);
  const summaryText = safeText(result.summary ?? "").slice(0, 700);
  const summaryLines = doc.splitTextToSize(
    summaryText || "Ringkasan otomatis sedang diproses. Konten penuh ada di halaman berikutnya.",
    PAGE_W - MARGIN * 2,
  ) as string[];
  // Max 7 lines on cover supaya tidak nabrak stats di bawah
  const cappedLines = summaryLines.slice(0, 7);
  cappedLines.forEach((ln, i) => {
    doc.text(ln, MARGIN, 425 + i * 14);
  });

  // === STATS ROW (cards di bawah summary) ===
  const statsY = PAGE_H - 200;

  // Section label
  doc.setDrawColor(...TH.cyan);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, statsY - 25, MARGIN + 30, statsY - 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TH.cyan);
  doc.text("KEY METRICS", MARGIN, statsY - 10);

  const stats = [
    { label: "BARIS DATA", value: result.rowCount.toLocaleString("id") },
    { label: "KOLOM", value: String(result.columnCount) },
    { label: "TRENDS", value: String(result.analysis.trends.length) },
    { label: "INSIGHTS", value: String(Math.min(result.insights.length, 6)) },
  ];
  const sw = (PAGE_W - MARGIN * 2 - 30) / 4;
  stats.forEach((s, i) => {
    const x = MARGIN + i * (sw + 10);
    doc.setFillColor(...TH.bgSurface);
    doc.setDrawColor(...TH.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, statsY, sw, 70, 5, 5, "FD");
    // Accent strip top
    doc.setFillColor(...TH.cyan);
    doc.rect(x, statsY, sw, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...TH.cyan);
    doc.text(s.value, x + 14, statsY + 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TH.muted);
    doc.text(s.label, x + 14, statsY + 56);
  });

  // === FOOTER ===
  doc.setDrawColor(...TH.border);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, PAGE_H - 60, PAGE_W - MARGIN, PAGE_H - 60);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TH.muted);
  doc.text("See Beyond The Numbers", MARGIN, PAGE_H - 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TH.muted);
  const modelInfo = result._meta?.model
    ? `Dianalisis oleh ${result._meta.model.split("/")[1]?.split(":")[0] ?? result._meta.model}`
    : "Grafio Engine";
  const procInfo = `${modelInfo}  ·  ${result.durationMs.toFixed(0)} ms  ·  grafio.app`;
  const piW = doc.getTextWidth(procInfo);
  doc.text(procInfo, PAGE_W - MARGIN - piW, PAGE_H - 42);

  // Bottom accent bar
  doc.setFillColor(...TH.cyan);
  doc.rect(0, PAGE_H - 6, PAGE_W, 6, "F");
}

// ============================================================
// CONTENT SECTIONS
// ============================================================

function buildSummary(b: ReportBuilder, result: EngineResult, aiReport: AiReportContent | null = null) {
  b.section("01", "Executive Summary", `Konteks ${result.domain.name.toLowerCase()} - ditulis oleh Grafio AI di atas data engine`);

  // Short summary card. Cap di 800 char — kalau AI overrun, terpotong rapi.
  b.card({
    body: (result.summary ?? "").slice(0, 800),
    stripe: TH.cyan,
  });

  // AI long-form narrative (dari mode=report). MAX 4 paragraf, MAX 800 char/
  // paragraf — mencegah AI yang nyasar return 10000 kata bikin PDF 600 halaman.
  if (aiReport?.narrative) {
    b.spacer(6);
    b.subhead("NARASI LENGKAP AI", TH.cyan);
    const paragraphs = aiReport.narrative
      .split(/\n{2,}|\r\n\r\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (paragraphs.length === 0) paragraphs.push(aiReport.narrative.slice(0, 800));
    paragraphs.forEach((p, idx) => {
      b.card({
        body: p.slice(0, 800),
        stripe: idx === 0 ? TH.purple : TH.bgElevated,
        fill: TH.bgSurface,
      });
    });
  }

  // Prompt context (if any)
  if (result.promptApplied && result.promptApplied.trim()) {
    b.card({
      title: "Arahan pengguna",
      titleColor: TH.muted,
      body: `"${result.promptApplied}"`,
      stripe: TH.purple,
      fill: TH.bgElevated,
    });
  }

  // Cleaning summary
  if (result.cleaning.removedRows > 0 || result.cleaning.removedColumns.length > 0 || result.cleaning.imputedCells > 0 || result.cleaning.cappedCells > 0) {
    const cleanLines: string[] = [];
    if (result.cleaning.removedRows > 0)
      cleanLines.push(`Dibuang ${result.cleaning.removedRows} baris (duplikat / kosong).`);
    if (result.cleaning.removedColumns.length > 0)
      cleanLines.push(`Dibuang kolom: ${result.cleaning.removedColumns.join(", ")}.`);
    if (result.cleaning.imputedCells > 0)
      cleanLines.push(`Diimputasi ${result.cleaning.imputedCells} cell kosong (median/mode).`);
    if (result.cleaning.cappedCells > 0)
      cleanLines.push(`Di-cap ${result.cleaning.cappedCells} outlier ke 1.5x IQR fence.`);
    cleanLines.push(
      `Health score: ${result.cleaning.healthScoreBefore} -> ${result.cleaning.healthScoreAfter} / 100.`,
    );
    b.card({
      title: "Pembersihan data yang dilakukan",
      body: cleanLines.join(" "),
      stripe: TH.mint,
    });
  }

  b.spacer(8);
  b.subhead("KEY METRICS");
  b.kpiGrid(result.kpis.slice(0, 4));

  b.spacer(8);
  b.subhead("DATA SHAPE");
  b.statsLine([
    { label: "numeric", value: String(result.numericColCount) },
    { label: "categorical", value: String(result.categoricalColCount) },
    { label: "date", value: String(result.dateColCount) },
  ]);
  b.statsLine([
    { label: "trends", value: String(result.analysis.trends.length) },
    { label: "correlations", value: String(result.analysis.correlations.length) },
    { label: "outliers (z>=2.5)", value: String(result.analysis.anomalies.reduce((a, x) => a + x.count, 0)) },
  ]);
  b.statsLine([
    { label: "format", value: result.numberFormat.toUpperCase() },
    { label: "row count", value: result.rowCount.toLocaleString("id") },
  ]);
}

function buildInsights(b: ReportBuilder, result: EngineResult) {
  b.newPage();
  // Hard cap: 6 insight cards max — cukup untuk 1 halaman, tidak risiko
  // overflow ke 50+ halaman kalau AI returns crazy long array.
  const insights = result.insights.slice(0, 6);
  b.section("02", "Key Insights", `${insights.length} temuan utama dari analisis statistik`);

  for (const ins of insights) {
    b.insightCard({
      type: ins.type,
      title: (ins.title ?? "").slice(0, 90),
      body: (ins.body ?? "").slice(0, 320),
    });
  }
}

function buildProfile(b: ReportBuilder, result: EngineResult) {
  b.newPage();
  b.section("03", "Column Profile", `${result.columnCount} kolom terdeteksi - tipe, missing, distribusi`);

  const rows = result.profile.slice(0, 30).map((p) => [
    (p.isLikelyTarget ? "* " : "") + p.name,
    p.type,
    String(p.unique),
    `${(p.missingPct * 100).toFixed(0)}%`,
    p.summary
      ? p.summary.mean.toLocaleString("id", { maximumFractionDigits: 2 })
      : p.topValues?.[0]?.value ?? "-",
    p.summary
      ? `${p.summary.min.toLocaleString("id", { maximumFractionDigits: 1 })} - ${p.summary.max.toLocaleString("id", { maximumFractionDigits: 1 })}`
      : `${p.topValues?.length ?? 0} cat`,
    String(p.outlierCount ?? 0),
  ]);

  b.table({
    head: ["Kolom", "Tipe", "Unique", "Missing", "Mean / Top", "Range / N-cat", "Outlier"],
    body: rows,
  });

  if (result.profile.length > 30) {
    b.doc.setFont("helvetica", "italic");
    b.doc.setFontSize(8);
    b.doc.setTextColor(...TH.muted);
    b.doc.text(`Menampilkan 30 dari ${result.profile.length} kolom.`, MARGIN, b.y + 4);
    b.y += 16;
  }
}

function buildCorrelations(b: ReportBuilder, result: EngineResult) {
  if (result.analysis.correlations.length === 0) return;
  b.newPage();
  b.section(
    "04",
    "Correlation Analysis",
    "Pearson coefficient - pasangan variabel paling berkaitan (|r| >= 0.3)",
  );
  b.corrBars(result.analysis.correlations.slice(0, 10));
}

function buildTrends(b: ReportBuilder, result: EngineResult) {
  b.newPage();
  const num = result.analysis.correlations.length > 0 ? "05" : "04";
  b.section("0" + (num.endsWith("5") ? "5" : "4"), "Trends & Anomalies", "Arah pertumbuhan dan outlier statistik");

  // Trends
  b.subhead("TRENDS", TH.cyan);
  if (result.analysis.trends.length === 0) {
    b.card({ body: "Tidak ada tren signifikan terdeteksi.", fill: TH.bgElevated });
  } else {
    b.table({
      head: ["Metrik", "Arah", "% Change", "R-sq", "Start", "End", "Forecast (3)"],
      body: result.analysis.trends.slice(0, 8).map((t) => [
        t.column,
        t.direction,
        `${t.pctChange >= 0 ? "+" : ""}${t.pctChange.toFixed(1)}%`,
        t.r2.toFixed(2),
        t.startValue.toLocaleString("id", { maximumFractionDigits: 2 }),
        t.endValue.toLocaleString("id", { maximumFractionDigits: 2 }),
        t.forecast.length
          ? t.forecast.map((v) => v.toLocaleString("id", { maximumFractionDigits: 1 })).join(", ")
          : "-",
      ]),
      headColor: TH.cyan,
    });
  }

  // Anomalies — slice 8 supaya tidak balloon kalau dataset wide
  b.spacer(12);
  b.subhead("OUTLIERS (Z-score >= 2.5)", TH.warning);
  if (result.analysis.anomalies.length === 0) {
    b.card({ body: "Tidak ada outlier signifikan.", fill: TH.bgElevated });
  } else {
    b.table({
      head: ["Kolom", "Total Outlier", "Z-max", "Nilai", "Baris"],
      body: result.analysis.anomalies.slice(0, 8).map((a) => [
        a.column,
        String(a.count),
        a.topExample ? a.topExample.zscore.toFixed(2) : "-",
        a.topExample ? a.topExample.value.toLocaleString("id", { maximumFractionDigits: 2 }) : "-",
        a.topExample ? `#${a.topExample.rowIndex + 1}` : "-",
      ]),
      headColor: TH.warning,
    });
  }

  // Segments
  if (result.analysis.segments.length > 0) {
    b.spacer(12);
    b.subhead("SEGMENT COMPARISON", TH.mint);
    const seg = result.analysis.segments[0];
    b.table({
      head: [`${seg.groupCol}`, `Mean ${seg.metricCol}`, "Total Sum", "Count"],
      body: seg.groups.slice(0, 12).map((g) => [
        g.name,
        g.mean.toLocaleString("id", { maximumFractionDigits: 2 }),
        g.sum.toLocaleString("id", { maximumFractionDigits: 0 }),
        String(g.count),
      ]),
      headColor: TH.mint,
    });
  }
}

function buildRecommendations(b: ReportBuilder, result: EngineResult, aiReport: AiReportContent | null = null) {
  b.newPage();
  b.section("06", "Recommendations", "Rekomendasi langkah berikutnya berdasarkan temuan");

  // Prefer AI-generated strategic recommendations kalau tersedia.
  if (aiReport?.recommendations && aiReport.recommendations.length > 0) {
    const sorted = [...aiReport.recommendations].sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.impact ?? "medium"] ?? 1) - (order[b.impact ?? "medium"] ?? 1);
    });
    sorted.slice(0, 6).forEach((r) => {
      const impactColor: [number, number, number] =
        r.impact === "high" ? TH.mint : r.impact === "low" ? TH.muted : TH.cyan;
      b.card({
        title: r.title,
        titleColor: impactColor,
        body: [`Aksi: ${r.action}`, `Alasan: ${r.rationale}`].join("\n"),
        stripe: impactColor,
        badge: r.impact ? r.impact.toUpperCase() : undefined,
        badgeColor: impactColor,
      });
    });
    return;
  }

  const recs: { title: string; body: string }[] = [];

  if (result.analysis.trends.find((t) => t.direction === "naik" && Math.abs(t.pctChange) > 10)) {
    const t = result.analysis.trends.find((tr) => tr.direction === "naik")!;
    recs.push({
      title: `Investasi pada ${t.column}`,
      body: `Pertumbuhan ${t.pctChange.toFixed(1)}% dengan R-sq ${t.r2.toFixed(2)}. Pertimbangkan menambah resource pada area ini untuk memperbesar momentum sebelum kompetitor menyamai.`,
    });
  }
  if (result.analysis.trends.find((t) => t.direction === "turun" && Math.abs(t.pctChange) > 10)) {
    const t = result.analysis.trends.find((tr) => tr.direction === "turun")!;
    recs.push({
      title: `Audit ${t.column}`,
      body: `Penurunan ${Math.abs(t.pctChange).toFixed(1)}%. Identifikasi akar penyebab: faktor eksternal (musiman, kompetitor, regulasi) atau internal (proses, produk, tim).`,
    });
  }
  if (result.analysis.anomalies.length > 0) {
    const a = result.analysis.anomalies[0];
    recs.push({
      title: `Verifikasi outlier di ${a.column}`,
      body: `${a.count} nilai dengan z-score >= 2.5. Cek apakah ini error pencatatan, kasus istimewa yang sah, atau sinyal pasar penting yang patut diteliti lebih dalam.`,
    });
  }
  if (result.analysis.correlations.find((c) => Math.abs(c.r) > 0.7)) {
    const c = result.analysis.correlations.find((cor) => Math.abs(cor.r) > 0.7)!;
    recs.push({
      title: `Eksplorasi causal ${c.a} <-> ${c.b}`,
      body: `Korelasi ${c.strength} (r=${c.r.toFixed(2)}). Pertimbangkan analisis kausalitas (Difference-in-Differences, A/B test) untuk memastikan ini bukan korelasi semu.`,
    });
  }
  if (result.analysis.segments.length > 0 && result.analysis.segments[0].spread > 0.3) {
    const s = result.analysis.segments[0];
    recs.push({
      title: `Replikasi pola dari ${s.topGroup.name}`,
      body: `${s.topGroup.name} unggul ${(s.spread * 100).toFixed(0)}% di metrik ${s.metricCol}. Pelajari faktor sukses dan terapkan ke segmen lemah seperti ${s.bottomGroup.name}.`,
    });
  }
  const hasMissing = result.profile.find((p) => p.missingPct > 0.3);
  if (hasMissing) {
    recs.push({
      title: "Bersihkan data quality",
      body: `Kolom ${hasMissing.name} memiliki >30% nilai kosong. Strategi: imputasi median (numerik) / mode (kategorikal), atau drop kolom jika tidak kritikal untuk hipotesis utama.`,
    });
  }
  if (result.cleaning.healthScoreAfter < 80) {
    recs.push({
      title: "Tingkatkan health score data",
      body: `Health score post-cleaning ${result.cleaning.healthScoreAfter}/100. Audit pipeline ingestion untuk konsistensi tipe, encoding, dan deduplication di hulu.`,
    });
  }
  if (recs.length < 4) {
    recs.push({
      title: "Lakukan deeper dive berikutnya",
      body: `Pertimbangkan: (1) tambah dimensi waktu jika belum ada, (2) lengkapi dengan data eksternal (benchmark industri, makro ekonomi), (3) lakukan A/B test untuk validasi temuan kausal.`,
    });
  }

  recs.forEach((r, i) => b.recommendCard(i + 1, r.title, r.body));

  // Closing
  b.spacer(12);
  b.ensureSpace(50);
  b.doc.setDrawColor(...TH.cyan);
  b.doc.setLineWidth(2);
  b.doc.line(MARGIN, b.y, MARGIN + 40, b.y);
  b.doc.setFont("helvetica", "bold");
  b.doc.setFontSize(13);
  b.doc.setTextColor(...TH.white);
  b.doc.text("End of report.", MARGIN + 50, b.y + 5);
  b.doc.setFont("helvetica", "italic");
  b.doc.setFontSize(8);
  b.doc.setTextColor(...TH.muted);
  b.doc.text(
    "Untuk eksplorasi interaktif, kembali ke dashboard Grafio.",
    MARGIN + 50,
    b.y + 20,
  );
  b.y += 30;
}

// ============================================================
// MAIN
// ============================================================

export type AiReportContent = {
  narrative?: string;
  recommendations?: { title: string; action: string; rationale: string; impact?: "low" | "medium" | "high" }[];
};

export async function generateReport(
  result: EngineResult,
  aiReport: AiReportContent | null = null,
): Promise<Blob> {
  const b = new ReportBuilder(result.fileName);

  // Load + cache + resize logo sekali. addImage akan dedupe via alias.
  const logo = await loadLogo();

  buildCover(b, result, logo);
  // Cover is a full-bleed page; force a fresh page before content sections
  // so Section 01 (Executive Summary) doesn't draw on top of the cover.
  b.newPage();
  buildSummary(b, result, aiReport);
  buildInsights(b, result);
  buildProfile(b, result);
  buildCorrelations(b, result);
  buildTrends(b, result);
  buildRecommendations(b, result, aiReport);

  b.finalize(logo);
  return b.doc.output("blob");
}

/**
 * Fetch AI-generated report content (long narrative + strategic recs).
 * Hard timeout 25s — kalau lewat, return null dan PDF tetap render dengan
 * konten engine apa adanya.
 */
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
          columns: result.profile.slice(0, 12).map((p) => ({
            name: p.name,
            type: p.type,
            mean: p.summary?.mean,
            min: p.summary?.min,
            max: p.summary?.max,
          })),
          trends: result.analysis.trends.slice(0, 4).map((t) => ({
            column: t.column,
            direction: t.direction,
            pctChange: t.pctChange,
            r2: t.r2,
          })),
          correlations: result.analysis.correlations.slice(0, 4).map((c) => ({
            a: c.a,
            b: c.b,
            r: c.r,
            strength: c.strength,
          })),
          anomalies: result.analysis.anomalies.slice(0, 4).map((a) => ({
            column: a.column,
            count: a.count,
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
  // Try to enrich the PDF with AI long-form content. Non-blocking — if AI
  // unavailable, PDF still generates from engine output.
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
