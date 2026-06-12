/**
 * P9.1 health-report share card (docs/08 §5C): a text-only summary image of
 * the deck's exact vitals. Same token palette as the result card; dynamic
 * height; no card artwork ever.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ReportCardLine {
  label: string;
  value: string;
}

export interface ReportCardChrome {
  title: string;
  badge: string;
  product: string;
  footer: string;
}

const W = 800;
const MONO = "ui-monospace, 'IBM Plex Mono', Menlo, monospace";
const SANS = "'Noto Sans TC', 'IBM Plex Sans', system-ui, sans-serif";

export function buildReportCardSvg(
  chrome: ReportCardChrome,
  lines: ReportCardLine[],
): { svg: string; width: number; height: number } {
  const headerH = 88;
  const rowH = 34;
  const footerH = 64;
  const height = headerH + lines.length * rowH + footerH;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">`,
    `<rect width="${W}" height="${height}" fill="#FAF8F3"/>`,
    `<rect x="16" y="16" width="${W - 32}" height="${height - 32}" rx="10" fill="#FFFFFF" stroke="#E3DFD6"/>`,
    `<text x="40" y="64" font-family="${SANS}" font-size="22" fill="#15181C">${esc(chrome.title)}</text>`,
  ];

  let y = headerH;
  for (const line of lines) {
    y += rowH;
    parts.push(
      `<line x1="40" y1="${y - rowH + 6}" x2="${W - 40}" y2="${y - rowH + 6}" stroke="#E3DFD6"/>`,
      `<text x="40" y="${y - 6}" font-family="${SANS}" font-size="14" fill="#5A6069">${esc(line.label)}</text>`,
      `<text x="${W - 40}" y="${y - 6}" font-family="${MONO}" font-size="15" fill="#15181C" text-anchor="end">${esc(line.value)}</text>`,
    );
  }

  const fy = height - 36;
  parts.push(
    `<rect x="40" y="${fy - 20}" width="170" height="28" rx="6" fill="none" stroke="#2B59C3"/>`,
    `<text x="125" y="${fy - 1}" font-family="${SANS}" font-size="12" fill="#2B59C3" text-anchor="middle">${esc(chrome.badge)}</text>`,
    `<text x="226" y="${fy - 1}" font-family="${SANS}" font-size="14" fill="#15181C">${esc(chrome.product)}</text>`,
    `<text x="${W - 40}" y="${fy - 1}" font-family="${SANS}" font-size="11" fill="#5A6069" text-anchor="end">${esc(chrome.footer)}</text>`,
    `</svg>`,
  );
  return { svg: parts.join("\n"), width: W, height };
}
