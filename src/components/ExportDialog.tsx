import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { exportDeckList } from "../utils/deckImport.ts";
import type { Deck } from "../state/deckStore.ts";

export function ExportDialog({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => exportDeckList(deck.cards), [deck]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[export] clipboard write failed:", err);
    }
  }

  return (
    <Modal title={t("export.title")} onClose={onClose}>
      <textarea
        readOnly
        value={text}
        rows={14}
        aria-label={t("export.title")}
        className="w-full rounded-ctl border hairline bg-surface p-2 font-mono text-sm"
        onFocus={(e) => e.target.select()}
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
        >
          {t("export.close")}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white"
        >
          {copied ? t("export.copied") : t("export.copy")}
        </button>
      </div>
    </Modal>
  );
}
