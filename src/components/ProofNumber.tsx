import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { IconProof } from "./icons.tsx";
import type { ReceiptLine } from "./MathReceipt.tsx";

/** The math behind one number + a plain-language reading of it. */
export interface Proof {
  /** Step-by-step calculation (formula → substituted numbers → reduced → result). */
  receipt: ReceiptLine[];
  /** A meaningful interpretation — what the number actually means for the player. */
  interpret?: string;
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
  className,
  title,
}: {
  value: string;
  proof: Proof;
  className?: string;
  /** Human label for the quantity (modal title + copy header). */
  title: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyText = [
    title,
    ...(proof.interpret !== undefined ? [proof.interpret] : []),
    ...proof.receipt.map((l) => `${l.label}\t${l.text}`),
    t("receipt.footer"),
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[proof] clipboard write failed:", err);
    }
  }

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
    </span>
  );
}
