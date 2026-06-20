/**
 * Public surface of the pure rules engine (#36 → AI agent step ①/②, owner
 * 2026-06-18). Framework-free and side-effect-free, like `src/lib/prob/`: a
 * headless, reproducible PTCG game model that a heuristic OR a learned policy can
 * drive identically. See docs/11_AI_AGENT.md for the full roadmap.
 */

export type {
  GameState,
  Action,
  ActionType,
  EngineCtx,
  BattleCard,
  InPlay,
  PlayerBoard,
  PlayerId,
  SpecialCondition,
  CardSpec,
} from "./types.ts";

export {
  newGame,
  legalActions,
  applyAction,
  makeCtx,
  gameResult,
  isTerminal,
  winner,
  reward,
  type GameResult,
} from "./game.ts";

export { COVERAGE, SUPPORTER_EFFECTS, isModeledSupporter, isGustEffect, isSwitchEffect, isEnergySwitchEffect, isEnergyRetrieveEffect, isRareCandyEffect, energyRetrieveCombos, searchSpecOf, handPayCombos, type SearchSpec } from "./cards.ts";

export {
  BattleEnv,
  observe,
  encodeObservation,
  type Observation,
  type SideView,
  type ActiveView,
  type StepResult,
} from "./env.ts";
