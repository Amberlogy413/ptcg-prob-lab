import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { useDeckStore } from "../state/deckStore.ts";
import {
  useBattleStore,
  gameResult,
  SPECIAL_CONDITIONS,
  type Pile,
  type PlayerId,
  type BattleCard,
  type InPlay,
  type PlayerBoard,
  type CardSpec,
  type SpecialCondition,
  MAX_BENCH,
} from "../state/battleStore.ts";
import { toBattleSpec } from "../state/battlePlay.ts";
import { canPayCost, baseDamage, finalDamage, prizeValue, isVariableDamage } from "../state/battleAttack.ts";
import { runBotTurn, type BotEvent } from "../state/battleBot.ts";
import { computeDrawOdds } from "../state/battle.ts";
import { AUTO_EFFECTS } from "../state/battleEffects.ts";
import { engineStep, toEngineState } from "../state/battleBridge.ts";
import { isGustEffect, isSwitchEffect, searchSpecOf, makeCtx, observe, encodeObservation, type SearchSpec, type Observation, type SideView } from "../engine/index.ts";
import {
  loadDecks,
  localizeArchetype,
  tierizeName,
  type DeckData,
  type DeckBuild,
} from "../data/decks.ts";
import { loadCatalog, localizeDeckRow, resolveDeckRow, type Catalog, type CatalogCard } from "../data/catalog.ts";
import { cardAccent, NEUTRAL_ACCENT, TYPE_COLORS } from "../data/typeColors.ts";
import { TypeIcon } from "../components/TypeChip.tsx";
import { useCardLang } from "../state/cardLang.ts";
import { CardVisual } from "../components/CardVisual.tsx";
import { ProofNumber, type Proof } from "../components/ProofNumber.tsx";
import { buildExplain } from "../data/explain.ts";
import { Modal } from "../components/Modal.tsx";

type Resolve = (c: BattleCard) => { name: string; accent: string; types: string[]; ability: string | null };
type Tr = (k: string, p?: Record<string, string | number>) => string;

/** A pickable deck for the sandbox: a real meta archetype or a saved deck. */
interface DeckOption {
  id: string;
  label: string;
  group: "popular" | "saved";
  total: number;
  specs: CardSpec[];
}

/** zh title for a meta archetype, with the real tier read off its top build. */
function archLabel(name: string, build: DeckBuild | undefined, catalog: Catalog | null): string {
  const cardNames =
    catalog === null
      ? []
      : (build?.cards ?? [])
          .filter((c) => c.section === "pokemon")
          .map((c) => localizeDeckRow(catalog, { name: c.name }, "zh").name);
  return tierizeName(localizeArchetype(name, catalog), cardNames);
}

/** A build's 60 lines as battle specs, enriched with real play kind + facts. */
function buildSpecs(build: DeckBuild | undefined, catalog: Catalog | null): CardSpec[] {
  if (build === undefined) return [];
  return build.cards.map((c) => toBattleSpec(catalog, { name: c.name, count: c.count, isBasic: c.isBasic, section: c.section }));
}

/** Undo snapshot — the mutable game fields, captured before each action. */
type BattleSnapshot = Pick<
  ReturnType<typeof useBattleStore.getState>,
  | "turn"
  | "current"
  | "firstPlayer"
  | "turnSupporterUsed"
  | "turnEnergyAttached"
  | "turnStadiumPlayed"
  | "turnRetreated"
  | "everInPlay"
  | "p1"
  | "p2"
  | "shuffleNonce"
>;
function snapOf(s: ReturnType<typeof useBattleStore.getState>): BattleSnapshot {
  return {
    turn: s.turn,
    current: s.current,
    firstPlayer: s.firstPlayer,
    turnSupporterUsed: s.turnSupporterUsed,
    turnEnergyAttached: s.turnEnergyAttached,
    turnStadiumPlayed: s.turnStadiumPlayed,
    turnRetreated: s.turnRetreated,
    everInPlay: s.everInPlay,
    p1: s.p1,
    p2: s.p2,
    shuffleNonce: s.shuffleNonce,
  };
}

/** A faithful, turn-based local battle (owner request 2026-06-17). */
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
  const turnEnergyAttached = useBattleStore((s) => s.turnEnergyAttached);
  const turnStadiumPlayed = useBattleStore((s) => s.turnStadiumPlayed);
  const turnRetreated = useBattleStore((s) => s.turnRetreated);
  const everInPlay = useBattleStore((s) => s.everInPlay);
  const log = useBattleStore((s) => s.log);
  const names = useBattleStore((s) => s.names);
  const p1 = useBattleStore((s) => s.p1);
  const p2 = useBattleStore((s) => s.p2);
  const store = useBattleStore;

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [data, setData] = useState<DeckData | null>(null);
  const [decksError, setDecksError] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [visual, setVisual] = useState<BattleCard | null>(null);
  const [p1Opt, setP1Opt] = useState<string>("");
  const [p2Opt, setP2Opt] = useState<string>("");
  const [seed, setSeed] = useState<number>(1);
  const [first, setFirst] = useState<PlayerId>("p1");
  const [msg, setMsg] = useState<string | null>(null);
  const [autoAi, setAutoAi] = useState(false); // AI auto-plays the opponent's turn

  // Undo (P4): run a user gesture ATOMICALLY — one snapshot BEFORE the gesture,
  // kept only if the gesture actually changed the game. So a composite multi-step
  // action (auto-effect Supporter, attack→KO→prize→endTurn) reverses in ONE tap,
  // and a no-op / failed action never consumes a slot. (review fix 2026-06-17,
  // replacing the per-set subscription that desynced composite undos.)
  const history = useRef<BattleSnapshot[]>([]);
  const act = useCallback((fn: () => void): boolean => {
    const s = useBattleStore.getState();
    if (!s.started) {
      fn();
      return false;
    }
    const before = snapOf(s);
    fn();
    const a = useBattleStore.getState();
    const changed =
      before.p1 !== a.p1 || before.p2 !== a.p2 || before.turn !== a.turn || before.current !== a.current ||
      before.turnSupporterUsed !== a.turnSupporterUsed || before.turnEnergyAttached !== a.turnEnergyAttached ||
      before.turnStadiumPlayed !== a.turnStadiumPlayed || before.turnRetreated !== a.turnRetreated ||
      before.everInPlay !== a.everInPlay || before.shuffleNonce !== a.shuffleNonce;
    if (changed) {
      history.current.push(before);
      if (history.current.length > 40) history.current.shift();
    }
    return changed;
  }, []);
  const note = useCallback((msg: string) => useBattleStore.getState().note(msg), []);
  function undo() {
    const prev = history.current.pop();
    if (prev === undefined) return;
    useBattleStore.setState(prev);
    setSel(null);
    setMsg(null);
  }

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
              total: build === undefined ? 0 : build.total,
              specs: buildSpecs(build, catalog),
            };
          });
    const saved: DeckOption[] = decks.map((d) => ({
      id: `deck:${d.id}`,
      label: d.name || t("deck.untitled"),
      group: "saved" as const,
      total: d.cards.reduce((s, c) => s + c.count, 0),
      specs: d.cards.map((c) =>
        toBattleSpec(catalog, {
          name: c.name,
          count: c.count,
          isBasic: c.isBasic,
          section: c.section === "unknown" ? "unknown" : c.section,
          ...(c.catalogId !== undefined ? { catalogId: c.catalogId } : {}),
        }),
      ),
    }));
    return [...popular, ...saved];
  }, [data, catalog, decks, t]);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

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

  const resolve = useCallback<Resolve>(
    (card) => {
      if (catalog === null) return { name: card.name, accent: NEUTRAL_ACCENT, types: [], ability: null };
      const loc = localizeDeckRow(catalog, { name: card.name, ...(card.catalogId !== undefined ? { catalogId: card.catalogId } : {}) }, lang);
      const cc = loc.card;
      return {
        name: loc.name,
        accent: cc !== null ? cardAccent(cc) : NEUTRAL_ACCENT,
        types: cc?.types ?? [],
        ability: cc?.abilities?.[0]?.name ?? null,
      };
    },
    [catalog, lang],
  );

  // Resolve a battle card to its full catalog print (for attacks / weakness).
  const catalogOf = useCallback(
    (card: BattleCard): CatalogCard | null =>
      catalog === null ? null : resolveDeckRow(catalog, { name: card.name, ...(card.catalogId !== undefined ? { catalogId: card.catalogId } : {}) }),
    [catalog],
  );

  // Detection goes through the engine's own ctx (single rules source) — it resolves
  // to the zh-Hant print so effect text matches even when the deck row points at a
  // Japanese print (夜のタンカ / リーリエの決心). Used for the targeted/search pickers.
  const ectx = useMemo(() => makeCtx(catalog), [catalog]);
  const effectKind = useCallback(
    (card: BattleCard): "gust" | "switch" | null => {
      const eff = ectx.resolve(card)?.effect;
      if (isGustEffect(eff)) return "gust";
      if (isSwitchEffect(eff)) return "switch";
      return null;
    },
    [ectx],
  );

  // A modeled search Item (Nest/Master Ball, Night Stretcher) → its pile spec, or
  // null. The pick (which card from deck/discard) is the action (engine bridge).
  const searchSpec = useCallback((card: BattleCard): SearchSpec | null => searchSpecOf(ectx.resolve(card)?.effect), [ectx]);

  function begin(useSeed: number) {
    const o1 = byId.get(p1Opt);
    const o2 = byId.get(p2Opt);
    if (o1 === undefined || o2 === undefined) return;
    store.getState().newGame({ p1: o1.specs, p2: o2.specs, seed: useSeed >>> 0, names: { p1: o1.label, p2: o2.label }, first });
    history.current = []; // a fresh deal starts a fresh undo history
    setSel(null);
    setMsg(null);
  }
  const start = () => begin(seed);
  function restart() {
    const ns = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    setSeed(ns);
    begin(ns);
  }

  // --- Play a hand card by its real type (the core faithful rules) ---------
  const me = current; // the player whose turn it is acts; their hand is shown.
  // Auto-effect lookup keys on the zh display name, so an English-named saved /
  // imported deck still resolves the supported Supporters (review fix 2026-06-17).
  const autoKey = useCallback(
    (card: BattleCard): string =>
      catalog === null
        ? card.name
        : localizeDeckRow(catalog, { name: card.name, ...(card.catalogId !== undefined ? { catalogId: card.catalogId } : {}) }, "zh").name,
    [catalog],
  );
  function play(card: BattleCard, action: PlayAction) {
    // Capture a targeted effect's target name BEFORE the swap moves it.
    let targetName = "";
    if (action.type === "gust") {
      const u = oppBoard.bench.find((x) => x.uid === action.targetUid);
      targetName = u !== undefined ? resolve(u.card).name : "";
    } else if (action.type === "switch") {
      const u = meBoard.bench.find((x) => x.uid === action.benchUid);
      targetName = u !== undefined ? resolve(u.card).name : "";
    } else if (action.type === "search") {
      const c = [...meBoard.deck, ...meBoard.discard].find((x) => x.iid === action.foundIid);
      targetName = c !== undefined ? resolve(c).name : "";
    }
    const changed = act(() => {
      const s = store.getState();
      setMsg(null);
      switch (action.type) {
        // Placement / attach / stadium route through the engine (single rules
        // source); the store's identical reducers remain only for tests + the bot.
        case "toActive":
          if (!engineStep({ type: "playToActive", iid: card.iid }, catalog)) setMsg(t("battle.field.activeFull"));
          break;
        case "toBench":
          if (!engineStep({ type: "playToBench", iid: card.iid }, catalog))
            setMsg(t(meBoard.active === null ? "battle.field.noActive" : "battle.field.benchFull"));
          break;
        case "evolve":
          // Kept store-side: the engine name-gates evolution, but zh/ja/en names
          // are unreliable across decks, so the sandbox stays permissive (honest).
          s.evolve(me, card.iid, action.unitId);
          break;
        case "energy":
          if (turnEnergyAttached) {
            setMsg(t("battle.gate.energyUsed"));
            return;
          }
          engineStep({ type: "attachEnergy", handIid: card.iid, unitId: action.unitId }, catalog);
          break;
        case "tool":
          s.attachTool(me, card.iid, action.unitId); // store-side: sandbox allows >1 Tool
          break;
        case "stadium":
          if (turnStadiumPlayed) {
            setMsg(t("battle.gate.stadiumUsed"));
            return;
          }
          engineStep({ type: "playStadium", iid: card.iid }, catalog);
          break;
        case "supporter": {
          if (turn === 1 && me === firstPlayer) {
            setMsg(t("battle.fx.firstTurnNoSupporter"));
            return;
          }
          if (turnSupporterUsed) {
            setMsg(t("battle.fx.supporterUsed"));
            return;
          }
          // Modeled Supporters resolve through the engine (single rules source);
          // anything else is discarded and resolved by hand (needs a choice we
          // don't model — honest, never guessed).
          if (!engineStep({ type: "playSupporter", iid: card.iid }, catalog)) {
            s.discardFromHand(me, card.iid);
            s.markSupporterUsed();
          }
          break;
        }
        case "item":
          s.discardFromHand(me, card.iid);
          break;
        case "gust":
          // Boss's Orders — resolved by the engine (single rules source).
          if (!engineStep({ type: "playGust", iid: card.iid, targetUid: action.targetUid }, catalog)) setMsg(t("battle.gate.gust"));
          break;
        case "switch":
          // Switch — resolved by the engine (single rules source).
          if (!engineStep({ type: "playSwitch", iid: card.iid, benchUid: action.benchUid }, catalog)) setMsg(t("battle.field.noActive"));
          break;
        case "search":
          // Nest/Master Ball, Night Stretcher — resolved by the engine.
          if (!engineStep({ type: "search", iid: card.iid, foundIid: action.foundIid }, catalog)) setMsg(t("battle.field.benchFull"));
          break;
        case "discard":
          s.discardFromHand(me, card.iid);
          break;
        case "toPile":
          s.moveToPile(me, card.iid, action.pile);
          // Returning a card to the deck SHUFFLES it in — never silently bottom-stack
          // a known card, which would make the exact-odds HUD wrong (review fix).
          if (action.pile === "deck") s.shuffleDeck(me);
          break;
      }
    });
    if (changed) {
      const cn = resolve(card).name;
      const who = names[me];
      if (action.type === "gust") {
        note(t("battle.log.gust", { who, card: cn, target: targetName }));
      } else if (action.type === "switch") {
        note(t("battle.log.switch", { who, card: cn, target: targetName }));
      } else if (action.type === "search") {
        note(t("battle.log.search", { who, card: cn, target: targetName }));
      } else {
        const key = {
          toActive: "battle.log.active",
          toBench: "battle.log.bench",
          evolve: "battle.log.evolve",
          energy: "battle.log.energy",
          tool: "battle.log.tool",
          stadium: "battle.log.stadium",
          supporter: "battle.log.supporter",
          item: "battle.log.item",
          discard: "battle.log.discard",
          toPile: "battle.log.toDeck",
        }[action.type];
        if (key !== undefined) note(t(key, { who, card: cn }));
      }
    }
    setSel(null);
  }

  function unitAction(player: PlayerId, unitId: string, kind: UnitActionKind) {
    setMsg(null);
    if (kind === "retreat" && player === me && turnRetreated) {
      setMsg(t("battle.gate.retreatUsed"));
      return;
    }
    const board = player === "p1" ? p1 : p2;
    const unitName = resolve((unitList(board).find((u) => u.uid === unitId) ?? { card: { name: "" } as BattleCard }).card).name;
    const changed = act(() => {
      const s = store.getState();
      switch (kind) {
        case "retreat":
          if (!s.retreat(player, unitId)) setMsg(t("battle.field.noActive"));
          break;
        case "promote":
          s.promote(player, unitId);
          break;
        case "ko":
          s.knockOut(player, unitId);
          break;
        case "scoop":
          s.scoopToHand(player, unitId);
          break;
      }
    });
    if (changed) {
      note(t(`battle.log.${kind}`, { who: names[player], card: unitName }));
    }
    setSel(null);
  }

  const MIN_DEAL = 13;
  const sel1 = byId.get(p1Opt);
  const sel2 = byId.get(p2Opt);
  const undealable = (sel1 !== undefined && sel1.total < MIN_DEAL) || (sel2 !== undefined && sel2.total < MIN_DEAL);

  if (!started) {
    return (
      <section className="rounded-card border hairline bg-surface p-4 sm:p-5">
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
            {decksError && <p className="mt-3 text-xs text-warn" role="alert">{t("battle.decksPartial")}</p>}
            <p className="mt-4 text-sm">{t("battle.setupHint")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <DeckSelect label={t("battle.deckYou")} value={p1Opt} onChange={setP1Opt} options={options} t={t} />
              <DeckSelect label={t("battle.deckOpp")} value={p2Opt} onChange={setP2Opt} options={options} t={t} />
            </div>
            {undealable && <p className="mt-2 text-xs text-warn" role="alert">{t("battle.deckTooSmall")}</p>}
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

  const meBoard: PlayerBoard = me === "p1" ? p1 : p2;
  const oppId: PlayerId = me === "p1" ? "p2" : "p1";
  const oppBoard: PlayerBoard = oppId === "p1" ? p1 : p2;
  const meUnits = unitList(meBoard);

  // --- Attack (P2): the Active Pokémon's real attacks vs the opponent's Active.
  const meActiveCard = meBoard.active !== null ? catalogOf(meBoard.active.card) : null;
  const attackList = (meActiveCard?.attacks ?? []).map((a, i) => ({
    idx: i,
    name: a.name,
    cost: a.cost ?? [],
    damage: a.damage,
    canPay: meBoard.active !== null && canPayCost(meBoard.active.energy, a.cost),
  }));
  function doAttack(idx: number) {
    setMsg(null);
    const active = meBoard.active;
    const oppActive = oppBoard.active;
    if (active === null) return;
    if (turn === 1 && me === firstPlayer) {
      setMsg(t("battle.atk.firstTurnNoAttack"));
      return;
    }
    if (oppActive === null) {
      setMsg(t("battle.atk.noTarget"));
      return;
    }
    const atk = (meActiveCard?.attacks ?? [])[idx];
    if (atk === undefined) return;
    if (!canPayCost(active.energy, atk.cost)) {
      setMsg(t("battle.atk.notEnough"));
      return;
    }
    const oppCard = catalogOf(oppActive.card);
    const { damage, weakness, resistance } = finalDamage(meActiveCard, oppCard, baseDamage(atk.damage));
    const newDamage = oppActive.damage + damage;
    const hp = oppActive.card.hp;
    const ko = hp !== undefined && newDamage >= hp;
    const prizes = ko ? prizeValue(oppCard) : 0;
    // One atomic gesture (damage → KO+prize → endTurn) so a single Undo reverses
    // the whole attack, not just the turn flip (review fix 2026-06-17).
    const changed = act(() => {
      const s = store.getState();
      s.setDamage(oppId, oppActive.uid, newDamage);
      if (ko) {
        s.knockOut(oppId, oppActive.uid);
        s.takePrize(me, prizes);
      }
      s.endTurn(); // attacking ends your turn (faithful)
    });
    // HONEST: a "+"/"×" attack's printed base is only an approximation — the real
    // multiplier/bonus is not in the data — so we never present it as exact.
    const approx = isVariableDamage(atk.damage);
    const tags = [approx ? t("battle.atk.approx") : "", weakness ? t("battle.atk.weak") : "", resistance ? t("battle.atk.resist") : ""]
      .filter(Boolean)
      .join(" ");
    let result = t("battle.atk.result", { atk: atk.name, dmg: approx ? `≈${damage}` : damage, tags });
    if (ko) result += " " + t("battle.atk.ko", { n: prizes });
    if (changed) note(`${names[me]}: ${result}`);
    setSel(null);
    setMsg(result);
  }

  // AI auto-player (owner 2026-06-18): run one deterministic heuristic turn for
  // the CURRENT player through the same rules engine, as ONE atomic undo step,
  // and append its log lines. Honest: a rule-based opponent, not a trained model.
  function runBot() {
    if (gameResult(useBattleStore.getState()) !== null) return; // game already won
    const p = useBattleStore.getState().current;
    let events: BotEvent[] = [];
    const changed = act(() => {
      events = runBotTurn(p, catalog, { who: names[p], nameOf: (c) => resolve(c).name, autoKey });
    });
    if (changed) {
      events.forEach((e) => note(t(e.key, e.params)));
      setSel(null);
    }
  }

  // AI-vs-AI: let the heuristic bot play BOTH sides until someone wins (or a turn
  // cap — the bots can stall, e.g. no payable attack, and the sandbox doesn't
  // auto-decide deck-out). Honest: still the rule-based bot, not a trained model.
  const AI_MATCH_CAP = 60;
  function runBotMatch() {
    let steps = 0;
    while (gameResult(useBattleStore.getState()) === null && steps < AI_MATCH_CAP) {
      const p = useBattleStore.getState().current;
      let events: BotEvent[] = [];
      const changed = act(() => {
        events = runBotTurn(p, catalog, { who: names[p], nameOf: (c) => resolve(c).name, autoKey });
      });
      if (!changed) break;
      events.forEach((e) => note(t(e.key, e.params)));
      steps++;
    }
    const done = gameResult(useBattleStore.getState());
    note(done !== null ? t("battle.ai.matchDone") : t("battle.ai.matchCapped", { n: AI_MATCH_CAP }));
    setSel(null);
  }

  // Win detection (P3): all prizes taken, or a wiped board.
  const result = gameResult({ started, turn, p1, p2, everInPlay });

  return (
    <div className="flex flex-col gap-3">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-ctl border hairline bg-paper p-2.5 text-sm">
        <span className="font-mono">
          {t("battle.turn", { n: turn })} · <span className="font-medium">{names[me]}</span>{" "}
          <span className="text-ink2">{t("battle.actingNow")}</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runBot}
            title={t("battle.ai.note")}
            className="rounded-ctl border border-blue px-3 py-1.5 text-xs font-medium text-blue hover:bg-blue/10"
          >
            🤖 {t("battle.ai.act")}
          </button>
          <button
            type="button"
            onClick={runBotMatch}
            title={t("battle.ai.matchNote")}
            className="rounded-ctl border border-blue px-3 py-1.5 text-xs font-medium text-blue hover:bg-blue/10"
          >
            🤖⚔️ {t("battle.ai.match")}
          </button>
          <label className="flex items-center gap-1 text-xs text-ink2" title={t("battle.ai.note")}>
            <input type="checkbox" checked={autoAi} onChange={(e) => setAutoAi(e.target.checked)} />
            {t("battle.ai.auto")}
          </label>
          <button
            type="button"
            onClick={undo}
            disabled={history.current.length === 0}
            className="rounded-ctl border hairline px-3 py-1.5 text-xs text-ink2 hover:text-ink disabled:opacity-40"
          >
            {t("battle.undo")}
          </button>
          <button type="button" onClick={() => { const who = names[me]; if (act(() => store.getState().endTurn())) note(t("battle.log.endTurn", { who })); setSel(null); setMsg(null); if (autoAi) runBot(); }} className="rounded-ctl bg-blue px-3 py-1.5 text-xs font-medium text-white">{t("battle.endTurn")}</button>
          <button type="button" onClick={restart} className="rounded-ctl border hairline px-3 py-1.5 text-xs text-ink2 hover:text-ink">{t("battle.newGame")}</button>
          <button type="button" onClick={() => { history.current = []; store.getState().reset(); }} className="rounded-ctl border hairline px-3 py-1.5 text-xs text-ink2 hover:text-ink">{t("battle.pickAgain")}</button>
        </div>
        {turn === 1 && me === firstPlayer && (
          <p className="w-full text-xs text-warn" role="note">{t("battle.firstTurnRestriction")}</p>
        )}
        {msg !== null && <p className="w-full text-xs text-warn" role="alert">{msg}</p>}
        {meBoard.deck.length === 0 && (
          <p className="w-full text-xs text-warn" role="note">{t("battle.win.deckOut", { name: names[me] })}</p>
        )}
      </div>

      {result !== null && (
        <div className="rounded-card border border-good bg-good/5 p-3 text-center" role="status">
          <p className="text-lg font-semibold text-good">{t("battle.win.banner", { name: names[result.winner] })}</p>
          <p className="mt-0.5 text-xs text-ink2">
            {t(result.reason === "prizes" ? "battle.win.byPrizes" : "battle.win.byWipe", { loser: names[result.winner === "p1" ? "p2" : "p1"] })}
          </p>
        </div>
      )}

      {log.length > 0 && (
        <details className="rounded-ctl border hairline bg-paper px-3 py-2" open>
          <summary className="cursor-pointer text-xs font-medium text-ink2">
            {t("battle.log.title")} <span className="font-mono">{log.length}</span>
          </summary>
          <ol className="mt-1 max-h-36 space-y-0.5 overflow-y-auto pr-1" aria-live="polite">
            {log
              .map((line, i) => ({ line, i }))
              .reverse()
              .map(({ line, i }) => (
                <li key={i} className="font-mono text-[11px] leading-snug text-ink2">
                  {line}
                </li>
              ))}
          </ol>
        </details>
      )}

      {started && result === null && <ObservationPanel obs={observe(toEngineState(useBattleStore.getState()), current)} t={t} />}

      {/* Opponent (top, mirrored): board only, hand hidden */}
      <PlayerHalf
        player={oppId}
        board={oppBoard}
        name={names[oppId]}
        roleLabel={t("battle.opp")}
        mirror
        resolve={resolve}
        sel={sel}
        setSel={setSel}
        onUnitAction={unitAction}
        onVisual={setVisual}
        store={store}
        act={act}
        note={note}
        t={t}
      />

      <StadiumBand meBoard={meBoard} oppBoard={oppBoard} meName={names[me]} oppName={names[oppId]} resolve={resolve} onVisual={setVisual} t={t} />

      {/* You (bottom): board + the actionable hand */}
      <PlayerHalf
        player={me}
        board={meBoard}
        name={names[me]}
        roleLabel={t("battle.you")}
        isMe
        resolve={resolve}
        sel={sel}
        setSel={setSel}
        onUnitAction={unitAction}
        onVisual={setVisual}
        store={store}
        act={act}
        note={note}
        t={t}
      />

      {meBoard.active !== null && (attackList.length > 0 || (meActiveCard?.abilities?.length ?? 0) > 0) && (
        <AttackPanel
          attacker={resolve(meBoard.active.card).name}
          defender={oppBoard.active !== null ? resolve(oppBoard.active.card).name : null}
          attacks={attackList}
          abilities={(meActiveCard?.abilities ?? []).map((a) => a.name)}
          canAttack={!(turn === 1 && me === firstPlayer) && oppBoard.active !== null}
          onAttack={doAttack}
          t={t}
        />
      )}

      <HandRow
        board={meBoard}
        units={meUnits}
        oppBench={oppBoard.bench}
        oppHasActive={oppBoard.active !== null}
        effectKind={effectKind}
        searchSpec={searchSpec}
        resolveName={(c) => resolve(c).name}
        flags={{ supporterUsed: turnSupporterUsed, energyUsed: turnEnergyAttached, stadiumUsed: turnStadiumPlayed, firstTurnNoSupporter: turn === 1 && me === firstPlayer }}
        resolve={resolve}
        sel={sel}
        setSel={setSel}
        onPlay={play}
        autoKey={autoKey}
        onVisual={setVisual}
        t={t}
      />

      <DrawHud board={meBoard} resolve={resolve} t={t} />

      {visual !== null && catalog !== null && (
        <BattleCardVisual card={visual} catalog={catalog} onClose={() => setVisual(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selection + action types

type Sel =
  | { scope: "hand"; iid: string }
  | { scope: "unit"; player: PlayerId; unitId: string }
  | { scope: "pile"; player: PlayerId; iid: string };

type PlayAction =
  | { type: "toActive" }
  | { type: "toBench" }
  | { type: "evolve"; unitId: string }
  | { type: "energy"; unitId: string }
  | { type: "tool"; unitId: string }
  | { type: "stadium" }
  | { type: "supporter" }
  | { type: "item" }
  | { type: "gust"; targetUid: string } // Boss's Orders → opponent bench Pokémon
  | { type: "switch"; benchUid: string } // Switch → own bench Pokémon
  | { type: "search"; foundIid: string } // Nest/Master Ball, Night Stretcher → pick from a pile
  | { type: "discard" }
  | { type: "toPile"; pile: Pile };

type UnitActionKind = "retreat" | "promote" | "ko" | "scoop";

interface HandFlags {
  supporterUsed: boolean;
  energyUsed: boolean;
  stadiumUsed: boolean;
  firstTurnNoSupporter: boolean;
}

function unitList(board: PlayerBoard): InPlay[] {
  return board.active !== null ? [board.active, ...board.bench] : board.bench;
}

/** A short label for an in-play unit slot (戰鬥場 / 備戰 n). */
function unitSlotLabel(board: PlayerBoard, unitId: string, t: Tr): string {
  if (board.active?.uid === unitId) return t("battle.zone.active");
  const i = board.bench.findIndex((u) => u.uid === unitId);
  return i === -1 ? t("battle.zone.bench") : `${t("battle.zone.bench")}${i + 1}`;
}

// ---------------------------------------------------------------------------

function DeckSelect({
  label, value, onChange, options, t,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: DeckOption[];
  t: Tr;
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-ctl border hairline bg-surface px-2 text-sm">
        {popular.length > 0 && <optgroup label={t("battle.optPopular")}>{popular.map(opt)}</optgroup>}
        {saved.length > 0 && <optgroup label={t("battle.optSaved")}>{saved.map(opt)}</optgroup>}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------
// One player's half of the board.

function PlayerHalf({
  player, board, name, roleLabel, mirror, isMe, resolve, sel, setSel, onUnitAction, onVisual, store, act, note, t,
}: {
  player: PlayerId;
  board: PlayerBoard;
  name: string;
  roleLabel: string;
  mirror?: boolean;
  isMe?: boolean;
  resolve: Resolve;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  onUnitAction: (player: PlayerId, unitId: string, kind: UnitActionKind) => void;
  onVisual: (c: BattleCard) => void;
  store: typeof useBattleStore;
  /** Run a mutating gesture atomically for undo; returns whether it changed. */
  act: (fn: () => void) => boolean;
  /** Append a line to the action log. */
  note: (msg: string) => void;
  t: Tr;
}) {
  const header = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-medium">
        <span className="text-ink2">{roleLabel}</span> · {name}
      </h3>
      <span className="font-mono text-xs text-ink2">
        {t("battle.zone.deck")} {board.deck.length} · {t("battle.zone.prizes")} {board.prizes.length} · {t("battle.zone.hand")} {board.hand.length}
      </span>
      {isMe && (
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" onClick={() => { if (act(() => store.getState().draw(player, 1))) note(t("battle.log.draw", { who: name, n: 1 })); }} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">{t("battle.draw1")}</button>
          <button type="button" onClick={() => { if (act(() => store.getState().shuffleDeck(player))) note(t("battle.log.shuffle", { who: name })); }} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">{t("battle.shuffle")}</button>
          <button type="button" onClick={() => { if (act(() => store.getState().mulligan(player))) note(t("battle.log.mulligan", { who: name })); }} className="rounded-ctl border hairline px-2 py-1 text-xs text-ink2 hover:text-ink">{t("battle.mulligan")}</button>
        </div>
      )}
    </div>
  );

  const activeRow = (
    <FieldRow
      label={t("battle.zone.active")}
      front
      units={board.active !== null ? [board.active] : []}
      empty={t("battle.field.noActive")}
      board={board}
      player={player}
      resolve={resolve}
      sel={sel}
      setSel={setSel}
      onUnitAction={onUnitAction}
      onVisual={onVisual}
      act={act}
      t={t}
    />
  );
  const benchRow = (
    <FieldRow
      label={`${t("battle.zone.bench")} ${board.bench.length}/${MAX_BENCH}`}
      units={board.bench}
      empty={t("battle.field.benchEmpty")}
      board={board}
      player={player}
      resolve={resolve}
      sel={sel}
      setSel={setSel}
      onUnitAction={onUnitAction}
      onVisual={onVisual}
      act={act}
      t={t}
    />
  );
  const piles = (
    <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink2">
      <PileChip label={t("battle.zone.discard")} cards={board.discard} player={player} resolve={resolve} sel={sel} setSel={setSel} onVisual={onVisual} />
      <PileChip label={t("battle.zone.lostzone")} cards={board.lostzone} player={player} resolve={resolve} sel={sel} setSel={setSel} onVisual={onVisual} />
    </div>
  );
  // Prize cards as a face-down grid (real board, owner's tcgmasters reference).
  // Your own prizes are click-to-take (reveal into hand); the opponent's are
  // just shown face-down. IP-safe: our own neutral tile, never an official back.
  const prizesRow = (
    <div className="mb-1.5">
      <p className="text-xs text-ink2">
        {t("battle.zone.prizes")} <span className="font-mono">{board.prizes.length}</span>
      </p>
      {board.prizes.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {board.prizes.map((c) =>
            isMe === true ? (
              <button
                key={c.iid}
                type="button"
                onClick={() => { if (act(() => useBattleStore.getState().takePrizeAt(player, c.iid))) note(t("battle.log.prize", { who: name })); }}
                aria-label={t("battle.prizes.take")}
                title={t("battle.prizes.take")}
                className="h-7 w-6 rounded-sm border border-blue/40 bg-blue/10 text-[9px] font-medium text-blue hover:bg-blue/20"
              >
                {t("battle.prizes.face")}
              </button>
            ) : (
              <span key={c.iid} className="h-7 w-6 rounded-sm border hairline bg-paper" aria-hidden="true" />
            ),
          )}
        </div>
      )}
    </div>
  );

  // Active sits nearest the centre: your half = active on TOP; opponent mirror =
  // active at the BOTTOM (facing yours across the stadium band).
  const body = mirror ? [prizesRow, piles, benchRow, activeRow] : [activeRow, benchRow, piles, prizesRow];

  return (
    <section className="rounded-card border hairline bg-surface p-3">
      {header}
      {body.map((node, i) => (
        <div key={i}>{node}</div>
      ))}
    </section>
  );
}

/** A labelled row of in-play units (active or bench). */
function FieldRow({
  label, front, units, empty, board, player, resolve, sel, setSel, onUnitAction, onVisual, act, t,
}: {
  label: string;
  front?: boolean;
  units: InPlay[];
  empty: string;
  board: PlayerBoard;
  player: PlayerId;
  resolve: Resolve;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  onUnitAction: (player: PlayerId, unitId: string, kind: UnitActionKind) => void;
  onVisual: (c: BattleCard) => void;
  act: (fn: () => void) => void;
  t: Tr;
}) {
  return (
    <div className={"mb-1.5 rounded-ctl " + (front ? "border border-blue/30 bg-blue/5 p-1.5" : "")}>
      <p className={"text-xs " + (front ? "font-medium text-blue" : "text-ink2")}>{label}</p>
      {units.length === 0 ? (
        <p className="mt-0.5 text-[11px] text-ink2">{empty}</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {units.map((u) => {
            const selected = sel?.scope === "unit" && sel.player === player && sel.unitId === u.uid;
            return (
              <UnitTile
                key={u.uid}
                unit={u}
                slot={unitSlotLabel(board, u.uid, t)}
                selected={selected}
                hasActive={board.active !== null}
                resolve={resolve}
                onSelect={() => setSel(selected ? null : { scope: "unit", player, unitId: u.uid })}
                onAction={(kind) => onUnitAction(player, u.uid, kind)}
                onSetDamage={(d) => act(() => useBattleStore.getState().setDamage(player, u.uid, d))}
                onToggleStatus={(cond) => act(() => useBattleStore.getState().toggleStatus(player, u.uid, cond))}
                onVisual={onVisual}
                t={t}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One in-play Pokémon unit: name + HP/damage + attached energy/tools + stage. */
function UnitTile({
  unit, slot, selected, hasActive, resolve, onSelect, onAction, onSetDamage, onToggleStatus, onVisual, t,
}: {
  unit: InPlay;
  slot: string;
  selected: boolean;
  hasActive: boolean;
  resolve: Resolve;
  onSelect: () => void;
  onAction: (kind: UnitActionKind) => void;
  onSetDamage: (damage: number) => void;
  onToggleStatus: (cond: SpecialCondition) => void;
  onVisual: (c: BattleCard) => void;
  t: Tr;
}) {
  const { name, accent, types, ability } = resolve(unit.card);
  const hp = unit.card.hp;
  const remaining = hp !== undefined ? hp - unit.damage : undefined;
  const ko = remaining !== undefined && remaining <= 0;
  const isActiveSlot = slot === t("battle.zone.active");
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={onSelect}
        style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
        className={
          "min-w-[7.5rem] max-w-48 rounded-ctl border hairline px-2 py-1 text-left hover:bg-paper " +
          (selected ? "ring-2 ring-blue " : "") +
          (ko ? "border-bad/60 " : "")
        }
        title={name}
      >
        <span className="flex items-center gap-1">
          {types.length > 0 && (
            <span className="flex shrink-0 items-center gap-0.5">
              {types.map((ty) => (
                <span key={ty} style={{ color: TYPE_COLORS[ty] ?? NEUTRAL_ACCENT }}>
                  <TypeIcon type={ty} />
                </span>
              ))}
            </span>
          )}
          <span className="truncate text-xs font-medium">{name}</span>
          {ability !== null && (
            <span className="shrink-0 rounded-full border border-pink/50 bg-pink/10 px-1 text-[9px] text-pink" title={ability}>
              {t("battle.unit.ability")}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-ink2">
          {hp !== undefined && (
            <span className={ko || unit.damage > 0 ? "font-mono text-bad" : "font-mono"}>
              {t("battle.unit.hp")} {Math.max(0, remaining ?? 0)}/{hp}
            </span>
          )}
          {unit.energy.length > 0 && <span className="font-mono">{t("battle.unit.energy")}{unit.energy.length}</span>}
          {unit.tools.length > 0 && <span className="font-mono">{t("battle.unit.tools")}{unit.tools.length}</span>}
          {unit.under.length > 0 && <span className="font-mono">{t("battle.unit.stage", { n: unit.under.length + 1 })}</span>}
        </span>
        {unit.status.length > 0 && (
          <span className="mt-0.5 flex flex-wrap gap-0.5">
            {unit.status.map((c) => (
              <span key={c} className="rounded-full border border-warn/50 bg-warn/10 px-1 text-[9px] text-warn">
                {t(`battle.cond.${c}`)}
              </span>
            ))}
          </span>
        )}
      </button>
      {selected && (
        <span className="mt-1 flex flex-wrap gap-0.5">
          <UnitBtn onClick={() => onVisual(unit.card)}>{t("battle.act.detail")}</UnitBtn>
          <UnitBtn onClick={() => onSetDamage(unit.damage + 10)}>{t("battle.unit.dmgPlus")}</UnitBtn>
          <UnitBtn onClick={() => onSetDamage(Math.max(0, unit.damage - 10))}>{t("battle.unit.dmgMinus")}</UnitBtn>
          {isActiveSlot ? null : !hasActive ? (
            <UnitBtn onClick={() => onAction("promote")}>{t("battle.unit.promote")}</UnitBtn>
          ) : (
            <UnitBtn onClick={() => onAction("retreat")}>{t("battle.unit.retreat")}</UnitBtn>
          )}
          <UnitBtn onClick={() => onAction("ko")} danger>{t("battle.unit.ko")}</UnitBtn>
          <UnitBtn onClick={() => onAction("scoop")}>{t("battle.unit.scoop")}</UnitBtn>
        </span>
      )}
      {selected && isActiveSlot && (
        <span className="mt-1 flex flex-wrap items-center gap-0.5">
          <span className="text-[10px] text-ink2">{t("battle.cond.label")}</span>
          {SPECIAL_CONDITIONS.map((c) => {
            const on = unit.status.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => onToggleStatus(c)}
                aria-pressed={on}
                className={
                  "rounded-ctl border px-1 text-[10px] " +
                  (on ? "border-warn bg-warn/10 text-warn" : "hairline text-ink2 hover:text-ink")
                }
              >
                {t(`battle.cond.${c}`)}
              </button>
            );
          })}
        </span>
      )}
    </span>
  );
}

function UnitBtn({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-ctl border px-1 text-[11px] " +
        (danger ? "border-bad/50 text-bad hover:bg-bad/5" : "hairline text-ink2 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared stadium band (場地牌區).

function StadiumBand({
  meBoard, oppBoard, meName, oppName, resolve, onVisual, t,
}: {
  meBoard: PlayerBoard;
  oppBoard: PlayerBoard;
  meName: string;
  oppName: string;
  resolve: Resolve;
  onVisual: (c: BattleCard) => void;
  t: Tr;
}) {
  const sides: Array<{ side: string; who: string; card: BattleCard | null }> = [
    { side: "opp", who: oppName, card: oppBoard.stadium },
    { side: "me", who: meName, card: meBoard.stadium },
  ];
  const any = meBoard.stadium !== null || oppBoard.stadium !== null;
  return (
    <section className="rounded-card border border-dashed hairline bg-paper px-3 py-2">
      <p className="text-center text-xs font-medium text-ink2">— {t("battle.zone.stadium")} —</p>
      {!any ? (
        <p className="mt-1 text-center text-[11px] text-ink2">{t("battle.stadiumEmpty")}</p>
      ) : (
        <div className="mt-1 flex flex-col items-center gap-1">
          {sides
            .filter((s) => s.card !== null)
            .map((s) => (
              <button
                key={s.side}
                type="button"
                onClick={() => s.card !== null && onVisual(s.card)}
                className="rounded-ctl border hairline bg-surface px-2 py-1 text-xs hover:bg-paper"
              >
                <span className="text-ink2">{s.who}:</span> {resolve(s.card as BattleCard).name}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Attack panel (P2): the Active Pokémon's real attacks vs the opponent's Active.

interface AttackOpt {
  idx: number;
  name: string;
  cost: string[];
  damage: number | string | undefined;
  canPay: boolean;
}

function AttackPanel({
  attacker, defender, attacks, abilities, canAttack, onAttack, t,
}: {
  attacker: string;
  defender: string | null;
  attacks: AttackOpt[];
  abilities: string[];
  canAttack: boolean;
  onAttack: (idx: number) => void;
  t: Tr;
}) {
  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <h3 className="text-sm font-medium">{t("battle.atk.title")}</h3>
      <p className="mt-1 text-xs text-ink2">
        {defender !== null ? t("battle.atk.vs", { atk: attacker, def: defender }) : t("battle.atk.noTargetHint")}
      </p>
      {abilities.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
          <span className="rounded-full border border-pink/50 bg-pink/10 px-1.5 py-0.5 text-[10px] text-pink">{t("battle.unit.ability")}</span>
          {abilities.map((a) => (
            <span key={a} className="font-medium">{a}</span>
          ))}
          <span className="text-[10px] text-ink2">· {t("battle.atk.abilityManual")}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {attacks.map((a) => {
          const ready = canAttack && a.canPay;
          return (
            <button
              key={a.idx}
              type="button"
              disabled={!ready}
              onClick={() => onAttack(a.idx)}
              className={
                "flex items-center gap-1 rounded-ctl border px-2 py-1 text-xs " +
                (ready ? "border-blue text-blue hover:bg-blue/10" : "hairline text-ink2 opacity-60")
              }
            >
              {a.cost.length > 0 && (
                <span className="flex items-center gap-0.5">
                  {a.cost.map((c, i) => (
                    <span key={i} style={{ color: TYPE_COLORS[c] ?? NEUTRAL_ACCENT }}>
                      <TypeIcon type={c} />
                    </span>
                  ))}
                </span>
              )}
              <span className="font-medium">{a.name}</span>
              {a.damage !== undefined && a.damage !== "" && <span className="font-mono">{a.damage}</span>}
              {!a.canPay && <span className="text-[10px] text-warn">{t("battle.atk.short")}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The current player's hand — type-correct play actions.

function HandRow({
  board, units, oppBench, oppHasActive, effectKind, searchSpec, resolveName, flags, resolve, sel, setSel, onPlay, autoKey, onVisual, t,
}: {
  board: PlayerBoard;
  units: InPlay[];
  oppBench: InPlay[];
  oppHasActive: boolean;
  effectKind: (c: BattleCard) => "gust" | "switch" | null;
  searchSpec: (c: BattleCard) => SearchSpec | null;
  resolveName: (c: BattleCard) => string;
  flags: HandFlags;
  resolve: Resolve;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  onPlay: (card: BattleCard, action: PlayAction) => void;
  autoKey: (c: BattleCard) => string;
  onVisual: (c: BattleCard) => void;
  t: Tr;
}) {
  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <p className="mb-1.5 text-xs text-ink2">
        {t("battle.zone.hand")} <span className="font-mono">{board.hand.length}</span> · {t("battle.handHint")}
      </p>
      {board.hand.length === 0 ? (
        <p className="text-[11px] text-ink2">{t("battle.handEmpty")}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {board.hand.map((c) => {
            const selected = sel?.scope === "hand" && sel.iid === c.iid;
            const { name, accent } = resolve(c);
            return (
              <span key={c.iid} className="inline-flex flex-col">
                <button
                  type="button"
                  onClick={() => setSel(selected ? null : { scope: "hand", iid: c.iid })}
                  style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
                  className={"max-w-48 truncate rounded-ctl border hairline px-2 py-1 text-left text-xs hover:bg-paper " + (selected ? "ring-2 ring-blue" : "")}
                  title={name}
                >
                  {name}
                </button>
                {selected && (
                  <HandActions card={c} board={board} units={units} oppBench={oppBench} oppHasActive={oppHasActive} effectKind={effectKind} searchSpec={searchSpec} resolveName={resolveName} flags={flags} resolve={resolve} onPlay={onPlay} autoKey={autoKey} onVisual={onVisual} t={t} />
                )}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The type-correct action toolbar for a selected hand card. */
function HandActions({
  card, board, units, oppBench, oppHasActive, effectKind, searchSpec, resolveName, flags, resolve, onPlay, autoKey, onVisual, t,
}: {
  card: BattleCard;
  board: PlayerBoard;
  units: InPlay[];
  oppBench: InPlay[];
  oppHasActive: boolean;
  effectKind: (c: BattleCard) => "gust" | "switch" | null;
  searchSpec: (c: BattleCard) => SearchSpec | null;
  resolveName: (c: BattleCard) => string;
  flags: HandFlags;
  resolve: Resolve;
  onPlay: (card: BattleCard, action: PlayAction) => void;
  autoKey: (c: BattleCard) => string;
  onVisual: (c: BattleCard) => void;
  t: Tr;
}) {
  const auto = AUTO_EFFECTS[autoKey(card)];
  const fx = effectKind(card); // a targeted engine effect (gust / switch), if any
  const search = card.kind === "item" && fx === null ? searchSpec(card) : null; // a modeled search Item
  const btn = "rounded-ctl border border-blue px-1.5 text-[11px] font-medium text-blue hover:bg-blue/10";
  const sub = "rounded-ctl border hairline px-1.5 text-[11px] text-ink2 hover:text-ink";
  const targets = units; // in-play units to attach/evolve onto
  const targetBtns = (type: "evolve" | "energy" | "tool", disabled?: boolean) =>
    targets.length === 0 ? (
      <span className="text-[11px] text-ink2">{t("battle.act.needTarget")}</span>
    ) : (
      targets.map((u) => (
        <button
          key={u.uid}
          type="button"
          disabled={disabled}
          onClick={() => onPlay(card, { type, unitId: u.uid })}
          className={btn + (disabled ? " opacity-40" : "")}
          title={resolve(u.card).name}
        >
          {unitSlotLabel(board, u.uid, t)}
        </button>
      ))
    );

  return (
    <span className="mt-1 flex flex-wrap items-center gap-0.5">
      <button type="button" onClick={() => onVisual(card)} className={sub}>{t("battle.act.detail")}</button>
      {card.kind === "basic" && (
        <>
          <button type="button" onClick={() => onPlay(card, { type: "toActive" })} className={btn}>{t("battle.act.toActive")}</button>
          <button type="button" onClick={() => onPlay(card, { type: "toBench" })} className={btn}>{t("battle.act.toBench")}</button>
        </>
      )}
      {card.kind === "evolution" && (
        <>
          <span className="text-[11px] text-ink2">{t("battle.act.evolve")}→</span>
          {targetBtns("evolve")}
        </>
      )}
      {(card.kind === "energy-basic" || card.kind === "energy-special") && (
        <>
          <span className="text-[11px] text-ink2">{t("battle.act.attachEnergy")}→</span>
          {targetBtns("energy", flags.energyUsed)}
          {flags.energyUsed && <span className="text-[11px] text-warn">{t("battle.gate.energyUsed")}</span>}
        </>
      )}
      {card.kind === "tool" && (
        <>
          <span className="text-[11px] text-ink2">{t("battle.act.attachTool")}→</span>
          {targetBtns("tool")}
        </>
      )}
      {card.kind === "stadium" && (
        <button type="button" onClick={() => onPlay(card, { type: "stadium" })} className={btn}>{t("battle.act.playStadium")}</button>
      )}
      {card.kind === "supporter" && fx === "gust" && (
        <>
          {/* Boss's Orders — choose which opponent Bench Pokémon to drag up (engine). */}
          <span className="text-[11px] text-ink2">{t("battle.act.gust")}→</span>
          {oppHasActive && oppBench.length > 0 ? (
            oppBench.map((u) => (
              <button key={u.uid} type="button" onClick={() => onPlay(card, { type: "gust", targetUid: u.uid })} className={btn} title={resolve(u.card).name}>
                {resolve(u.card).name}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-ink2">{t("battle.act.needTarget")}</span>
          )}
        </>
      )}
      {card.kind === "supporter" && fx !== "gust" && (
        <button
          type="button"
          onClick={() => onPlay(card, { type: "supporter" })}
          className={btn}
          title={auto !== undefined ? t(auto.summaryKey) : t("battle.act.supporterManual")}
        >
          {t("battle.act.useSupporter")}
        </button>
      )}
      {card.kind === "item" && fx === "switch" && (
        <>
          {/* Switch — choose which of your own Bench Pokémon to swap in (engine). */}
          <span className="text-[11px] text-ink2">{t("battle.act.switch")}→</span>
          {board.active !== null && board.bench.length > 0 ? (
            board.bench.map((u) => (
              <button key={u.uid} type="button" onClick={() => onPlay(card, { type: "switch", benchUid: u.uid })} className={btn} title={resolve(u.card).name}>
                {resolve(u.card).name}
              </button>
            ))
          ) : (
            <span className="text-[11px] text-ink2">{t("battle.act.needTarget")}</span>
          )}
        </>
      )}
      {card.kind === "item" && fx !== "switch" && search !== null && (
        <>
          {/* Search Item — choose which eligible card to pull from the pile (engine). */}
          <span className="text-[11px] text-ink2">{t(search.from === "deck" ? "battle.act.searchDeck" : "battle.act.searchDiscard")}→</span>
          {(() => {
            const seen = new Set<string>();
            const picks = board[search.from].filter(search.eligible).filter((c) => {
              const n = resolveName(c);
              if (seen.has(n)) return false; // dedupe by name — any instance is equivalent
              seen.add(n);
              return true;
            });
            if (picks.length === 0) return <span className="text-[11px] text-ink2">{t("battle.act.searchNone")}</span>;
            return (
              <span className="flex max-h-24 flex-wrap gap-0.5 overflow-y-auto">
                {picks.map((c) => (
                  <button key={c.iid} type="button" onClick={() => onPlay(card, { type: "search", foundIid: c.iid })} className={btn} title={resolveName(c)}>
                    {resolveName(c)}
                  </button>
                ))}
              </span>
            );
          })()}
        </>
      )}
      {card.kind === "item" && fx !== "switch" && search === null && (
        <button type="button" onClick={() => onPlay(card, { type: "item" })} className={btn}>{t("battle.act.useItem")}</button>
      )}
      {/* Always-available manual escape hatch (honest sandbox). */}
      <button type="button" onClick={() => onPlay(card, { type: "discard" })} className={sub}>{t("battle.act.discard")}</button>
      <button type="button" onClick={() => onPlay(card, { type: "toPile", pile: "deck" })} className={sub}>{t("battle.act.toDeck")}</button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// State inspector — the engine's RL Observation (what a learning agent sees).
// Mirrors the reference sim's "Observation" panel; the opponent's hand is a
// COUNT only (public info), and the feature vector is encodeObservation().

function ObservationPanel({ obs, t }: { obs: Observation; t: Tr }) {
  const vec = encodeObservation(obs);
  const a = (s: SideView) =>
    s.active
      ? `${s.active.name} (${s.active.damage}/${s.active.hp ?? "?"}, E${s.active.energy}${s.active.status.length > 0 ? " " + s.active.status.join(",") : ""})`
      : "—";
  const row = (label: string, s: SideView) => (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      <span className="w-10 font-medium text-ink">{label}</span>
      <span>{t("battle.obs.hand")} {s.handCount}</span>
      <span>{t("battle.obs.deck")} {s.deckCount}</span>
      <span>{t("battle.obs.discard")} {s.discardCount}</span>
      <span>{t("battle.obs.prizes")} {s.prizesLeft}</span>
      <span>{t("battle.obs.bench")} {s.benchCount}</span>
      <span>{t("battle.obs.active")} {a(s)}</span>
    </div>
  );
  return (
    <details className="rounded-ctl border hairline bg-paper px-3 py-2 text-[11px] text-ink2">
      <summary className="cursor-pointer text-xs font-medium text-ink2">
        {t("battle.obs.title")} <span className="text-ink2">· {t("battle.obs.pov")} {obs.pov.toUpperCase()}</span>
      </summary>
      <div className="mt-1 space-y-1 font-mono">
        <div>{t("battle.obs.turn")} {obs.turn} · {t("battle.obs.toMove")} {obs.toMove.toUpperCase()}</div>
        {row(t("battle.obs.me"), obs.me)}
        {row(t("battle.obs.opp"), obs.opp)}
        <details>
          <summary className="cursor-pointer">{t("battle.obs.vector")} <span className="text-ink2">[{vec.length}]</span></summary>
          <code className="mt-0.5 block break-all">[{vec.join(", ")}]</code>
        </details>
      </div>
      <p className="mt-1 text-[10px] text-ink2">{t("battle.obs.note")}</p>
    </details>
  );
}

// ---------------------------------------------------------------------------

function PileChip({
  label, cards, player, resolve, sel, setSel, onVisual,
}: {
  label: string;
  cards: BattleCard[];
  player: PlayerId;
  resolve: Resolve;
  sel: Sel | null;
  setSel: (s: Sel | null) => void;
  onVisual: (c: BattleCard) => void;
}) {
  const open = sel?.scope === "pile" && sel.player === player && cards.some((c) => c.iid === sel.iid);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => {
          const first = cards[0];
          if (first === undefined) return;
          setSel(open ? null : { scope: "pile", player, iid: first.iid });
        }}
        className="rounded-ctl border hairline px-1.5 py-0.5 hover:text-ink"
      >
        {label} <span className="font-mono">{cards.length}</span>
      </button>
      {open && cards.length > 0 && (
        <span className="mt-1 flex max-w-[16rem] flex-wrap gap-0.5">
          {cards.map((c) => (
            <button
              key={c.iid}
              type="button"
              onClick={() => onVisual(c)}
              className="max-w-32 truncate rounded-ctl border hairline px-1 text-[11px] text-ink2 hover:text-ink"
              title={resolve(c).name}
            >
              {resolve(c).name}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Live exact draw-odds HUD (reads board.deck — uniformly shuffled, top draws).

function DrawHud({ board, resolve, t }: { board: PlayerBoard; resolve: Resolve; t: Tr }) {
  const [draws, setDraws] = useState(1);
  const [target, setTarget] = useState<string>("__basic__");

  const groups = useMemo(() => {
    const m = new Map<string, { count: number; label: string }>();
    for (const c of board.deck) {
      const g = m.get(c.name);
      if (g) g.count += 1;
      else m.set(c.name, { count: 1, label: resolve(c).name });
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [board.deck, resolve]);

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
    interpret: t("battle.hud.interp", { target: targetLabel, k: odds.targetCount, n: odds.draws, pct: odds.percent, oneIn: odds.oneIn }),
  };

  return (
    <section className="rounded-card border hairline bg-surface p-3">
      <h3 className="text-sm font-medium">{t("battle.hud.title")}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <span className="text-ink2">{t("battle.hud.target")}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 max-w-52 rounded-ctl border hairline bg-surface px-2 text-sm">
            <option value="__basic__">{t("battle.anyBasic")}({basics})</option>
            {groups.map(([nm, g]) => (
              <option key={nm} value={nm}>{g.label} ×{g.count}</option>
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
      <p className="mt-1 font-mono text-xs text-ink2">{odds.fraction} · {odds.oneIn} · {t("battle.hud.deckLeft", { n: deckSize })}</p>
      <p className="mt-1 text-[11px] text-ink2">{t("battle.hud.shuffleNote")}</p>
    </section>
  );
}

function BattleCardVisual({ card, catalog, onClose }: { card: BattleCard; catalog: Catalog; onClose: () => void }) {
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
