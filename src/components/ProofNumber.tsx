import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { IconProof } from "./icons.tsx";
import type { ReceiptLine } from "./MathReceipt.tsx";
import type { ExplainSection } from "../data/explain.ts";

/** The math behind one number + a plain-language reading of it. */
export interface Proof {
  /** Step-by-step calculation (formula → substituted numbers → reduced → result). */
  receipt: ReceiptLine[];
  /** A meaningful interpretation — what the number actually means for the player. */
  interpret?: string;
}

/** Small circled "?" — the plain-language explainer affordance. */
function HelpGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3.5 w-3.5">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.9.6-.9 1.2v.3" strokeLinecap="round" />
      <circle cx="8" cy="11.6" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A concrete number with a small √ button that opens its FULL mathematical
 * proof + a meaningful interpretation (owner request 2026-06-14: every number
 * gets a responsible, step-by-step math receipt and a real reading, not just a
 * bare figure). The receipt math is exact (BigInt rationals, format.ts bridge).
 */
export function ProofNumber({
  value,
  proof,
  explain,
  className,
  title,
}: {
  value: string;
  proof: Proof;
  /** Exhaustive plain-language explanation; adds a second "?" button. */
  explain?: ExplainSection[];
  className?: string;
  /** Human label for the quantity (modal title + copy header). */
  title: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyText = [
    title,
    ...(proof.interpret !== undefined ? [proof.interpret] : []),
    ...proof.receipt.map((l) => `${l.label}\t${l.text}`),
    t("receipt.footer"),
  ].join("\n");

  const explainCopyText =
    explain !== undefined
      ? [title, ...explain.map((s) => `【${s.h}】\n${s.body}`), t("receipt.footer")].join("\n\n")
      : "";

  async function writeClip(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[proof] clipboard write failed:", err);
    }
  }
  const copy = () => void writeClip(copyText);
  const copyExplain = () => void writeClip(explainCopyText);

  return (
    <span className={"inline-flex items-baseline gap-1 " + (className ?? "")}>
      <span>{value}</span>
      <button
        type="button"
        aria-label={t("proof.show", { name: title })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex h-5 w-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full border hairline text-ink2 hover:text-ink"
      >
        <IconProof size="sm" />
      </button>
      {explain !== undefined && explain.length > 0 && (
        <button
          type="button"
          aria-label={t("explain.show", { name: title })}
          aria-haspopup="dialog"
          onClick={() => setExplainOpen(true)}
          className="inline-flex h-5 w-5 shrink-0 translate-y-0.5 items-center justify-center rounded-full border hairline text-ink2 hover:text-ink"
        >
          <HelpGlyph />
        </button>
      )}
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="max-w-xl">
            {proof.interpret !== undefined && (
              <p className="mb-3 rounded-ctl border hairline bg-surface p-3 text-sm leading-relaxed">
                {proof.interpret}
              </p>
            )}
            <div className="rounded-b-card border hairline border-t-2 border-t-line [border-top-style:dashed] bg-receipt p-4 shadow-receipt">
              <div className="flex items-start justify-between gap-4">
                <dl className="min-w-0 flex-1 space-y-1.5 font-mono text-sm leading-relaxed">
                  {proof.receipt.map((line, i) => (
                    <div key={i} className="flex gap-3">
                      <dt className="w-14 shrink-0 text-ink2">{line.label}</dt>
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
          </div>
        </Modal>
      )}
      {explainOpen && explain !== undefined && (
        <Modal title={t("explain.title", { name: title })} onClose={() => setExplainOpen(false)}>
          <div className="max-w-xl space-y-3">
            {explain.map((s, i) => (
              <section key={i}>
                <h4 className="text-sm font-medium">{s.h}</h4>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink2">{s.body}</p>
              </section>
            ))}
            {/* The concrete substituted steps, right under the plain words. */}
            <div className="rounded-card border hairline border-t-2 border-t-line [border-top-style:dashed] bg-receipt p-4 shadow-receipt">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink2">
                {t("explain.receiptLabel")}
              </p>
              <dl className="space-y-1.5 font-mono text-sm leading-relaxed">
                {proof.receipt.map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <dt className="w-14 shrink-0 text-ink2">{line.label}</dt>
                    <dd className="min-w-0 break-all">{line.text}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 border-t hairline pt-2 text-xs text-ink2">{t("receipt.footer")}</p>
            </div>
            <button
              type="button"
              onClick={copyExplain}
              className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
            >
              {copied ? t("receipt.copied") : t("receipt.copy")}
            </button>
          </div>
        </Modal>
      )}
    </span>
  );
}
