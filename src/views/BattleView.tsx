import { useEffect, useMemo, useState } from "react";
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
import {
  loadCatalog,
  localizeDeckRow,
  type Catalog,
} from "../data/catalog.ts";
import { cardAccent, NEUTRAL_ACCENT } from "../data/typeColors.ts";
import { useCardLang } from "../state/cardLang.ts";
import { CardVisual } from "../components/CardVisual.tsx";
import { ProofNumber, type Proof } from "../components/ProofNumber.tsx";
import { Modal } from "../components/Modal.tsx";

// Zones offered as move targets (stadium/lost-zone kept simple for v1).
const MOVE_ZONES: Zone[] = ["hand", "active", "bench", "discard", "deck", "prizes", "lostzone"];

/** Faithful local two-player sandbox + live exact draw odds (owner 2026-06-14). */
export function BattleView() {
  const t = useT();
  const { lang } = useCardLang();
  const decks = useDeckStore((s) => s.decks);
  const activeDeckId = useDeckStore((s) => s.activeDeckId);
  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  const started = useBattleStore((s) => s.started);
  const turn = useBattleStore((s) => s.turn);
  const current = useBattleStore((s) => s.current);
  const names = useBattleStore((s) => s.names);
  const p1 = useBattleStore((s) => s.p1);
  const p2 = useBattleStore((s) => s.p2);
  const newGame = useBattleStore((s) => s.newGame);
  const draw = useBattleStore((s) => s.draw);
  const moveCard = useBattleStore((s) => s.moveCard);
  const shuffleDeck = useBattleStore((s) => s.shuffleDeck);
  const mulligan = useBattleStore((s) => s.mulligan);
  const endTurn = useBattleStore((s) => s.endTurn);

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<{ player: PlayerId; iid: string } | null>(null);
  const [visual, setVisual] = useState<BattleCard | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (c) => alive && setCatalog(c),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  // Resolve a battle card to its localized name + type accent.
  function resolve(card: BattleCard): { name: string; accent: string } {
    if (catalog === null) return { name: card.name, accent: NEUTRAL_ACCENT };
    const loc = localizeDeckRow(catalog, { name: card.name, catalogId: card.catalogId }, lang);
    return { name: loc.name, accent: loc.card !== null ? cardAccent(loc.card) : NEUTRAL_ACCENT };
  }

  function start() {
    if (activeDeck === null) return;
    const specs: CardSpec[] = activeDeck.cards.map((c) => ({
      name: c.name,
      count: c.count,
      isBasic: c.isBasic,
      section: c.section === "unknown" ? "unknown" : c.section,
      ...(c.catalogId !== undefined ? { catalogId: c.catalogId } : {}),
    }));
    // v1: both players play the active deck (a mirror sandbox); per-player decks
    // come next. Seed from the deck size + time-free counter for reproducibility.
    const seed = (specs.reduce((s, c) => s + c.count, 0) * 2654435761) >>> 0;
    newGame({ p1: specs, p2: specs, seed, names: { p1: t("battle.you"), p2: t("battle.opp") } });
    setSelected(null);
  }

  if (!started) {
    return (
      <section className="rounded-card border hairline bg-surface p-6">
        <h2 className="text-xl font-medium">{t("battle.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink2">{t("battle.intro")}</p>
        {activeDeck === null ? (
          <p className="mt-4 text-sm text-warn">{t("battle.needDeck")}</p>
        ) : (
          <button
            type="button"
            onClick={start}
            className="mt-4 rounded-ctl bg-blue px-4 py-2 text-sm font-medium text-white"
          >
            {t("battle.start", { name: activeDeck.name || t("deck.untitled") })}
          </button>
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
          {t("battle.turn", { n: turn })} · {current === "p1" ? names.p1 : names.p2}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => endTurn()} className="rounded-ctl border hairline px-3 py-1.5 text-ink2 hover:text-ink">
            {t("battle.endTurn")}
          </button>
          <button type="button" onClick={start} className="rounded-ctl border hairline px-3 py-1.5 text-ink2 hover:text-ink">
            {t("battle.newGame")}
          </button>
        </div>
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
  player, board, name, opponent, resolve, selected, onSelect, onMove, onVisual, onDraw, onShuffle, onMulligan, t,
}: StripProps) {
  // Open zones (cards visible). Opponent's hand + both prizes + deck stay hidden (counts only).
  const visibleZones: Zone[] = ["active", "bench", "discard", "lostzone"];
  const handVisible = !opponent;
  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{name}</h3>
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
        <ZoneRow label={t("battle.zone.hand")} cards={board.hand} player={player} resolve={resolve} selected={selected} onSelect={onSelect} onMove={onMove} onVisual={onVisual} t={t} />
      )}
      {visibleZones.map((z) => (
        <ZoneRow key={z} label={t(ZONE_KEYS[z])} cards={board[z]} player={player} resolve={resolve} selected={selected} onSelect={onSelect} onMove={onMove} onVisual={onVisual} t={t} />
      ))}
    </section>
  );
}

function ZoneRow({
  label, cards, player, resolve, selected, onSelect, onMove, onVisual, t,
}: {
  label: string;
  cards: BattleCard[];
  player: PlayerId;
  resolve: (c: BattleCard) => { name: string; accent: string };
  selected: { player: PlayerId; iid: string } | null;
  onSelect: (iid: string) => void;
  onMove: (iid: string, to: Zone) => void;
  onVisual: (c: BattleCard) => void;
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
        <ProofNumber className="font-mono text-2xl" title={t("battle.hud.title")} value={odds.percent} proof={proof} />
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
