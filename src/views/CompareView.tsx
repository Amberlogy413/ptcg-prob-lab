import { useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import { computeCompare, compareMulligan } from "../state/q5.ts";
import { MulliganToggle } from "../components/MulliganToggle.tsx";
import { deckBasics } from "../state/deckStore.ts";
import { HAND_SIZE } from "../constants.ts";

/** A/B 比較 (roadmap V1-10): same query on two decks, center delta badge.
 *  Supports the "duplicate deck A and change one line" quick fork. */
export function CompareView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const duplicateDeck = useDeckStore((s) => s.duplicateDeck);
  const setActiveDeck = useDeckStore((s) => s.setActiveDeck);

  const [aId, setAId] = useState<string>(activeDeckId ?? "");
  const [bId, setBId] = useState<string>("");
  const [cardName, setCardName] = useState<string>("");
  const [minWant, setMinWant] = useState(1);
  const [aware, setAware] = useState(true);

  const deckA = decks.find((d) => d.id === (aId || activeDeckId)) ?? null;
  const deckB = decks.find((d) => d.id === bId) ?? null;

  const names = useMemo(() => {
    const all = [...(deckA?.cards ?? []), ...(deckB?.cards ?? [])]
      .filter((c) => c.name.trim() !== "" && c.count > 0)
      .map((c) => c.name);
    return [...new Set(all)];
  }, [deckA, deckB]);

  const awareDisabled =
    !deckA || !deckB || deckBasics(deckA) < 1 || deckBasics(deckB) < 1;
  const effAware = aware && !awareDisabled;

  const result = useMemo(() => {
    if (!deckA || !deckB || cardName === "") return null;
    return computeCompare(deckA, deckB, cardName, minWant, effAware);
  }, [deckA, deckB, cardName, minWant, effAware]);

  const mull = useMemo(
    () => (deckA && deckB ? compareMulligan(deckA, deckB) : null),
    [deckA, deckB],
  );

  function fork(): void {
    if (!deckA) return;
    const id = duplicateDeck(deckA.id, `${deckA.name || t("deck.untitled")} B`);
    if (id) {
      setBId(id);
      setActiveDeck(id);
    }
  }

  if (decks.length === 0) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("compare.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  const deckSelect = (
    value: string,
    onChange: (v: string) => void,
    aria: string,
  ) => (
    <select
      value={value}
      aria-label={aria}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 min-w-32 rounded-ctl border hairline bg-surface px-1 text-sm"
    >
      <option value="">{t("compare.pickDeck")}</option>
      {decks.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name || t("deck.untitled")}
        </option>
      ))}
    </select>
  );

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("compare.title")}</h2>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <label className="flex items-center gap-1 text-xs text-ink2">
          A {deckSelect(aId || activeDeckId || "", setAId, t("compare.deckA"))}
        </label>
        <label className="flex items-center gap-1 text-xs text-ink2">
          B {deckSelect(bId, setBId, t("compare.deckB"))}
        </label>
        <button
          type="button"
          onClick={fork}
          className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink"
        >
          {t("compare.fork")}
        </button>
      </div>

      {mull && (
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-ctl border hairline p-3">
          <div className="text-sm">
            <p className="text-xs text-ink2">{t("summary.mulligan")} A</p>
            <p className="font-mono">{mull.a}</p>
          </div>
          <DeltaBadge text={mull.deltaPp} sign={mull.deltaSign} lowerIsBetter />
          <div className="text-right text-sm">
            <p className="text-xs text-ink2">{t("summary.mulligan")} B</p>
            <p className="font-mono">{mull.b}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        <span>{t("compare.queryPrefix")}</span>
        <select
          value={cardName}
          aria-label={t("compare.card.aria")}
          onChange={(e) => setCardName(e.target.value)}
          className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
        >
          <option value="">{t("compare.pickCard")}</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-ink2">
          ≥
          <input
            type="number"
            min={1}
            max={HAND_SIZE}
            value={minWant}
            aria-label={t("curve.want")}
            onChange={(e) => setMinWant(Math.max(1, Math.min(HAND_SIZE, Math.trunc(Number(e.target.value) || 1))))}
            className="h-8 w-12 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
          />
        </label>
        <MulliganToggle on={effAware} disabled={awareDisabled} onChange={setAware} />
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-ctl border hairline p-4">
          <div>
            <p className="text-xs text-ink2">
              {result.a.deckName || "A"} · ×{result.a.count}
            </p>
            <p className="font-mono text-xl">{result.a.percent}</p>
            <p className="font-mono text-xs text-ink2">{result.a.fraction}</p>
          </div>
          <DeltaBadge text={result.deltaPp} sign={result.deltaSign} />
          <div className="text-right">
            <p className="text-xs text-ink2">
              {result.b.deckName || "B"} · ×{result.b.count}
            </p>
            <p className="font-mono text-xl">{result.b.percent}</p>
            <p className="font-mono text-xs text-ink2">{result.b.fraction}</p>
          </div>
        </div>
      )}
      {!result && deckA && deckB && cardName !== "" && (
        <p className="mt-3 text-sm text-warn">{t("compare.notComputable")}</p>
      )}
    </section>
  );
}

/** Center delta badge: green when favorable, red when not (docs/04 §2 — the
 *  ONLY sanctioned semantic-color use: probability quality & deltas). */
function DeltaBadge({
  text,
  sign,
  lowerIsBetter = false,
}: {
  text: string;
  sign: -1 | 0 | 1;
  lowerIsBetter?: boolean;
}) {
  const favorable = lowerIsBetter ? sign < 0 : sign > 0;
  const color = sign === 0 ? "text-ink2 border-line" : favorable ? "text-good border-good" : "text-bad border-bad";
  return (
    <span className={`rounded-ctl border px-2 py-1 font-mono text-sm ${color}`}>{text}</span>
  );
}
