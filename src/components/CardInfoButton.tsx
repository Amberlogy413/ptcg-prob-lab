import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { useCardLang } from "../state/cardLang.ts";
import { CardVisual } from "./CardVisual.tsx";
import { Modal } from "./Modal.tsx";
import { resolveDeckRow, cardName, type Catalog, type CatalogCard } from "../data/catalog.ts";

/**
 * A small ⓘ that opens the full CardVisual for a card (owner request 2026-06-17:
 * 每張牌都要有個小 icon 睇詳細). Self-contained — it owns its own modal — so any
 * compact card surface can drop it in instead of re-wiring detail state. Pass a
 * resolved `card`, or a `name` (+ optional `catalogId`) to resolve via the
 * catalog. Renders NOTHING when the card can't be resolved, so the ⓘ only ever
 * appears where there is real detail to show (honest — no dead button).
 */
export function CardInfoButton({
  catalog,
  name,
  catalogId,
  card,
  size = "sm",
}: {
  catalog: Catalog | null;
  name?: string;
  catalogId?: string;
  card?: CatalogCard | null;
  size?: "sm" | "xs";
}) {
  const t = useT();
  const { lang } = useCardLang();
  const [open, setOpen] = useState(false);

  const resolved =
    card ??
    (catalog !== null && name !== undefined
      ? resolveDeckRow(catalog, { name, ...(catalogId !== undefined ? { catalogId } : {}) })
      : null);
  if (catalog === null || resolved === null) return null;

  const cls =
    size === "xs"
      ? "shrink-0 rounded-ctl border hairline px-1 text-[11px] text-ink2 hover:text-ink"
      : "h-9 w-9 shrink-0 rounded-ctl border hairline bg-surface text-sm text-ink2 hover:text-ink";

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={t("catalog.detailAria", { name: cardName(resolved, lang) })}
        onClick={() => setOpen(true)}
        className={cls}
      >
        ⓘ
      </button>
      {open && (
        <Modal title={cardName(resolved, lang)} onClose={() => setOpen(false)}>
          <CardVisual card={resolved} setInfo={catalog.sets[resolved.set ?? ""] ?? null} />
        </Modal>
      )}
    </>
  );
}
