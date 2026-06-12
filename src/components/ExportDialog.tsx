import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { exportDeckList } from "../utils/deckImport.ts";
import { buildDeckCardSvg } from "../utils/deckSheet.ts";
import { downloadSvgPng } from "../utils/svgPng.ts";
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

  async function downloadCard() {
    const { svg, width, height } = buildDeckCardSvg(deck, {
      sections: {
        pokemon: t("sheet.pokemon"),
        trainer: t("sheet.trainer"),
        energy: t("sheet.energy"),
        unknown: t("sheet.unknown"),
      },
      basicMark: t("trial.basicTag"),
      totalLabel: t("sheet.total"),
      basicsLabel: t("summary.basics"),
      mulliganLabel: t("sheet.mulligan"),
      badge: t("badge.exact"),
      product: t("app.title"),
      footer: t("receipt.footer"),
    });
    try {
      await downloadSvgPng(svg, width, height, `${deck.name || "deck"}.png`);
    } catch (err) {
      console.warn("[export] deck card png failed:", err);
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
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={downloadCard}
          className="mr-auto rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          {t("export.pngCard")}
        </button>
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
