import { useState } from "react";
import { useT } from "../i18n/index.ts";
import { Modal } from "./Modal.tsx";
import { useDeckStore } from "../state/deckStore.ts";

/** D1 卡名別名對照: alias → canonical pairs; basicTags lookups fall through
 *  the map, so bilingual lists and renames share one global memory. */
export function AliasDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const aliases = useDeckStore((s) => s.aliases);
  const setAliasAction = useDeckStore((s) => s.setAlias);
  const removeAlias = useDeckStore((s) => s.removeAlias);
  const [alias, setAlias] = useState("");
  const [canonical, setCanonical] = useState("");

  function add(): void {
    setAliasAction(alias, canonical);
    setAlias("");
    setCanonical("");
  }

  return (
    <Modal title={t("alias.title")} onClose={onClose}>
      <p className="text-sm text-ink2">{t("alias.desc")}</p>

      <ul className="mt-3 max-h-56 overflow-y-auto rounded-ctl border hairline">
        {Object.keys(aliases).length === 0 && (
          <li className="px-3 py-2 text-sm text-ink2">{t("alias.empty")}</li>
        )}
        {Object.entries(aliases).map(([a, c]) => (
          <li key={a} className="flex items-center gap-2 border-b hairline px-3 py-2 last:border-b-0">
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {a} → {c}
            </span>
            <button
              type="button"
              aria-label={t("q2.removeCard.aria", { name: a })}
              onClick={() => removeAlias(a)}
              className="h-7 w-7 rounded-ctl border hairline text-ink2 hover:text-bad"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={alias}
          placeholder={t("alias.alias")}
          aria-label={t("alias.alias")}
          onChange={(e) => setAlias(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-sm"
        />
        <span className="text-ink2">→</span>
        <input
          type="text"
          value={canonical}
          placeholder={t("alias.canonical")}
          aria-label={t("alias.canonical")}
          onChange={(e) => setCanonical(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-ctl border hairline bg-surface px-2 text-sm"
        />
        <button
          type="button"
          disabled={alias.trim() === "" || canonical.trim() === ""}
          onClick={add}
          className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {t("alias.add")}
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2"
        >
          {t("export.close")}
        </button>
      </div>
    </Modal>
  );
}
