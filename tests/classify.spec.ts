/**
 * 寶可夢功能 classifier (owner request 2026-06-14): deterministic, precise
 * function + sub-category tags from the official zh card text. No guessing —
 * under-tag rather than mis-tag.
 */

import { describe, it, expect } from "vitest";
// Shared classifier used by both fetch_catalog.mjs and reclassify.mjs.
import { classify } from "../scripts/classify.mjs";

type Card = {
  category: string;
  effect?: string;
  attacks?: { effect?: string; damage?: number | string }[];
  abilities?: { effect?: string }[];
  fn?: string[];
  fnSub?: string[];
};

function tag(card: Card): Card {
  classify(card);
  return card;
}

describe("classify — function + sub-category", () => {
  it("Professor's-Research-style: refill + fixed draw", () => {
    const c = tag({ category: "Trainer", effect: "將自己的手牌全部丟棄，從牌庫抽出7張卡。" });
    expect(c.fn).toContain("draw");
    expect(c.fnSub).toContain("draw.refill");
    expect(c.fnSub).toContain("draw.fixed");
  });

  it("search a Pokémon to hand", () => {
    const c = tag({ category: "Trainer", effect: "從自己的牌庫選擇1隻寶可夢，加入手牌。然後重洗牌庫。" });
    expect(c.fn).toContain("search");
    expect(c.fnSub).toContain("search.pokemon");
  });

  it("energy acceleration from the discard pile", () => {
    const c = tag({
      category: "Pokemon",
      abilities: [{ effect: "從自己的棄牌區選擇1張基本能量卡，附加在這隻寶可夢身上。" }],
    });
    expect(c.fn).toContain("accel");
    expect(c.fnSub).toContain("accel.discard");
  });

  it("hand disruption is possessive (opponent's hand)", () => {
    const c = tag({ category: "Trainer", effect: "對手的手牌全部翻回反面並重洗，放回牌庫下方。" });
    expect(c.fn).toContain("disrupt");
    expect(c.fnSub).toContain("disrupt.hand");
  });

  it("does NOT tag disruption when you only look at your OWN cards", () => {
    const c = tag({ category: "Trainer", effect: "查看自己牌庫上方3張卡，給對手看過後放回牌庫。" });
    expect(c.fn ?? []).not.toContain("disrupt");
  });

  it("no function text → no fn/fnSub", () => {
    const c = tag({ category: "Pokemon", attacks: [{ effect: "", damage: 30 }] });
    expect(c.fn).toBeUndefined();
    expect(c.fnSub).toBeUndefined();
  });
});
