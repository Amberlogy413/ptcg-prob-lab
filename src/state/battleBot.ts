/**
 * Rule-based auto-player for the battle (owner request 2026-06-18: "開發 AI 對戰").
 *
 * HONESTY (the product's whole point): this is NOT a trained / machine-learned
 * agent — a client-only, zero-backend app cannot ship one, and we will never
 * pass off a heuristic as a learned model. It is a DETERMINISTIC, reproducible
 * heuristic opponent that plays a legal, simplified game through the SAME rules
 * engine the human uses: put down Basics, bench, evolve when the hand allows,
 * attach one Energy, play a known choice-free draw Supporter when low, then make
 * the highest-damage attack it can pay for (else end the turn). It never
 * fabricates a card effect — anything needing a search / target choice / coin
 * flip is simply skipped. Every action is reported as a log event so the whole
 * turn stays transparent and auditable.
 */

import { useBattleStore, type PlayerId, type BattleCard, type InPlay, type PlayerBoard } from "./battleStore.ts";
import { applyAutoEffect, AUTO_EFFECTS } from "./battleEffects.ts";
import { canPayCost, baseDamage, finalDamage, prizeValue, isVariableDamage, inflictedStatus, selfHealAmount, attackDrawCount, selfDamageAmount, locksAttackerNextTurn, locksDefenderNextTurn, discardEnergyCount, energyDiscardCombos, benchDamageAmount } from "./battleAttack.ts";
import { resolveDeckRow, type Catalog, type CatalogCard } from "../data/catalog.ts";

/** One localized log line, as an i18n key + params (the view does the t()). */
export interface BotEvent {
  key: string;
  params: Record<string, string | number>;
}

export interface BotCtx {
  /** The acting player's display name (for the log). */
  who: string;
  /** Resolve a battle card to its localized display name (for the log). */
  nameOf: (c: BattleCard) => string;
  /** Resolve a card to the canonical zh name used to key AUTO_EFFECTS. */
  autoKey: (c: BattleCard) => string;
  /** Called RIGHT AFTER each move applies, while the store holds that move's
   *  state — so the caller can log + snapshot a faithful per-move replay frame
   *  (without it, all of a turn's frames would capture the end-of-turn board). */
  onEvent?: (e: BotEvent) => void;
}

const MAX_BOT_BENCH = 3; // the bot keeps a modest bench, not a full 5

function unitsOf(b: PlayerBoard): InPlay[] {
  return b.active !== null ? [b.active, ...b.bench] : b.bench;
}

/**
 * Run one full deterministic bot turn for `player`, applying moves through the
 * store and returning the log events. The caller should wrap this in its undo
 * `act()` so the whole turn is one atomic, reversible step.
 */
export function runBotTurn(player: PlayerId, catalog: Catalog | null, ctx: BotCtx): BotEvent[] {
  const ev: BotEvent[] = [];
  const st = () => useBattleStore.getState();
  const opp: PlayerId = player === "p1" ? "p2" : "p1";
  const catOf = (c: BattleCard): CatalogCard | null =>
    catalog === null ? null : resolveDeckRow(catalog, { name: c.name, ...(c.catalogId !== undefined ? { catalogId: c.catalogId } : {}) });
  const push = (key: string, card?: BattleCard, extra: Record<string, string | number> = {}) => {
    const e: BotEvent = { key, params: { who: ctx.who, ...(card !== undefined ? { card: ctx.nameOf(card) } : {}), ...extra } };
    ev.push(e);
    ctx.onEvent?.(e); // fire NOW, while the store reflects this move (faithful replay frame)
  };

  // 1) Ensure an Active Pokémon — a Basic from hand, else promote a Benched one
  //    (so a self-KO'd bot recovers instead of stalling with an empty Active).
  if (st()[player].active === null) {
    const basic = st()[player].hand.find((c) => c.kind === "basic");
    if (basic !== undefined && st().playToActive(player, basic.iid)) push("battle.log.active", basic);
    else if (st()[player].bench.length > 0) {
      const benched = st()[player].bench[0];
      if (benched !== undefined && st().promote(player, benched.uid)) push("battle.log.promote", benched.card);
    }
  }

  // 2) Bench up to a modest number of Basics.
  while (st()[player].bench.length < MAX_BOT_BENCH) {
    const basic = st()[player].hand.find((c) => c.kind === "basic");
    if (basic === undefined || !st().playToBench(player, basic.iid)) break;
    push("battle.log.bench", basic);
  }

  // 3) Evolve any in-play unit the hand has a NAME-matching evolution for (safe:
  //    only when the evolution explicitly names this unit's current top card).
  for (const unit of unitsOf(st()[player])) {
    const evo = st()[player].hand.find(
      (c) => c.kind === "evolution" && c.evolveFrom !== undefined && c.evolveFrom !== "" && c.evolveFrom === unit.card.name,
    );
    if (evo !== undefined && st().evolve(player, evo.iid, unit.uid)) push("battle.log.evolve", evo);
  }

  // 4) Attach one Energy to the Active (the 1/turn rule).
  if (!st().turnEnergyAttached && st()[player].active !== null) {
    const energy = st()[player].hand.find((c) => c.kind === "energy-basic" || c.kind === "energy-special");
    if (energy !== undefined && st().attachEnergy(player, energy.iid, st()[player].active!.uid)) push("battle.log.energy", energy);
  }

  // 5) Play a known choice-free draw Supporter when the hand is low + allowed.
  {
    const s = st();
    const firstTurnBlock = s.turn === 1 && player === s.firstPlayer;
    if (!s.turnSupporterUsed && !firstTurnBlock && s[player].hand.length <= 4) {
      const sup = s[player].hand.find((c) => c.kind === "supporter" && AUTO_EFFECTS[ctx.autoKey(c)] !== undefined);
      if (sup !== undefined) {
        applyAutoEffect(player, sup.iid, ctx.autoKey(sup));
        useBattleStore.getState().markSupporterUsed();
        push("battle.log.supporter", sup);
      }
    }
  }

  // 6) Attack with the highest-damage payable attack, else end the turn.
  {
    const s = st();
    const active = s[player].active;
    const oppActive = s[opp].active;
    const atkBlock = (s.turn === 1 && player === s.firstPlayer) || (active !== null && active.noAttackTurn === s.turn);
    if (active !== null && oppActive !== null && !atkBlock) {
      const ac = catOf(active.card);
      const attacks = ac?.attacks ?? [];
      const payable = attacks
        .filter((a) => canPayCost(active.energy, a.cost))
        .sort((x, y) => baseDamage(y.damage) - baseDamage(x.damage));
      const best = payable[0];
      if (best !== undefined) {
        const oc = catOf(oppActive.card);
        const { damage } = finalDamage(ac, oc, baseDamage(best.damage));
        const newDamage = oppActive.damage + damage;
        st().setDamage(opp, oppActive.uid, newDamage);
        // Variable "+"/"×" damage is only the printed base — mark it ≈ (honest).
        push("battle.log.attack", undefined, { atk: best.name, dmg: isVariableDamage(best.damage) ? `≈${damage}` : damage });
        const hp = oppActive.card.hp;
        if (hp !== undefined && newDamage >= hp) {
          const prizes = prizeValue(oc);
          st().knockOut(opp, oppActive.uid);
          st().takePrize(player, prizes);
          push("battle.log.koTake", undefined, { n: prizes });
        } else {
          // Surviving defender: apply an unconditional attack-inflicted condition.
          const cond = inflictedStatus(best.effect);
          if (cond !== null && !oppActive.status.includes(cond)) {
            st().toggleStatus(opp, oppActive.uid, cond);
            push("battle.log.inflict", undefined, { cond });
          }
          // Defender-lock: the surviving defender can't attack on the opponent's next turn.
          if (locksDefenderNextTurn(best.effect, oc)) {
            st().markNoAttack(opp, oppActive.uid, s.turn + 1);
            push("battle.atk.defLock", undefined, { p: ctx.nameOf(oppActive.card) });
          }
        }
        // Unconditional attacker-only effects: self-heal / draw (never KO) + recoil
        // (can self-KO the attacker → the opponent takes the Prize).
        const heal = selfHealAmount(best.effect);
        if (heal > 0) {
          st().setDamage(player, active.uid, Math.max(0, active.damage - heal));
          push("battle.atk.selfHeal", undefined, { n: heal });
        }
        const draw = attackDrawCount(best.effect);
        if (draw > 0) {
          st().draw(player, draw);
          push("battle.atk.selfDraw", undefined, { n: draw });
        }
        const recoil = selfDamageAmount(best.effect);
        if (recoil > 0) {
          const selfNew = Math.max(0, active.damage - heal) + recoil;
          st().setDamage(player, active.uid, selfNew);
          push("battle.atk.selfDamage", undefined, { n: recoil });
          if (active.card.hp !== undefined && selfNew >= active.card.hp) {
            st().knockOut(player, active.uid);
            st().takePrize(opp, prizeValue(ac));
            push("battle.atk.selfKo");
          }
        }
        // Self-lock: barred from attacking on the bot's next turn (s.turn + 2).
        if (locksAttackerNextTurn(best.effect) && st()[player].active !== null) {
          st().markNoAttack(player, active.uid, s.turn + 2);
          push("battle.atk.selfLock");
        }
        // Energy discard: the bot picks the first valid combo (a heuristic choice).
        const dN = discardEnergyCount(best.effect);
        if (dN > 0 && st()[player].active !== null) {
          const combos = energyDiscardCombos(active.energy, dN);
          if (combos[0] !== undefined && combos[0].length > 0) {
            const names = combos[0].map((id) => active.energy.find((e) => e.iid === id)).filter((e): e is BattleCard => e !== undefined).map((e) => ctx.nameOf(e)).join("+");
            st().discardEnergy(player, active.uid, combos[0]);
            push("battle.atk.discardEnergy", undefined, { e: names });
          }
        }
        // Bench damage: the bot hits the opponent's first Benched Pokémon (heuristic).
        const bN = benchDamageAmount(best.effect);
        const benchTgt = bN > 0 ? st()[opp].bench[0] : undefined;
        if (benchTgt !== undefined) {
          const newD = benchTgt.damage + bN;
          st().setDamage(opp, benchTgt.uid, newD);
          push("battle.atk.benchHit", undefined, { p: ctx.nameOf(benchTgt.card), n: bN });
          if (benchTgt.card.hp !== undefined && newD >= benchTgt.card.hp) {
            st().knockOut(opp, benchTgt.uid);
            st().takePrize(player, prizeValue(catOf(benchTgt.card)));
            push("battle.atk.benchKo", undefined, { n: prizeValue(catOf(benchTgt.card)) });
          }
        }
      }
    }
  }

  // End the bot's turn (this auto-draws the incoming player per endTurn).
  st().endTurn();
  push("battle.log.endTurn");
  return ev;
}
