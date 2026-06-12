import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import type { Deck } from "../state/deckStore.ts";
import { computeTurnCurve } from "../state/q5.ts";
import { computeRelay } from "../state/q7.ts";
import {
  goldfishGame,
  goldfishSeenBy,
  gameRng,
  type TrialCard,
  type GoldfishDeal,
} from "../state/trial.ts";
import { PRIZE_COUNT } from "../constants.ts";

/**
 * P9.2 goldfish mode (docs/08 §5C): turn-by-turn solo draws with the EXACT
 * "seen X by turn T" curve (docs/02 §6) and a relay-event check (§6.5) side
 * by side. The mulligan loop defaults OFF so the sample is the very
 * Bernoulli the unconditioned curve describes (§6.3 caveat — toggling it on
 * shows the gap the spec still owes a correction for).
 */

interface GoldfishStats {
  games: number;
  seenBy: number[]; // index t-1: games where X was seen by turn t
  relayHits: number;
}

export function GoldfishBlock({ deck, copies }: { deck: Deck; copies: TrialCard[] }) {
  const t = useT();
  const named = useMemo(
    () => deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0),
    [deck],
  );

  const [targetName, setTargetName] = useState("");
  const [maxTurn, setMaxTurn] = useState(5);
  const [goingFirst, setGoingFirst] = useState(false);
  const [skipsFirstDraw, setSkipsFirstDraw] = useState(false);
  const [mullLoop, setMullLoop] = useState(false);
  const [seed, setSeed] = useState(42);
  const [relayName, setRelayName] = useState("");
  const [relayTurn, setRelayTurn] = useState(3);
  const [stats, setStats] = useState<GoldfishStats>({ games: 0, seenBy: [], relayHits: 0 });
  const [lastDeal, setLastDeal] = useState<GoldfishDeal | null>(null);

  const target = named.find((c) => c.name === targetName) ?? null;
  const relayCard = named.find((c) => c.name === relayName) ?? null;
  const total = copies.length;
  const hasBasic = copies.some((c) => c.isBasic);

  const curve = useMemo(
    () =>
      target
        ? computeTurnCurve(
            {
              x: deck.cards
                .filter((c) => c.name === target.name)
                .reduce((s, c) => s + c.count, 0),
              want: 1,
              goingFirst,
              extraSeen: 0,
              firstPlayerSkipsFirstDraw: skipsFirstDraw,
              maxTurn,
            },
            total,
          )
        : null,
    [target, deck, goingFirst, skipsFirstDraw, maxTurn, total],
  );

  const relay = useMemo(() => {
    if (!target || !relayCard) return null;
    const countOf = (name: string) =>
      deck.cards.filter((c) => c.name === name).reduce((s, c) => s + c.count, 0);
    return computeRelay(
      {
        cA: countOf(target.name),
        wA: 1,
        turnA: 1,
        cB: countOf(relayCard.name),
        wB: 1,
        turnB: relayTurn,
        goingFirst,
      },
      total,
    );
  }, [target, relayCard, relayTurn, goingFirst, deck, total]);

  const configKey = `${targetName}|${maxTurn}|${goingFirst}|${skipsFirstDraw}|${mullLoop}|${seed}|${relayName}|${relayTurn}`;
  useEffect(() => {
    setStats({ games: 0, seenBy: [], relayHits: 0 });
    setLastDeal(null);
  }, [configKey]);

  const nSeens = useMemo(() => (curve ? curve.map((r) => r.nSeen) : []), [curve]);
  const playable =
    curve !== null && total >= PRIZE_COUNT + (nSeens[nSeens.length - 1] ?? 0) && (!mullLoop || hasBasic);

  function play(games: number): void {
    if (!target || !playable) return;
    const next: GoldfishStats = {
      games: stats.games,
      seenBy: nSeens.map((_, i) => stats.seenBy[i] ?? 0),
      relayHits: stats.relayHits,
    };
    let last: GoldfishDeal | null = null;
    for (let g = 0; g < games; g++) {
      const deal = goldfishGame(copies, mullLoop, gameRng(seed, next.games), nSeens);
      next.games += 1;
      for (let turn = 1; turn <= nSeens.length; turn++) {
        if (goldfishSeenBy(deal, target.name, turn)) {
          next.seenBy[turn - 1] = (next.seenBy[turn - 1] ?? 0) + 1;
        }
      }
      if (
        relayCard &&
        goldfishSeenBy(deal, target.name, 1) &&
        goldfishSeenBy(deal, relayCard.name, relayTurn)
      ) {
        next.relayHits += 1;
      }
      last = deal;
    }
    setStats(next);
    setLastDeal(last);
  }

  const pct = (count: number) =>
    stats.games > 0 ? `${((count / stats.games) * 100).toFixed(1)}%` : "—";

  return (
    <section className="mt-4 rounded-card border hairline bg-surface p-4 sm:p-6">
      <h3 className="text-lg font-medium">{t("goldfish.title")}</h3>
      <p className="mt-1 text-xs text-ink2">{t("goldfish.desc")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink2">{t("goldfish.target")}</span>
          <select
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            className="h-9 rounded-ctl border hairline bg-surface px-2 text-sm"
          >
            <option value="">—</option>
            {named.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ×{c.count}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink2">{t("goldfish.turns")}</span>
          <select
            value={maxTurn}
            onChange={(e) => setMaxTurn(Number(e.target.value))}
            className="h-9 rounded-ctl border hairline bg-surface px-2 font-mono text-sm"
          >
            {[3, 5, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={goingFirst}
            onChange={(e) => setGoingFirst(e.target.checked)}
            className="h-4 w-4 accent-blue"
          />
          <span>{t("goldfish.goingFirst")}</span>
        </label>
        {goingFirst && (
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={skipsFirstDraw}
              onChange={(e) => setSkipsFirstDraw(e.target.checked)}
              className="h-4 w-4 accent-blue"
            />
            <span className="text-xs text-ink2">{t("goldfish.histRule")}</span>
          </label>
        )}
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={mullLoop}
            onChange={(e) => setMullLoop(e.target.checked)}
            className="h-4 w-4 accent-blue"
          />
          <span>{t("goldfish.mullLoop")}</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink2">{t("trial.seed")}</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) || 0)}
            className="w-20 rounded-ctl border hairline bg-surface px-2 py-1 font-mono text-xs"
          />
        </label>
      </div>

      {mullLoop && (
        <p className="mt-2 rounded-ctl border border-warn px-3 py-2 text-xs text-warn" role="note">
          {t("goldfish.mullNote")}
        </p>
      )}

      {!target ? (
        <p className="mt-3 text-sm text-ink2">{t("goldfish.pickTarget")}</p>
      ) : !playable ? (
        <p className="mt-3 text-sm text-warn" role="status">
          {t("goldfish.cantPlay")}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => play(1)}
              className="rounded-ctl bg-blue px-3 py-1.5 text-sm font-medium text-white"
            >
              {t("goldfish.play1")}
            </button>
            <button
              type="button"
              onClick={() => play(20)}
              className="rounded-ctl border hairline px-3 py-1.5 text-sm text-ink2 hover:text-ink"
            >
              {t("goldfish.play20")}
            </button>
            <button
              type="button"
              disabled={stats.games === 0}
              onClick={() => {
                setStats({ games: 0, seenBy: [], relayHits: 0 });
                setLastDeal(null);
              }}
              className="rounded-ctl border hairline px-2.5 py-1 text-xs text-ink2 hover:text-ink disabled:opacity-40"
            >
              {t("trial.reset")}
            </button>
            {stats.games > 0 && (
              <span className="self-center font-mono text-xs text-ink2">
                {t("goldfish.games", { games: stats.games })}
              </span>
            )}
          </div>

          {curve && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-mono text-xs">
                <caption className="sr-only">{t("goldfish.title")}</caption>
                <thead>
                  <tr className="border-b hairline text-left text-ink2">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("goldfish.turnCol")}
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("goldfish.thisGame")}
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("trial.distSample")}
                    </th>
                    <th scope="col" className="py-1 text-right font-medium">
                      {t("goldfish.exactCol")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {curve.map((row, i) => (
                    <tr key={row.turn} className="border-b hairline last:border-b-0">
                      <td className="py-1 pr-3 text-ink2">
                        {t("report.energy.turn", { t: row.turn, n: row.nSeen })}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {lastDeal ? (goldfishSeenBy(lastDeal, target.name, row.turn) ? "✓" : "✗") : "—"}
                      </td>
                      <td className="py-1 pr-3 text-right">{pct(stats.seenBy[i] ?? 0)}</td>
                      <td className="py-1 text-right">
                        {row.percent} = {row.fraction}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastDeal && (
            <p className="mt-2 font-mono text-xs text-ink2">
              {t("goldfish.sequence")}:{" "}
              {lastDeal.turnDraws
                .map((draws, i) => `T${i + 1}: ${draws.map((c) => c.name).join("+") || "—"}`)
                .join(" · ")}
              {lastDeal.mulligans > 0 ? ` · ${t("trial.mulligans", { n: lastDeal.mulligans })}` : ""}
            </p>
          )}

          <div className="mt-4 border-t hairline pt-3">
            <h4 className="text-sm font-medium">{t("goldfish.relay")}</h4>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink2">{t("goldfish.relayB")}</span>
                <select
                  value={relayName}
                  onChange={(e) => setRelayName(e.target.value)}
                  className="h-9 rounded-ctl border hairline bg-surface px-2 text-sm"
                >
                  <option value="">—</option>
                  {named
                    .filter((c) => c.name !== targetName)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} ×{c.count}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-ink2">{t("goldfish.relayTurn")}</span>
                <select
                  value={relayTurn}
                  onChange={(e) => setRelayTurn(Number(e.target.value))}
                  className="h-9 rounded-ctl border hairline bg-surface px-2 font-mono text-sm"
                >
                  {Array.from({ length: maxTurn }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {relayCard &&
              (relay ? (
                <p className="mt-2 font-mono text-sm">
                  {t("goldfish.relayLine", {
                    a: target.name,
                    b: relayCard.name,
                    tb: relayTurn,
                  })}
                  : {relay.joint.percent} = {relay.joint.fraction}
                  {stats.games > 0 && (
                    <span className="text-ink2">
                      {" "}
                      · {t("trial.distSample")} {pct(stats.relayHits)}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-xs text-warn" role="status">
                  {t("goldfish.relayNa")}
                </p>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
