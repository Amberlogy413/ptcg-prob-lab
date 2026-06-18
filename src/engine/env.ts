/**
 * A Gym-style environment wrapper over the pure rules engine — the RL interface
 * the owner's reference simulator shows as the "Observation" + "Select action"
 * panels (owner 2026-06-18). This is AI roadmap step ② (docs/11_AI_AGENT.md):
 *
 *   const env = new BattleEnv(catalog);
 *   let obs = env.reset({ p1, p2, seed });
 *   while (!env.done) {
 *     const a = policy(obs, env.legalActions());   // ← your agent picks here
 *     obs = env.step(a);                            // advance one move
 *   }
 *
 * Honest scope: `observe()` is a BASELINE feature view (zone counts + the active
 * matchup), not a full information state — card-identity embeddings come with the
 * training pipeline. The engine itself is exact; only this projection is coarse.
 */

import { newGame, legalActions, applyAction, makeCtx, isTerminal, reward, winner } from "./game.ts";
import { units, other } from "./ops.ts";
import type { Action, CardSpec, EngineCtx, GameState, PlayerBoard, PlayerId } from "./types.ts";

/** A compact, human-readable POV summary (drives an inspector panel + an agent). */
export interface Observation {
  pov: PlayerId;
  turn: number;
  toMove: PlayerId;
  isMyTurn: boolean;
  /** My side. */
  me: SideView;
  /** Opponent side (only public information — hand is a COUNT, never contents). */
  opp: SideView;
}

export interface SideView {
  handCount: number;
  deckCount: number;
  discardCount: number;
  prizesLeft: number;
  benchCount: number;
  /** The Active matchup facts an agent reasons over. */
  active: ActiveView | null;
}

export interface ActiveView {
  name: string;
  hp: number | null;
  damage: number;
  energy: number;
  tools: number;
  status: string[];
}

function activeView(b: PlayerBoard): ActiveView | null {
  if (b.active === null) return null;
  return {
    name: b.active.card.name,
    hp: b.active.card.hp ?? null,
    damage: b.active.damage,
    energy: b.active.energy.length,
    tools: b.active.tools.length,
    status: [...b.active.status],
  };
}

function sideView(b: PlayerBoard): SideView {
  return {
    handCount: b.hand.length,
    deckCount: b.deck.length,
    discardCount: b.discard.length,
    prizesLeft: b.prizes.length,
    benchCount: b.bench.length,
    active: activeView(b),
  };
}

/** Project the full state to one player's observation. */
export function observe(s: GameState, pov: PlayerId): Observation {
  return {
    pov,
    turn: s.turn,
    toMove: s.current,
    isMyTurn: s.current === pov,
    me: sideView(s[pov]),
    opp: sideView(s[other(pov)]),
  };
}

/** Flatten an observation to a fixed-length numeric vector for a neural net. The
 *  layout is stable (see docs/11_AI_AGENT.md); identity features are future work. */
export function encodeObservation(o: Observation): number[] {
  const side = (s: SideView): number[] => [
    s.handCount,
    s.deckCount,
    s.discardCount,
    s.prizesLeft,
    s.benchCount,
    s.active ? 1 : 0,
    s.active?.hp ?? 0,
    s.active?.damage ?? 0,
    s.active?.energy ?? 0,
    s.active?.tools ?? 0,
    s.active?.status.length ?? 0,
  ];
  return [o.turn, o.isMyTurn ? 1 : 0, ...side(o.me), ...side(o.opp)];
}

/** The result of one `step()` — the Gym `(obs, reward, done, info)` tuple. */
export interface StepResult {
  observation: Observation;
  reward: number;
  done: boolean;
  legal: Action[];
}

/** Mutable, stateful wrapper around the pure engine — convenient for self-play
 *  loops. The pure functions remain the source of truth; this just holds `state`. */
export class BattleEnv {
  state: GameState;
  readonly ctx: EngineCtx;

  constructor(catalog: Parameters<typeof makeCtx>[0]) {
    this.ctx = makeCtx(catalog);
    // Placeholder until reset(); a real game always calls reset() first.
    this.state = newGame({ p1: [], p2: [], seed: 1 });
  }

  reset(input: { p1: CardSpec[]; p2: CardSpec[]; seed: number; first?: PlayerId }): Observation {
    this.state = newGame(input);
    return observe(this.state, this.state.current);
  }

  get done(): boolean {
    return isTerminal(this.state);
  }

  get toMove(): PlayerId {
    return this.state.current;
  }

  legalActions(): Action[] {
    return legalActions(this.state, this.ctx);
  }

  observation(pov: PlayerId = this.state.current): Observation {
    return observe(this.state, pov);
  }

  /** Advance one move; reward is from the POV of the player who just acted. */
  step(action: Action): StepResult {
    const actor = this.state.current;
    this.state = applyAction(this.state, action, this.ctx);
    const done = isTerminal(this.state);
    return {
      observation: observe(this.state, actor),
      reward: reward(this.state, actor),
      done,
      legal: done ? [] : legalActions(this.state, this.ctx),
    };
  }

  winner(): PlayerId | null {
    return winner(this.state);
  }

  /** A tiny board summary for a state inspector / debug log. */
  render(): string {
    const line = (p: PlayerId): string => {
      const b = this.state[p];
      const act = b.active ? `${b.active.card.name}(${b.active.damage}/${b.active.card.hp ?? "?"}, E${b.active.energy.length})` : "—";
      return `${p}: prizes ${b.prizes.length} | active ${act} | bench ${b.bench.length} | hand ${b.hand.length} | deck ${b.deck.length}`;
    };
    return `turn ${this.state.turn} (${this.state.current} to move)\n  ${line("p1")}\n  ${line("p2")}`;
  }
}

// Re-export so callers reason over in-play units if they want a richer view.
export { units };
