import { useCallback, useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import {
  useBattleStore,
  type Zone,
  type PlayerId,
  type BattleCard,
  type CardSpec,
} from "../state/battleStore.ts";
import { computeDrawOdds } from "../state/battle.ts";
import { AUTO_EFFECTS, applyAutoEffect } from "../state/battleEffects.ts";
import {
  loadDecks,
  localizeArchetype,
  tierizeName,
  type DeckData,
  type DeckBuild,
} from "../data/decks.ts";
import {
  loadCatalog,
  localizeDeckRow,
  type Catalog,
} from "../data/catalog.ts";
import { cardAccent, NEUTRAL_ACCENT } from "../data/typeColors.ts";
import { useCardLang } from "../state/cardLang.ts";
import { CardVisual } from "../components/CardVisual.tsx";
import { ProofNumber, type Proof } from "../components/ProofNumber.tsx";
import { buildExplain } from "../data/explain.ts";
import { Modal } from "../components/Modal.tsx";

// Zones offered as move targets (stadium/lost-zone kept simple for v1).
const MOVE_ZONES: Zone[] = ["hand", "active", "bench", "discard", "deck", "prizes", "lostzone"];

/** A pickable deck for the sandbox: a real meta archetype or a saved deck. */
interface DeckOption {
  id: string;
  label: string;
  /** "popular" = real Limitless data, "saved" = the player's own deck. */
  group: "popular" | "saved";
  total: number;
  specs: CardSpec[];
}

/** A build's 60 lines as battle specs (math reads only count + isBasic). */
function buildSpecs(build: DeckBuild | undefined): CardSpec[] {
  if (build === undefined) return [];
  return build.cards.map((c) => ({
    name: c.name,
    count: c.count,
    isBasic: c.isBasic,
    section: c.section,
  }));
}

/** zh title for a meta archetype, with the real tier read off its top build
 *  (多龍巴魯托ex / 超級甲賀忍蛙ex …) — same logic as the 牌組推薦 list. */
function archLabel(name: string, build: DeckBuild | undefined, catalog: Catalog | null): string {
  const cardNames =
    catalog === null
      ? []
      : (build?.cards ?? [])
          .filter((c) => c.section === "pokemon")
          .map((c) => localizeDeckRow(catalog, { name: c.name }, "zh").name);
  return tierizeName(localizeArchetype(name, catalog), cardNames);
}

/** Faithful local two-player sandbox + live exact draw odds (owner 2026-06-14). */
export function BattleView() {
  const t = useT();
  const { lang } = useCardLang();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);

  const started = useBattleStore((s) => s.started);
  const turn = useBattleStore((s) => s.turn);
  const current = useBattleStore((s) => s.current);
  const firstPlayer = useBattleStore((s) => s.firstPlayer);
  const turnSupporterUsed = useBattleStore((s) => s.turnSupporterUsed);
  const names = useBattleStore((s) => s.names);
  const p1 = useBattleStore((s) => s.p1);
  const p2 = useBattleStore((s) => s.p2);
  const newGame = useBattleStore((s) => s.newGame);
  const draw = useBattleStore((s) => s.draw);
  const moveCard = useBattleStore((s) => s.moveCard);
  const shuffleDeck = useBattleStore((s) => s.shuffleDeck);
  const mulligan = useBattleStore((s) => s.mulligan);
  const endTurn = useBattleStore((s) => s.endTurn);
  const markSupporterUsed = useBattleStore((s) => s.markSupporterUsed);
  const reset = useBattleStore((s) => s.reset);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [data, setData] = useState<DeckData | null>(null);
  const [decksError, setDecksError] = useState(false);
  const [selected, setSelected] = useState<{ player: PlayerId; iid: string } | null>(null);
  const [visual, setVisual] = useState<BattleCard | null>(null);
  // Matchup selection (option ids) + reproducible seed + who takes the first turn.
  const [p1Opt, setP1Opt] = useState<string>("");
  const [p2Opt, setP2Opt] = useState<string>("");
  const [seed, setSeed] = useState<number>(1);
  const [first, setFirst] = useState<PlayerId>("p1");
  // Transient note when an auto-effect is blocked by a real rule (turn-1 / 1-per-turn).
  const [effectMsg, setEffectMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (c) => alive && setCatalog(c),
      () => undefined,
    );
    loadDecks().then(
      (d) => alive && setData(d),
      () => alive && setDecksError(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Pickable decks: real meta archetypes (popular) + the player's saved decks.
  const options = useMemo<DeckOption[]>(() => {
    const popular: DeckOption[] =
      data === null
        ? []
        : data.archetypes.map((a) => {
            const build = a.builds[0];
            return {
              id: `pop:${a.id}`,
              label: archLabel(a.name, build, catalog),
              group: "popular" as const,
              // Honest size: never assume 60 for a build-less archetype.
              total: build === undefined ? 0 : build.total,
              specs: buildSpecs(build),
            };
          });
    const saved: DeckOption[] = decks.map((d) => ({
      id: `deck:${d.id}`,
      label: d.name || t("deck.untitled"),
      group: "saved" as const,
      total: d.cards.reduce((s, c) => s + c.count, 0),
      specs: d.cards.map((c) => ({
        name: c.name,
        count: c.count,
        isBasic: c.isBasic,
        section: c.section === "unknown" ? "unknown" : c.section,
        ...(c.catalogId !== undefined ? { catalogId: c.catalogId } : {}),
      })),
    }));
    return [...popular, ...saved];
  }, [data, catalog, decks, t]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  // Sensible defaults once options exist: you = your active deck (else top meta),
  // opponent = the most-played meta deck distinct from yours.
  useEffect(() => {
    if (options.length === 0) return;
    setP1Opt((cur) => {
      if (cur !== "" && byId.has(cur)) return cur;
      const mine = activeDeckId !== null ? `deck:${activeDeckId}` : "";
      return byId.has(mine) ? mine : (options[0]?.id ?? "");
    });
    setP2Opt((cur) => {
      if (cur !== "" && byId.has(cur)) return cur;
      const firstPopular = options.find((o) => o.group === "popular");
      return firstPopular?.id ?? options[0]?.id ?? "";
    });
  }, [options, byId, activeDeckId]);

  // Resolve a battle card to its localized name + type accent. Stable identity
  // (deps: catalog, lang) so the HUD's grouping useMemo keys off real changes.
  const resolve = useCallback(
    (card: BattleCard): { name: string; accent: string } => {
      if (catalog === null) return { name: card.name, accent: NEUTRAL_ACCENT };
      const loc = localizeDeckRow(catalog, { name: card.name, catalogId: card.catalogId }, lang);
      return { name: loc.name, accent: loc.card !== null ? cardAccent(loc.card) : NEUTRAL_ACCENT };
    },
    [catalog, lang],
  );

  // v2 (owner 2026-06-16): each side picks its OWN deck — straight from the real
  // 牌組推薦 meta or a saved deck. Seeded shuffle keeps every deal reproducible.
  function begin(useSeed: number) {
    const o1 = byId.get(p1Opt);
    const o2 = byId.get(p2Opt);
    if (o1 === undefined || o2 === undefined) return;
    newGame({ p1: o1.specs, p2: o2.specs, seed: useSeed >>> 0, names: { p1: o1.label, p2: o2.label }, first });
    setSelected(null);
    setEffectMsg(null);
  }
  const start = () => begin(seed);
  // "重新開局": same matchup, fresh deal — advance the seed deterministically (an
  // LCG step, no hidden randomness) so the new shuffle differs yet stays inspectable.
  function restart() {
    const ns = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    setSeed(ns);
    begin(ns);
  }

  // Auto-resolve a known, deterministic card effect — but only when the REAL
  // rules allow it: a Supporter is once-per-turn and the going-first player may
  // not play one on turn 1. Blocked attempts explain why (honest, faithful).
  function handleEffect(player: PlayerId, card: BattleCard) {
    const fx = AUTO_EFFECTS[card.name];
    if (fx === undefined) return;
    if (fx.supporter) {
      if (player !== current) {
        setEffectMsg(t("battle.fx.notYourTurn"));
        return;
      }
      if (turn === 1 && player === firstPlayer) {
        setEffectMsg(t("battle.fx.firstTurnNoSupporter"));
        return;
      }
      if (turnSupporterUsed) {
        setEffectMsg(t("battle.fx.supporterUsed"));
        return;
      }
    }
    const ok = applyAutoEffect(player, card.iid, card.name);
    if (!ok) return; // unrecognised card → stay manual, don't consume the Supporter
    if (fx.supporter) markSupporterUsed();
    setSelected(null);
    setEffectMsg(null);
  }

  // A faithful opening needs at least 7 (hand) + 6 (prizes) = 13 cards. Real meta
  // decks are always 60; this only guards a half-built saved deck (honesty: never
  // deal a broken opening while the sandbox promises a faithful one).
  const MIN_DEAL = 13;
  const sel1 = byId.get(p1Opt);
  const sel2 = byId.get(p2Opt);
  const undealable =
    (sel1 !== undefined && sel1.total < MIN_DEAL) || (sel2 !== undefined && sel2.total < MIN_DEAL);

  if (!started) {
    return (
      <section className="rounded-card border hairline bg-surface p-4 sm:p-6">
        <h2 className="text-xl font-medium">{t("battle.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink2">{t("battle.intro")}</p>
        {options.length === 0 ? (
          <p className="mt-4 text-sm" role={decksError ? "alert" : "status"}>
            <span className={decksError ? "text-warn" : "text-ink2"}>
              {decksError ? t("battle.decksError") : t("battle.loadingDecks")}
            </span>
          </p>
        ) : (
          <>
            {decksError && (
              <p className="mt-3 text-xs text-warn" role="alert">{t("battle.decksPartial")}</p>
            )}
            <p className="mt-4 text-sm">{t("battle.setupHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DeckSelect label={t("battle.deckYou")} value={p1Opt} onChange={setP1Opt} options={options} t={t} />
              <DeckSelect label={t("battle.deckOpp")} value={p2Opt} onChange={setP2Opt} options={options} t={t} />
            </div>
            {undealable && (
              <p className="mt-2 text-xs text-warn" role="alert">{t("battle.deckTooSmall")}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-ink2">
                <span>{t("battle.firstLabel")}</span>
                {(["p1", "p2"] as const).map((pl) => (
                  <button
                    key={pl}
                    type="button"
                    aria-pressed={first === pl}
                    onClick={() => setFirst(pl)}
                    className={
                      first === pl
                        ? "rounded-ctl border border-blue bg-blue px-2.5 py-1 text-xs font-medium text-white"
                        : "rounded-ctl border hairline bg-surface px-2.5 py-1 text-xs text-ink2 hover:text-ink"
                    }
                  >
                    {pl === "p1" ? t("battle.you") : t("battle.opp")}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-sm text-ink2">
                {t("battle.seedLabel")}
                <input
                  type="number"
                  min={0}
                  value={seed}
                  onChange={(e) => setSeed(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  className="h-9 w-24 rounded-ctl border hairline bg-surface px-2 text-center font-mono text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setSeed((s) => (Math.imul(s, 1103515245) + 12345) >>> 0)}
                title={t("battle.reseed")}
                className="rounded-ctl border hairline px-2 py-1.5 text-sm text-ink2 hover:text-ink"
              >
                🎲
              </button>
              <button
                type="button"
                onClick={start}
                disabled={p1Opt === "" || p2Opt === "" || undealable}
                className="ml-auto rounded-ctl bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t("battle.startBattle")}
              </button>
            </div>
          </>
        )}
        <p className="mt-4 max-w-2xl text-xs text-ink2">{t("battle.note")}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-ctl border hairline bg-paper p-3 text-sm">
        <span className="font-mono">
          {t("battle.turn", { n: turn })} · {current === "p1" ? t("battle.you") : t("battle.opp")} ·{" "}
          {current === "p1" ? names.p1 : names.p2}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => { endTurn(); setEffectMsg(null); }} className="rounded-ctl border hairline px-3 py-1.5 text-ink2 hover:text-ink">
            {t("battle.endTurn")}
          </button>
          <button type="button" onClick={restart} className="rounded-ctl border hairline px-3 py-1.5 text-ink2 hover:text-ink">
            {t("battle.newGame")}
          </button>
          <button type="button" onClick={() => reset()} className="rounded-ctl border hairline px-3 py-1.5 text-ink2 hover:text-ink">
            {t("battle.pickAgain")}
          </button>
        </div>
        {turn === 1 && (
          <p className="w-full text-xs text-warn" role="note">{t("battle.firstTurnRestriction")}</p>
        )}
        {effectMsg !== null && (
          <p className="w-full text-xs text-warn" role="alert">{effectMsg}</p>
        )}
      </div>

      {/* Opponent (top) — hand face-down */}
      <PlayerStrip
        player="p2"
        board={p2}
        name={names.p2}
        opponent
        resolve={resolve}
        selected={selected}
        onSelect={(iid) => setSelected({ player: "p2", iid })}
        onMove={(iid, to) => { moveCard("p2", iid, to); setSelected(null); }}
        onVisual={setVisual}
        onDraw={(n) => draw("p2", n)}
        onShuffle={() => shuffleDeck("p2")}
        onMulligan={() => mulligan("p2")}
        onEffect={(card) => handleEffect("p2", card)}
        t={t}
      />

      {/* You (bottom) + the live HUD */}
      <PlayerStrip
        player="p1"
        board={p1}
        name={names.p1}
        resolve={resolve}
        selected={selected}
        onSelect={(iid) => setSelected({ player: "p1", iid })}
        onMove={(iid, to) => { moveCard("p1", iid, to); setSelected(null); }}
        onVisual={setVisual}
        onDraw={(n) => draw("p1", n)}
        onShuffle={() => shuffleDeck("p1")}
        onMulligan={() => mulligan("p1")}
        onEffect={(card) => handleEffect("p1", card)}
        t={t}
      />

      <DrawHud board={p1} resolve={resolve} t={t} />

      {visual !== null && catalog !== null && (
        <BattleCardVisual card={visual} catalog={catalog} onClose={() => setVisual(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Deck picker for one side — real meta decks + the player's saved decks. */
function DeckSelect({
  label, value, onChange, options, t,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: DeckOption[];
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const popular = options.filter((o) => o.group === "popular");
  const saved = options.filter((o) => o.group === "saved");
  const opt = (o: DeckOption) => (
    <option key={o.id} value={o.id}>
      {o.label}
      {o.total !== 60 ? ` (${o.total})` : ""}
    </option>
  );
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-ctl border hairline bg-surface px-2 text-sm"
      >
        {popular.length > 0 && <optgroup label={t("battle.optPopular")}>{popular.map(opt)}</optgroup>}
        {saved.length > 0 && <optgroup label={t("battle.optSaved")}>{saved.map(opt)}</optgroup>}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------

interface StripProps {
  player: PlayerId;
  board: import("../state/battleStore.ts").PlayerBoard;
  name: string;
  opponent?: boolean;
  resolve: (c: BattleCard) => { name: string; accent: string };
  selected: { player: PlayerId; iid: string } | null;
  onSelect: (iid: string) => void;
  onMove: (iid: string, to: Zone) => void;
  onVisual: (c: BattleCard) => void;
  onDraw: (n: number) => void;
  onShuffle: () => void;
  onMulligan: () => void;
  /** Auto-resolve a known card effect (hand cards only). */
  onEffect: (c: BattleCard) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}

const ZONE_KEYS: Record<Zone, string> = {
  deck: "battle.zone.deck",
  hand: "battle.zone.hand",
  active: "battle.zone.active",
  bench: "battle.zone.bench",
  discard: "battle.zone.discard",
  prizes: "battle.zone.prizes",
  lostzone: "battle.zone.lostzone",
};

function PlayerStrip({
  player, board, name, opponent, resolve, selected, onSelect, onMove, onVisual, onDraw, onShuffle, onMulligan, onEffect, t,
}: StripProps) {
  // Open zones (cards visible). Opponent's hand + both prizes + deck stay hidden (counts only).
  const visibleZones: Zone[] = ["active", "bench", "discard", "lostzone"];
  const handVisible = !opponent;
  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">
          <span className="text-ink2">{opponent ? t("battle.opp") : t("battle.you")}</span> · {name}
        </h3>
        <span className="font-mono text-xs text-ink2">
          {t("battle.zone.deck")} {board.deck.length} · {t("battle.zone.prizes")} {board.prizes.length} · {t("battle.zone.hand")} {board.hand.length}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onDraw(1)} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">
            {t("battle.draw1")}
          </button>
          <button type="button" onClick={() => onShuffle()} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">
            {t("battle.shuffle")}
          </button>
          <button type="button" onClick={() => onMulligan()} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">
            {t("battle.mulligan")}
          </button>
        </div>
      </div>

      {handVisible && (
        <ZoneRow label={t("battle.zone.hand")} cards={board.hand} player={player} resolve={resolve} selected={selected} onSelect={onSelect} onMove={onMove} onVisual={onVisual} onEffect={onEffect} t={t} />
      )}
      {visibleZones.map((z) => (
        <ZoneRow key={z} label={t(ZONE_KEYS[z])} cards={board[z]} player={player} resolve={resolve} selected={selected} onSelect={onSelect} onMove={onMove} onVisual={onVisual} t={t} />
      ))}
    </section>
  );
}

function ZoneRow({
  label, cards, player, resolve, selected, onSelect, onMove, onVisual, onEffect, t,
}: {
  label: string;
  cards: BattleCard[];
  player: PlayerId;
  resolve: (c: BattleCard) => { name: string; accent: string };
  selected: { player: PlayerId; iid: string } | null;
  onSelect: (iid: string) => void;
  onMove: (iid: string, to: Zone) => void;
  onVisual: (c: BattleCard) => void;
  /** Present only on the hand row — auto-resolve a known card effect. */
  onEffect?: (c: BattleCard) => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className="mb-1.5">
      <p className="text-xs text-ink2">
        {label} <span className="font-mono">{cards.length}</span>
      </p>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {cards.map((c) => {
          const { name, accent } = resolve(c);
          const isSel = selected?.player === player && selected.iid === c.iid;
          return (
            <span key={c.iid} className="inline-flex flex-col">
              <button
                type="button"
                onClick={() => onSelect(c.iid)}
                style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
                className={
                  "max-w-44 truncate rounded-ctl border hairline px-2 py-1 text-left text-xs hover:bg-paper " +
                  (isSel ? "ring-2 ring-blue" : "")
                }
                title={name}
              >
                {name}
              </button>
              {isSel && (
                <span className="mt-1 flex flex-wrap gap-0.5">
                  <button type="button" onClick={() => onVisual(c)} className="rounded-ctl border hairline px-1 text-[11px] text-ink2 hover:text-ink">ⓘ</button>
                  {onEffect !== undefined && AUTO_EFFECTS[c.name] !== undefined && (
                    <button
                      type="button"
                      onClick={() => onEffect(c)}
                      title={t(AUTO_EFFECTS[c.name]!.summaryKey)}
                      className="rounded-ctl border border-blue px-1 text-[11px] font-medium text-blue hover:bg-blue/10"
                    >
                      {t("battle.fx.resolve")}
                    </button>
                  )}
                  {MOVE_ZONES.map((z) => (
                    <button key={z} type="button" onClick={() => onMove(c.iid, z)} className="rounded-ctl border hairline px-1 text-[11px] text-ink2 hover:text-ink">
                      {t(ZONE_KEYS[z])}
                    </button>
                  ))}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live exact draw-odds HUD.

function DrawHud({
  board, resolve, t,
}: {
  board: import("../state/battleStore.ts").PlayerBoard;
  resolve: (c: BattleCard) => { name: string; accent: string };
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  const [draws, setDraws] = useState(1);
  const [target, setTarget] = useState<string>("__basic__");

  // Unique remaining card names in the deck (+ a "any Basic" pseudo-target).
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; label: string }>();
    for (const c of board.deck) {
      const g = m.get(c.name);
      if (g) g.count += 1;
      else m.set(c.name, { count: 1, label: resolve(c).name });
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [board.deck, resolve]);

  // If the chosen target card is fully drawn/moved out of the deck, fall back to
  // "any Basic" so the select and the headline number never disagree (honesty).
  useEffect(() => {
    if (target !== "__basic__" && !groups.some((g) => g[0] === target)) setTarget("__basic__");
  }, [groups, target]);

  const deckSize = board.deck.length;
  const basics = board.deck.filter((c) => c.isBasic).length;
  const targetCount = target === "__basic__" ? basics : (groups.find((g) => g[0] === target)?.[1].count ?? 0);
  const targetLabel = target === "__basic__" ? t("battle.anyBasic") : (groups.find((g) => g[0] === target)?.[1].label ?? target);

  const odds = computeDrawOdds(deckSize, targetCount, draws);
  const proof: Proof = {
    receipt: [
      { label: t("proof.formula"), text: "P = 1 − C(N−K, n) / C(N, n)" },
      { label: t("proof.sub"), text: `N=${odds.deckSize}, K=${odds.targetCount}, n=${odds.draws}` },
      { label: t("proof.frac"), text: odds.fraction },
      { label: t("proof.pct"), text: odds.percent },
      { label: t("proof.oneIn"), text: odds.oneIn },
    ],
    interpret: t("battle.hud.interp", {
      target: targetLabel,
      k: odds.targetCount,
      n: odds.draws,
      pct: odds.percent,
      oneIn: odds.oneIn,
    }),
  };

  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <h3 className="text-sm font-medium">{t("battle.hud.title")}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-ink2">{t("battle.hud.target")}</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 max-w-52 rounded-ctl border hairline bg-surface px-2 text-sm"
          >
            <option value="__basic__">{t("battle.anyBasic")}({basics})</option>
            {groups.map(([nm, g]) => (
              <option key={nm} value={nm}>
                {g.label} ×{g.count}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-ink2">{t("battle.hud.draws")}</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, deckSize)}
            value={draws}
            onChange={(e) => setDraws(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 w-16 rounded-ctl border hairline bg-surface px-2 text-center font-mono text-sm"
          />
        </label>
      </div>
      <p className="mt-3">
        <ProofNumber
          className="font-mono text-2xl"
          title={t("battle.hud.title")}
          value={odds.percent}
          explain={buildExplain(t, "draw", { pct: odds.percent, frac: odds.fraction, oneIn: odds.oneIn })}
          proof={proof}
        />
      </p>
      <p className="mt-1 font-mono text-xs text-ink2">
        {odds.fraction} · {odds.oneIn} · {t("battle.hud.deckLeft", { n: deckSize })}
      </p>
    </section>
  );
}

function BattleCardVisual({ card, catalog, onClose }: { card: BattleCard; catalog: Catalog; onClose: () => void }) {
  // Resolve the instance to its catalog print for the full visual.
  const cc =
    (card.catalogId !== undefined ? catalog.cards.find((c) => c.id === card.catalogId) : undefined) ??
    catalog.cards.find((c) => c.name === card.name || c.nameZh === card.name) ??
    null;
  if (cc === null) {
    return (
      <Modal title={card.name} onClose={onClose}>
        <p className="text-sm text-ink2">{card.name}</p>
      </Modal>
    );
  }
  return (
    <Modal title={cc.name} onClose={onClose}>
      <CardVisual card={cc} setInfo={catalog.sets[cc.set ?? ""] ?? null} />
    </Modal>
  );
}
