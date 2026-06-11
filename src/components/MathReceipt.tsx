import { useState } from "react";
import { useT } from "../i18n/index.ts";

export interface ReceiptLine {
  label: string;
  text: string;
}

/**
 * The math receipt — the product's signature element (docs/04 §5).
 * Receipt paper, mono, dashed torn edge on top, the ONLY shadow in the
 * product, expandable, copyable as plain text.
 */
export function MathReceipt({ lines }: { lines: ReceiptLine[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyText = [
    ...lines.map((l) => `${l.label}\t${l.text}`),
    t("receipt.footer"),
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[receipt] clipboard write failed:", err);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-sm text-blue hover:underline"
      >
        {open ? t("receipt.collapse") : t("receipt.expand")}
      </button>
      {open && (
        <div className="mt-2 max-w-2xl rounded-b-card border hairline border-t-2 border-t-line [border-top-style:dashed] bg-receipt p-4 shadow-receipt">
          <div className="flex items-start justify-between gap-4">
            <dl className="min-w-0 flex-1 space-y-1.5 font-mono text-sm leading-relaxed">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <dt className="w-12 shrink-0 text-ink2">{line.label}</dt>
                  <dd className="min-w-0 break-all">{line.text}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink"
            >
              {copied ? t("receipt.copied") : t("receipt.copy")}
            </button>
          </div>
          <p className="mt-3 border-t hairline pt-2 text-xs text-ink2">{t("receipt.footer")}</p>
        </div>
      )}
    </div>
  );
}
