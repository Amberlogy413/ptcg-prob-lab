import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore, deckBasics, type Deck } from "../state/deckStore.ts";
import { useTrainerStore } from "../state/trainerStore.ts";
import {
  buildTrainerQuestion,
  computeLuckMeter,
  type TrainerKind,
  type TrainerQuestion,
} from "../state/q5.ts";
import {
  comboOpening,
  prizeDistUnconditional,
  atLeastOnePrized,
  mul,
  sub,
  rat,
  R_ONE,
  percentStr,
} from "../lib/prob/index.ts";
import { ratPow } from "../lib/probx/luck.ts";
import { readJSON, writeJSON } from "../utils/storage.ts";

/**
 * B1 概率直覺訓練模式: questions from YOUR deck's real numbers, guess →
 * reveal exact → error history in localStorage (ppl.v1.training — key noted
 * in docs/DECISIONS.md). The only tool you may carry into a tournament is
 * your own intuition; this trains it.
 */

const TRAINING_KEY = "ppl.v1.training";
const MAX_RECORDS = 200;

interface TrainingRecord {
  ts: number;
  kind: TrainerKind;
  guessPct: number;
  exactPct: number;
  errorPp: number;
}

interface ActiveQuestion {
  kind: TrainerKind;
  q: TrainerQuestion;
}

function loadRecords(): TrainingRecord[] {
  return readJSON<TrainingRecord[]>(TRAINING_KEY) ?? [];
}

function pickQuestion(deck: Deck): ActiveQuestion | null {
  const named = deck.cards.filter((c) => c.name.trim() !== "" && c.count > 0);
  const kinds: TrainerKind[] = [];
  if (deckBasics(deck) >= 1) kinds.push("mulligan", "openingAtLeast1");
  if (named.length > 0) kinds.push("prizedAtLeast1", "seenByTurn");
  if (kinds.length === 0) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const kind = kinds[Math.floor(Math.random() * kinds.length)] as TrainerKind;
    const card = named[Math.floor(Math.random() * Math.max(named.length, 1))];
    const turn = 2 + Math.floor(Math.random() * 5); // T2..T6
    const q = buildTrainerQuestion(deck, kind, card?.name ?? "", turn);
    if (q) return { kind, q };
  }
  return null;
}

export function TrainerView() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;

  const [active, setActive] = useState<ActiveQuestion | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState<TrainingRecord | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>(loadRecords);

  // P9.3 loop: a question handed over from the trial table takes the stage.
  const pending = useTrainerStore((s) => s.pending);
  const setPending = useTrainerStore((s) => s.setPending);
  useEffect(() => {
    if (!pending) return;
    setActive(pending);
    setGuess("");
    setRevealed(null);
    setPending(null);
  }, [pending, setPending]);

  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const avg = (rs: TrainingRecord[]) =>
      rs.reduce((s, r) => s + Math.abs(r.errorPp), 0) / rs.length;
    return {
      n: records.length,
      avgAll: avg(records).toFixed(2),
      avgRecent: avg(records.slice(-10)).toFixed(2),
      recent: records.slice(-10),
    };
  }, [records]);

  function next(): void {
    if (!deck) return;
    setActive(pickQuestion(deck));
    setGuess("");
    setRevealed(null);
  }

  function reveal(): void {
    if (!active) return;
    const guessPct = Number(guess);
    if (!Number.isFinite(guessPct) || guessPct < 0 || guessPct > 100) return;
    const errorPp = guessPct - active.q.exactPct;
    const record: TrainingRecord = {
      ts: Date.now(),
      kind: active.kind,
      guessPct,
      exactPct: active.q.exactPct,
      errorPp,
    };
    const updated = [...records, record].slice(-MAX_RECORDS);
    setRecords(updated);
    writeJSON(TRAINING_KEY, updated);
    setRevealed(record);
  }

  if (!deck) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("trainer.title")}</h2>
        <p className="mt-2 text-sm text-ink2">{t("summary.noDeck")}</p>
      </section>
    );
  }

  const errClass = (err: number) =>
    Math.abs(err) <= 2 ? "text-good" : Math.abs(err) <= 5 ? "text-warn" : "text-bad";

  return (
    <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-xl font-medium">{t("trainer.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("trainer.desc")}</p>

      <div className="mt-4">
        {!active ? (
          <button
            type="button"
            onClick={next}
            className="rounded-ctl bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            {t("trainer.start")}
          </button>
        ) : (
          <div className="rounded-card border hairline p-4">
            <p className="text-base">{t(active.q.promptKey, active.q.promptParams)}</p>

            {!revealed ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step={0.1}
                    value={guess}
                    aria-label={t("trainer.guess.aria")}
                    onChange={(e) => setGuess(e.target.value)}
                    className="h-9 w-24 rounded-ctl border hairline bg-surface text-center font-mono"
                  />
                  %
                </label>
                <button
                  type="button"
                  disabled={guess.trim() === ""}
                  onClick={reveal}
                  className="rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {t("trainer.reveal")}
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="font-mono text-2xl">{active.q.percent}</p>
                <p className="font-mono text-xs text-ink2">
                  {active.q.fraction} · {active.q.oneIn}
                </p>
                <p className={`mt-2 font-mono text-sm ${errClass(revealed.errorPp)}`}>
                  {t("trainer.yourError", {
                    guess: revealed.guessPct.toFixed(1),
                    error: (revealed.errorPp >= 0 ? "+" : "−") + Math.abs(revealed.errorPp).toFixed(2),
                  })}
                </p>
                <button
                  type="button"
                  onClick={next}
                  className="mt-3 rounded-ctl bg-blue px-4 py-1.5 text-sm font-medium text-white"
                >
                  {t("trainer.next")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {stats && (
        <div className="mt-5 border-t hairline pt-4">
          <h3 className="text-sm font-medium text-ink2">{t("trainer.history.title")}</h3>
          <p className="mt-1 font-mono text-sm">
            {t("trainer.history.stats", { n: stats.n, avgAll: stats.avgAll, avgRecent: stats.avgRecent })}
          </p>
          <ul className="mt-2 space-y-0.5">
            {stats.recent.map((r) => (
              <li key={r.ts} className="flex items-center gap-2">
                <span
                  className={`h-1.5 rounded-full ${Math.abs(r.errorPp) <= 2 ? "bg-good" : Math.abs(r.errorPp) <= 5 ? "bg-warn" : "bg-bad"}`}
                  style={{ width: `${Math.min(Math.abs(r.errorPp) * 8, 100)}%`, minWidth: "4px" }}
                />
                <span className={`font-mono text-xs ${errClass(r.errorPp)}`}>
                  {(r.errorPp >= 0 ? "+" : "−") + Math.abs(r.errorPp).toFixed(2)}pp
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// C1 運氣儀表 (docs/02 §10) + B2 謬誤互動博物館 (docs/02 §9)
// ---------------------------------------------------------------------------

export function LuckMeter() {
  const t = useT();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const deck = decks.find((d) => d.id === activeDeckId) ?? null;
  const named = (deck?.cards ?? []).filter((c) => c.name.trim() !== "" && c.count > 0);

  const [cardName, setCardName] = useState("");
  const [mode, setMode] = useState<"openingAware" | "seenT1">("openingAware");
  const [games, setGames] = useState(5);

  const data = useMemo(() => {
    if (!deck || cardName === "") return null;
    return computeLuckMeter(deck, cardName, mode, games);
  }, [deck, cardName, mode, games]);

  if (!deck) return null;

  return (
    <section className="mt-4 rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-medium">{t("luck.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("luck.desc")}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <select
          value={cardName}
          aria-label={t("compare.card.aria")}
          onChange={(e) => setCardName(e.target.value)}
          className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
        >
          <option value="">{t("compare.pickCard")}</option>
          {[...new Set(named.map((c) => c.name))].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={mode}
          aria-label={t("luck.mode.aria")}
          onChange={(e) => setMode(e.target.value as "openingAware" | "seenT1")}
          className="h-8 rounded-ctl border hairline bg-surface px-1 text-sm"
        >
          <option value="openingAware">{t("luck.mode.opening")}</option>
          <option value="seenT1">{t("luck.mode.t1")}</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-ink2">
          {t("luck.games")}
          <input
            type="number"
            min={1}
            max={50}
            value={games}
            aria-label={t("luck.games")}
            onChange={(e) =>
              setGames(Math.max(1, Math.min(50, Math.trunc(Number(e.target.value) || 1))))
            }
            className="h-8 w-14 rounded-ctl border hairline bg-surface text-center font-mono text-sm"
          />
        </label>
      </div>

      {data && (
        <div className="mt-3">
          <p className="font-mono text-sm">
            {t("luck.perGame", { percent: data.perGame.percent, fraction: data.perGame.fraction })}
          </p>
          <p className="mt-1 font-mono text-xl">
            {t("luck.tail", { n: games, percent: data.tail.percent })}
          </p>
          <p className="font-mono text-xs text-ink2">
            {data.tail.fraction} · {data.tail.oneIn} · {t("luck.expected", { e: data.expected })}
          </p>
          <p className={"mt-2 text-sm " + (data.rare ? "text-good" : "text-ink2")}>
            {data.rare ? t("luck.verdict.rare") : t("luck.verdict.normal")}
          </p>
          <p className="mt-1 text-xs text-ink2">{t("luck.deckNote")}</p>
        </div>
      )}
    </section>
  );
}

interface FallacyDemo {
  titleKey: string;
  wrongKey: string;
  rightKey: string;
  lessonKey: string;
  wrong: string;
  right: string;
}

export function FallacyMuseum() {
  const t = useT();

  const demos = useMemo<FallacyDemo[]>(() => {
    // All four demos are EXACT rationals — even the "wrong" numbers are the
    // exact values of the wrong method (docs/02 §9).
    const p4 = comboOpening([{ count: 4, min: 1, max: 7 }], { N: 60, H: 7 }).event;
    const both = comboOpening(
      [
        { count: 4, min: 1, max: 7 },
        { count: 4, min: 1, max: 7 },
      ],
      { N: 60, H: 7 },
    ).event;
    const product = mul(p4, p4);

    const binomApprox = sub(R_ONE, ratPow(rat(56n, 60n), 7));

    const killer = comboOpening(
      [
        { count: 4, min: 1, max: 7, isBasic: true },
        { count: 3, min: 1, max: 7, isBasic: false },
      ],
      { N: 60, H: 7, mulliganAware: { otherBasics: 6 } },
    );

    const prized4 = atLeastOnePrized(prizeDistUnconditional(4, 60, 6));
    const naive40 = rat(4n, 10n);

    return [
      {
        titleKey: "museum.d1.title",
        wrongKey: "museum.wrong",
        rightKey: "museum.right",
        lessonKey: "museum.d1.lesson",
        wrong: percentStr(product, 6),
        right: percentStr(both, 6),
      },
      {
        titleKey: "museum.d2.title",
        wrongKey: "museum.wrong",
        rightKey: "museum.right",
        lessonKey: "museum.d2.lesson",
        wrong: percentStr(binomApprox, 6),
        right: percentStr(p4, 6),
      },
      {
        titleKey: "museum.d3.title",
        wrongKey: "museum.wrong",
        rightKey: "museum.right",
        lessonKey: "museum.d3.lesson",
        wrong: percentStr(killer.eventUnconditioned ?? killer.event, 6),
        right: percentStr(killer.event, 6),
      },
      {
        titleKey: "museum.d4.title",
        wrongKey: "museum.wrong",
        rightKey: "museum.right",
        lessonKey: "museum.d4.lesson",
        wrong: percentStr(naive40, 6),
        right: percentStr(prized4, 6),
      },
    ];
  }, []);

  return (
    <section className="mt-4 rounded-card border hairline bg-surface p-4 sm:p-6">
      <h2 className="text-lg font-medium">{t("museum.title")}</h2>
      <p className="mt-1 text-xs text-ink2">{t("museum.desc")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {demos.map((d) => (
          <div key={d.titleKey} className="rounded-card border hairline p-3">
            <h3 className="text-sm font-medium">{t(d.titleKey)}</h3>
            <p className="mt-2 font-mono text-sm">
              <span className="text-bad">{t(d.wrongKey)} {d.wrong}</span>
            </p>
            <p className="font-mono text-sm">
              <span className="text-good">{t(d.rightKey)} {d.right}</span>
            </p>
            <p className="mt-2 text-xs text-ink2">{t(d.lessonKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
