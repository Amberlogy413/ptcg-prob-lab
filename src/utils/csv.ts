/** CSV export for distribution tables (docs/06 Phase 4). */

export function buildCsv(header: string[], rows: string[][]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Trigger a client-side download. BOM keeps Excel happy with UTF-8. */
export function downloadCsv(filename: string, header: string[], rows: string[][]): void {
  const blob = new Blob(["﻿" + buildCsv(header, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
