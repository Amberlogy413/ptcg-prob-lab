import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckTotal } from "../state/deckStore.ts";
import { useUiStore } from "../state/uiStore.ts";
import { useTrainerStore } from "../state/trainerStore.ts";
import { computeQ1 } from "../state/selectors.ts";
import {
  physicalCopies,
  emptyStats,
  runTrials,
  TRIAL_MIN_CARDS,
  type TrialCard,
  type TrialDeal,
  type TrialStats,
} from "../state/trial.ts";
import { DECK_SIZE, HAND_SIZE } from "../constants.ts";
import { GoldfishBlock } from "./GoldfishBlock.tsx";

/**
 * 試抽桌 (docs/08 §5A, Phase 8): an honest seeded dealer — 7-card hand, real
 * mulligan loop, 6 prizes, first draw — with the exact probabilities always
 * overlaid. The sample teaches intuition; the exact value stays the answer.
 */

function Chip({ card, dim, basicTag }: { card: TrialCard; dim?: boolean; basicTag: string }) {
  const name = card.name.trim() === "" ? "—" : card.name;
  return (
    <li
      className={
        "rounded-ctl border px-2 py-1 font-mono text-xs " +
        (card.isBasic ? "border-blue text-blue" : "hairline " + (dim ? "text-ink2" : "text-ink"))
      }
    >
      {name}
      {card.isBasic && <span className="ml-1 text-[10px]">[{basicTag}]</span>}
    </li>
  );
}

export function TrialView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  const [seed, setSeed] = useState(42);
  const [stats, setStats] = useState<TrialStats>(emptyStats);
  const [lastDeal, setLastDeal] = useState<TrialDeal | null>(null);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setPending = useTrainerStore((s) => s.setPending);

  const copies = useMemo(() => (deck ? physicalCopies(deck.cards) : []), [deck]);
  const hasBasic = copies.some((c) => c.isBasic);
  const q1 = useMemo(() => computeQ1(deck), [deck]);

  // A new deck composition or a new seed starts a fresh, reproducible run.
  const compositionKey = useMemo(
    () => copies.map((c) => `${c.name}|${c.isBasic ? 1 : 0}`).join("\n"),
    [copies],
  );
  useEffect(() => {
    setStats(emptyStats());
    setLastDeal(null);
  }, [compositionKey, seed]);

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("trial.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  const total = deckTotal(deck);
  if (total < TRIAL_MIN_CARDS) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("trial.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("trial.tooFew", { n: TRIAL_MIN_CARDS })}</p>
      </section>
    );
  }

  const deal = (games: number) => {
    const r = runTrials(copies, hasBasic, seed, stats.games, games, stats);
    setStats(r.stats);
    setLastDeal(r.lastDeal);
  };

  const sampleQ = stats.attempts > 0 ? stats.mulligans / stats.attempts : 0;
  const ciPp =
    stats.attempts > 0
      ? (1.96 * Math.sqrt((sampleQ * (1 - sampleQ)) / stats.attempts) * 100).toFixed(2)
      : "0.00";

  return (
    <>
      <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("trial.title")}</h2>
      <p className="mt-2 text-xs text-ink2">{t("trial.desc")}</p>

      {total !== DECK_SIZE && (
        <p className="mt-2 rounded-ctl border border-warn px-3 py-2 text-xs text-warn" role="note">
          {t("trial.notSixty", { n: total })}
        </p>
      )}
      {!hasBasic && (
        <p className="mt-2 rounded-ctl border border-warn px-3 py-2 text-xs text-warn" role="note">
          {t("trial.noBasics")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-ink2">
          <span>{t("trial.seed")}</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)}
            className="w-24 rounded-ctl border hairline bg-surface px-2 py-1 font-mono text-xs text-ink"
          />
        </label>
        <button
          type="button"
          onClick={() => deal(1)}
          className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
        >
          {t("trial.deal1")}
        </button>
        <button
          type="button"
          onClick={() => deal(10)}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          {t("trial.deal10")}
        </button>
        <button
          type="button"
          onClick={() => deal(100)}
          className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
        >
          {t("trial.deal100")}
        </button>
        <button
          type="button"
          disabled={stats.games === 0}
          onClick={() => {
            setStats(emptyStats());
            setLastDeal(null);
          }}
          className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink disabled:opacity-40"
        >
          {t("trial.reset")}
        </button>
      </div>

      {lastDeal === null ? (
        <p className="mt-4 text-sm text-ink2">{t("trial.empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs text-ink2" role="status">
              {lastDeal.mulligans === 0
                ? t("trial.keptFirst")
                : t("trial.mulligans", { n: lastDeal.mulligans })}
            </p>
            {/* P9.3 loop: this hand becomes a trainer question; the revealed
                value is the golden-backed conditional distribution row. */}
            {hasBasic && q1.status === "ok" && (
              <button
                type="button"
                onClick={() => {
                  const k = lastDeal.hand.reduce((s, c) => s + (c.isBasic ? 1 : 0), 0);
                  const row = q1.data.conditional[k];
                  if (!row) return;
                  setPending({
                    kind: "trialHand",
                    q: {
                      promptKey: "trainer.q.trialHand",
                      promptParams: { k },
                      percent: row.percent,
                      fraction: row.fraction,
                      oneIn: row.oneIn,
                      exactPct: row.chart * 100,
                    },
                  });
                  setActiveView("trainer");
                }}
                className="rounded-ctl border hairline px-2.5 py-1 text-xs text-blue hover:underline"
              >
                {t("trial.toTrainer")}
              </button>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("trial.hand")}</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {lastDeal.hand.map((c, i) => (
                <Chip key={i} card={c} basicTag={t("trial.basicTag")} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("trial.firstDraw")}</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip card={lastDeal.firstDraw} basicTag={t("trial.basicTag")} />
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium">{t("trial.prizes")}</h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {lastDeal.prizes.map((c, i) => (
                <Chip key={i} card={c} dim basicTag={t("trial.basicTag")} />
              ))}
            </ul>
          </div>
        </div>
      )}

      {stats.games > 0 && (
        <div className="mt-5 rounded-ctl border hairline bg-paper p-3">
          <h3 className="text-sm font-medium">{t("trial.statsTitle")}</h3>
          <p className="mt-1.5 font-mono text-xs text-ink2">
            {t("trial.statsLine", { games: stats.games, attempts: stats.attempts, seed })}
          </p>
          {hasBasic && (
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-mono">
                {t("trial.sampleMull")}: {(sampleQ * 100).toFixed(2)}%{" "}
                <span className="text-ink2">{t("trial.ci", { pp: ciPp })}</span>
              </p>
              {q1.status === "ok" && (
                <p className="font-mono">
                  {t("trial.exactMull")}: {q1.data.headline.percent} = {q1.data.headline.fraction}{" "}
                  · {q1.data.headline.oneIn}
                </p>
              )}
            </div>
          )}
          {hasBasic && q1.status === "ok" && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <caption className="sr-only">{t("trial.distTitle")}</caption>
                <thead>
                  <tr className="border-b hairline text-left text-ink2">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("trial.distTitle")}
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("trial.distSample")}
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      {t("trial.distExact")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {q1.data.conditional.slice(1, HAND_SIZE + 1).map((row) => {
                    const count = stats.keptBasics[row.k] ?? 0;
                    return (
                      <tr key={row.k} className="border-b hairline last:border-b-0">
                        <td className="py-1 pr-3 font-mono">k = {row.k}</td>
                        <td className="py-1 pr-3 text-right font-mono">
                          {count} ({((count / stats.games) * 100).toFixed(1)}%)
                        </td>
                        <td className="py-1 text-right font-mono">{row.percent}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-ink2">{t("trial.teach")}</p>
        </div>
      )}
      </section>
      <GoldfishBlock deck={deck} copies={copies} />
    </>
  );
}
