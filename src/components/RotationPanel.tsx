import { useEffect, useMemo } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, type Deck } from "../state/deckStore.ts";
import { useUiStore } from "../state/uiStore.ts";
import { openingBasics, percentStr, sub, cmp, R_ZERO } from "../lib/prob/index.ts";
import { HAND_SIZE } from "../constants.ts";

/**
 * P8.4 rotation preview (docs/08 §5A): pick the regulation mark that is
 * rotating out — matching rows grey out in the editor, and the panel shows
 * the EXACT now-vs-after mulligan comparison before a single card moves.
 * The fork button materializes the post-rotation deck so every other view
 * (grading, curves, compare) recomputes on it.
 */
export function RotationPanel({ deck }: { deck: Deck }) {
  const t = useT();
  const rotationMark = useUiStore((s) => s.rotationMark);
  const setRotationMark = useUiStore((s) => s.setRotationMark);
  const forkWithoutMark = useDeckStore((s) => s.forkWithoutMark);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);

  // Preview state is per-deck: switching decks always starts clean.
  useEffect(() => {
    setRotationMark(null);
  }, [deck.id, setRotationMark]);

  const marks = useMemo(
    () =>
      [...new Set(deck.cards.filter((c) => c.count > 0 && c.mark).map((c) => c.mark as string))].sort(),
    [deck],
  );

  const preview = useMemo(() => {
    if (rotationMark === null) return null;
    const leaving = deck.cards.filter((c) => c.mark === rotationMark);
    const lost = leaving.reduce((s, c) => s + c.count, 0);
    const lostBasics = leaving.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
    const stat = (cards: Deck["cards"]) => {
      const total = cards.reduce((s, c) => s + c.count, 0);
      const basics = cards.reduce((s, c) => s + (c.isBasic ? c.count : 0), 0);
      const q = total >= HAND_SIZE && basics >= 1 ? openingBasics(basics, total, HAND_SIZE).mulligan : null;
      return { total, basics, q };
    };
    const now = stat(deck.cards);
    const after = stat(deck.cards.filter((c) => c.mark !== rotationMark));
    return { lost, lostBasics, now, after };
  }, [deck, rotationMark]);

  const delta = useMemo(() => {
    if (!preview || preview.now.q === null || preview.after.q === null) return null;
    const d = sub(preview.after.q, preview.now.q);
    const sign = cmp(d, R_ZERO);
    if (sign === 0) return { text: "±0", worse: false };
    // A difference of probabilities is percentage POINTS, not a percentage —
    // unit consistency with every other delta badge (math audit 2026-06-12).
    return sign > 0
      ? { text: `+${percentStr(d, 6).replace("%", "pp")}`, worse: true }
      : { text: `−${percentStr(sub(preview.now.q, preview.after.q), 6).replace("%", "pp")}`, worse: false };
  }, [preview]);

  function fork(): void {
    if (rotationMark === null) return;
    const id = forkWithoutMark(
      deck.id,
      rotationMark,
      t("rotation.forkName", { name: deck.name || t("deck.untitled") }),
    );
    if (id) {
      setRotationMark(null);
      setActiveDeck(id);
    }
  }

  return (
    <details className="mb-4 rounded-card border hairline bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">{t("rotation.title")}</summary>
      {marks.length === 0 ? (
        <p className="mt-2 text-xs text-ink2">{t("rotation.hint")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs text-ink2">{t("rotation.select")}</span>
            <select
              value={rotationMark ?? ""}
              onChange={(e) => setRotationMark(e.target.value || null)}
              className="h-9 rounded-ctl border hairline bg-surface px-2 font-mono text-sm"
            >
              <option value="">{t("rotation.off")}</option>
              {marks.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          {preview && (
            <div className="rounded-ctl border hairline bg-paper p-3 text-sm">
              <p className="font-mono">
                {t("rotation.lose", { n: preview.lost, b: preview.lostBasics })}
              </p>
              <table className="mt-2 w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b hairline text-left text-ink2">
                    <th scope="col" className="py-1 pr-3 font-medium"></th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("rotation.total")}
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("rotation.basics")}
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      {t("rotation.mulligan")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hairline">
                    <td className="py-1 pr-3 text-ink2">{t("rotation.now")}</td>
                    <td className="py-1 pr-3 text-right">{preview.now.total}</td>
                    <td className="py-1 pr-3 text-right">{preview.now.basics}</td>
                    <td className="py-1 text-right">
                      {preview.now.q !== null ? percentStr(preview.now.q, 6) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-3 text-ink2">{t("rotation.after")}</td>
                    <td className="py-1 pr-3 text-right">{preview.after.total}</td>
                    <td className="py-1 pr-3 text-right">{preview.after.basics}</td>
                    <td className="py-1 text-right">
                      {preview.after.q !== null ? percentStr(preview.after.q, 6) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
              {delta && (
                <p className={"mt-2 font-mono text-xs " + (delta.worse ? "text-bad" : "text-good")}>
                  {t("rotation.delta")} {delta.text}
                </p>
              )}
              {preview.after.q === null && (
                <p className="mt-2 text-xs text-warn" role="status">
                  {t("rotation.na")}
                </p>
              )}
              <button
                type="button"
                onClick={fork}
                className="mt-3 rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
              >
                {t("rotation.fork")}
              </button>
            </div>
          )}
        </div>
      )}
    </details>
  );
}
