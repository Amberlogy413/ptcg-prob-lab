/**
 * Tracker v2 (math audit 2026-06-12): the prizes-left posterior must follow
 * p = 6 − taken. The legacy hardcoded P=6 overestimated by +15.3pp in the
 * audit anchor below; math pinned by golden v2 kind `prize_posterior_p`.
 */

import { describe, it, expect } from "vitest";
import { computeTrackerRows } from "../src/state/q5.ts";

describe("computeTrackerRows v2", () => {
  it("audit anchor: u=20, ux=2, 2 prizes taken → 36.842105% (not 52.1%)", () => {
    // 60-card deck, one tracked 2-of never seen, 40 other cards seen
    // (including the 2 taken prizes counted as seen).
    const r = computeTrackerRows(
      [
        { name: "關鍵卡", count: 2, seen: 0 },
        { name: "其他", count: 58, seen: 40 },
      ],
      60,
      2,
    );
    expect(r).not.toBeNull();
    expect(r?.u).toBe(20);
    expect(r?.p).toBe(4);
    expect(r?.deckLeft).toBe(16);
    const row = r?.rows.find((x) => x.name === "關鍵卡");
    expect(row?.atLeastOnePercent).toBe("36.842105%");
    expect(row?.nextFraction).toBe("1/10"); // 2/20 — next library draw
    expect(row?.stillFraction).toBe("92/95"); // 1 − C(18,2)/C(20,4)-family pin
  });

  it("legacy default (no prizes taken) reproduces the old P=6 numbers", () => {
    const r = computeTrackerRows(
      [
        { name: "A", count: 4, seen: 1 },
        { name: "其他", count: 56, seen: 22 },
      ],
      60,
    );
    expect(r?.p).toBe(6);
    expect(r?.u).toBe(37);
  });

  it("late game below 6 unseen now computes instead of nulling", () => {
    // u=5 with 4 prizes taken (p=2) — the legacy u<6 guard wrongly bailed.
    const r = computeTrackerRows(
      [
        { name: "逆轉卡", count: 1, seen: 0 },
        { name: "其他", count: 59, seen: 55 },
      ],
      60,
      4,
    );
    expect(r).not.toBeNull();
    expect(r?.u).toBe(5);
    expect(r?.p).toBe(2);
    const row = r?.rows.find((x) => x.name === "逆轉卡");
    expect(row?.atLeastOneFraction).toBe("2/5"); // C(1,1)C(4,1)/C(5,2)=4/10
    expect(row?.nextFraction).toBe("1/5");
  });

  it("all prizes taken: nothing can be prized, everything unseen is in deck", () => {
    const r = computeTrackerRows(
      [
        { name: "尾刀", count: 2, seen: 0 },
        { name: "其他", count: 58, seen: 50 },
      ],
      60,
      6,
    );
    expect(r?.p).toBe(0);
    const row = r?.rows.find((x) => x.name === "尾刀");
    expect(row?.atLeastOneFraction).toBe("0/1");
    expect(row?.stillFraction).toBe("1/1");
    expect(row?.nextFraction).toBe("1/5"); // 2/10
  });
});
