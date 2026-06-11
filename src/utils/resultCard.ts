/**
 * Result-card PNG export (docs/03 §7): render an SVG template, rasterize via
 * canvas, download. Carries the query description, all three formats, the
 * product name and the 「精確計算 · 非模擬」 badge.
 */

export interface ResultCardSpec {
  title: string;
  percent: string;
  fraction: string;
  oneIn: string;
  conditionLabel: string;
  badge: string;
  product: string;
  footer: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const W = 800;
const H = 420;

export function buildResultCardSvg(spec: ResultCardSpec): string {
  const mono = "ui-monospace, 'IBM Plex Mono', Menlo, monospace";
  const sans = "'Noto Sans TC', 'IBM Plex Sans', system-ui, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#FAF8F3"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="10" fill="#FFFFFF" stroke="#E3DFD6"/>
  <text x="48" y="76" font-family="${sans}" font-size="20" fill="#15181C">${esc(spec.title)}</text>
  <text x="48" y="100" font-family="${sans}" font-size="14" fill="#5A6069">${esc(spec.conditionLabel)}</text>
  <text x="48" y="208" font-family="${mono}" font-size="72" fill="#15181C">${esc(spec.percent)}</text>
  <text x="48" y="248" font-family="${mono}" font-size="22" fill="#5A6069">${esc(spec.fraction)} · ${esc(spec.oneIn)}</text>
  <line x1="48" y1="284" x2="${W - 48}" y2="284" stroke="#E3DFD6"/>
  <rect x="48" y="304" width="190" height="30" rx="6" fill="none" stroke="#2B59C3"/>
  <text x="143" y="324" font-family="${sans}" font-size="13" fill="#2B59C3" text-anchor="middle">${esc(spec.badge)}</text>
  <text x="48" y="366" font-family="${sans}" font-size="15" fill="#15181C">${esc(spec.product)}</text>
  <text x="${W - 48}" y="366" font-family="${sans}" font-size="11" fill="#5A6069" text-anchor="end">${esc(spec.footer)}</text>
</svg>`;
}

export async function downloadResultCardPng(spec: ResultCardSpec, filename: string): Promise<void> {
  const svg = buildResultCardSvg(spec);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg rasterize failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = W * 2;
    canvas.height = H * 2;
    const cx = canvas.getContext("2d");
    if (!cx) throw new Error("no 2d context");
    cx.scale(2, 2);
    cx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("png encode failed");
    const dl = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = dl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dl);
  } finally {
    URL.revokeObjectURL(url);
  }
}
