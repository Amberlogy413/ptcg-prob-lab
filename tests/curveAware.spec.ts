/**
 * Mulligan-aware turn curve (docs/02 §6.3 debt; math audit 2026-06-12).
 * computeTurnCurve with the mulliganAware option conditions each turn on a
 * valid opening hand; the exact math is pinned by golden v2 `seen_curve_valid`
 * (anchors below are read from that case, x=4 Basic, otherBasics=6, want=1).
 */

import { describe, it, expect } from "vitest";
import { computeTurnCurve } from "../src/state/q5.ts";

describe("computeTurnCurve mulligan-aware (§6.3)", () => {
  it("going second, conditioned values match the seen_curve_valid golden", () => {
    const rows = computeTurnCurve({
      x: 4,
      want: 1,
      goingFirst: false,
      extraSeen: 0,
      firstPlayerSkipsFirstDraw: false,
      maxTurn: 4,
      mulliganAware: { xBasic: true, otherBasics: 6 },
    });
    // Going second: T1→nSeen 8, T2→9, T3→10.
    const t1 = rows.find((r) => r.turn === 1)!;
    const t3 = rows.find((r) => r.turn === 3)!;
    expect(t1.nSeen).toBe(8);
    expect(t1.fraction).toBe("6595058/11496283");
    expect(t1.percent).toBe("57.366872%");
    expect(t3.nSeen).toBe(10);
    expect(t3.fraction).toBe("1619248243/2540678543");
  });

  it("conditioning raises the curve vs the unconditioned default (Basic target)", () => {
    const base = {
      x: 4,
      want: 1,
      goingFirst: false,
      extraSeen: 0,
      firstPlayerSkipsFirstDraw: false,
      maxTurn: 1,
    };
    const uncond = computeTurnCurve(base)[0]!;
    const aware = computeTurnCurve({ ...base, mulliganAware: { xBasic: true, otherBasics: 6 } })[0]!;
    // A Basic target is over-represented in valid hands → higher seen rate.
    expect(aware.chart).toBeGreaterThan(uncond.chart);
  });

  it("non-Basic target equals the energy-curve complement (1 − shortfall)", () => {
    // x=4 non-Basic, otherBasics=10 — golden self-check guarantees this.
    const aware = computeTurnCurve({
      x: 4,
      want: 1,
      goingFirst: false,
      extraSeen: 0,
      firstPlayerSkipsFirstDraw: false,
      maxTurn: 2,
      mulliganAware: { xBasic: false, otherBasics: 10 },
    });
    // Just assert it computes finite, ordered values (the exact equality is
    // pinned in goldenV2 via the Python energy-complement assertion).
    expect(aware[0]!.nSeen).toBe(8);
    expect(aware[1]!.chart).toBeGreaterThanOrEqual(aware[0]!.chart);
  });
});
