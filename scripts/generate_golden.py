#!/usr/bin/env python3
"""
Golden vector generator — PTCG Probability Lab
================================================
Independent reference implementation using Python's exact `fractions.Fraction`.

Purpose: every probability the TypeScript core (`src/lib/prob`) can compute
must match these vectors EXACTLY (string-equal reduced fractions).
Two independent implementations agreeing on exact rationals = correctness proof.

Run:  python3 scripts/generate_golden.py
Out:  tests/golden/golden_vectors.json

Model (official PTCG setup):
  - Deck N = 60 cards, opening hand H = 7, prizes P = 6 (taken AFTER the hand).
  - Mulligan: if the 7-card hand contains no Basic Pokémon, reshuffle & redraw
    until it does. The final hand is therefore distributed as
    Hypergeometric( · | at least 1 Basic).
"""

from fractions import Fraction as F
from math import comb
import json
import os
import sys

N, H, PRIZE = 60, 7, 6

# ---------------------------------------------------------------- helpers


def fs(x: F) -> str:
    """Reduced fraction as 'numerator/denominator'."""
    return f"{x.numerator}/{x.denominator}"


def dec(x: F, places: int = 15) -> str:
    """Decimal string, round-half-up at `places` decimal places."""
    n, d = x.numerator, x.denominator
    neg = n < 0
    n = abs(n)
    scale = 10 ** places
    q, r = divmod(n * scale, d)
    if 2 * r >= d:
        q += 1
    s = str(q).rjust(places + 1, "0")
    out = s[:-places] + "." + s[-places:]
    return ("-" if neg else "") + out


def pct(x: F, places: int = 6) -> str:
    return dec(x * 100, places) + "%"


def hpmf(Ntot: int, K: int, n: int, k: int) -> F:
    """Univariate hypergeometric pmf: P(X = k), K successes in Ntot, draw n."""
    if k < 0 or k > n or k > K or (n - k) > (Ntot - K):
        return F(0)
    return F(comb(K, k) * comb(Ntot - K, n - k), comb(Ntot, n))


def compositions(maxes, total):
    """All tuples ks with 0 <= ks[i] <= maxes[i] and sum(ks) <= total."""
    out = []

    def rec(i, remaining, acc):
        if i == len(maxes):
            out.append(tuple(acc))
            return
        for k in range(0, min(maxes[i], remaining) + 1):
            acc.append(k)
            rec(i + 1, remaining - k, acc)
            acc.pop()

    rec(0, total, [])
    return out


def joint_pmf(counts, ks, Ntot, n) -> F:
    """Multivariate hypergeometric pmf with an implicit 'other' category."""
    other = Ntot - sum(counts)
    rest = n - sum(ks)
    if rest < 0 or rest > other:
        return F(0)
    num = 1
    for c, k in zip(counts, ks):
        if k > c or k < 0:
            return F(0)
        num *= comb(c, k)
    num *= comb(other, rest)
    return F(num, comb(Ntot, n))


def in_range(ks, cons) -> bool:
    return all(lo <= k <= hi for k, (lo, hi) in zip(ks, cons))


# ---------------------------------------------------------------- Q1: opening basics


def opening_basics(B: int):
    dist = [hpmf(N, B, H, k) for k in range(H + 1)]
    assert sum(dist) == 1, "pmf must sum to exactly 1"
    mull = dist[0]
    valid = 1 - mull
    conditional = [F(0)] + [d / valid for d in dist[1:]]
    assert sum(conditional) == 1
    expected_mulligans = mull / valid  # geometric: E[M] = q/(1-q)
    expected_basics = F(H * B, N)      # linearity (unconditional)
    return {
        "dist": [fs(d) for d in dist],
        "dist_dec": [dec(d) for d in dist],
        "mulligan": fs(mull),
        "mulligan_dec": dec(mull),
        "valid": fs(valid),
        "conditional_dist": [fs(d) for d in conditional],
        "expected_mulligans": fs(expected_mulligans),
        "expected_mulligans_dec": dec(expected_mulligans),
        "expected_basics_unconditional": fs(expected_basics),
    }


# ---------------------------------------------------------------- Q2: opening combos


def combo_event(counts, cons):
    """P(constraints satisfied) in the opening hand, unconditioned."""
    tot = F(0)
    table = {}
    for ks in compositions([min(c, H) for c in counts], H):
        p = joint_pmf(counts, ks, N, H)
        if p == 0:
            continue
        table[ks] = p
        if in_range(ks, cons):
            tot += p
    assert sum(table.values()) == 1
    return tot, table


def combo_event_valid(counts, basic_flags, other_basics, cons):
    """P(constraints | hand contains >=1 Basic). 'other_basics' are Basics
    in the deck outside the tracked cards."""
    cats = list(counts) + [other_basics]
    p_event_and_valid = F(0)
    p_valid = F(0)
    for ks in compositions([min(c, H) for c in cats], H):
        p = joint_pmf(cats, ks, N, H)
        if p == 0:
            continue
        basics_in_hand = sum(k for k, f in zip(ks[:-1], basic_flags) if f) + ks[-1]
        if basics_in_hand >= 1:
            p_valid += p
            if in_range(ks[:-1], cons):
                p_event_and_valid += p
    # independent check of P(valid)
    B_total = sum(c for c, f in zip(counts, basic_flags) if f) + other_basics
    assert p_valid == 1 - hpmf(N, B_total, H, 0), "validity prob cross-check"
    return p_event_and_valid / p_valid, p_valid


# ---------------------------------------------------------------- Q3: prizes


def prize_uncond(x: int):
    """Marginal prize distribution with no information (exchangeability:
    the 6 prizes are a uniform 6-subset of all 60 cards)."""
    dist = [hpmf(N, x, PRIZE, k) for k in range(min(x, PRIZE) + 1)]
    assert sum(dist) == 1
    return dist


def prize_given_hand(x: int, h: int):
    """P(k of card X prized | exactly h copies of X in the kept hand).
    Prizes are 6 uniformly from the remaining 53."""
    rem = x - h
    M = N - H
    dist = [hpmf(M, rem, PRIZE, k) for k in range(min(rem, PRIZE) + 1)]
    assert sum(dist) == 1
    return dist


def prize_pregame(x: int, x_is_basic: bool, other_basics: int, condition_valid: bool):
    """Pre-game marginal prize distribution of card X, optionally conditioned
    on the kept hand being valid (>=1 Basic). Sums over hand compositions."""
    dist = [F(0)] * (min(x, PRIZE) + 1)
    p_cond = F(0)
    M = N - H
    for hX in range(0, min(x, H) + 1):
        for hB in range(0, min(other_basics, H - hX) + 1):
            ph = joint_pmf([x, other_basics], (hX, hB), N, H)
            if ph == 0:
                continue
            basics = (hX if x_is_basic else 0) + hB
            if condition_valid and basics < 1:
                continue
            p_cond += ph
            remX = x - hX
            for k in range(0, min(remX, PRIZE) + 1):
                dist[k] += ph * hpmf(M, remX, PRIZE, k)
    if condition_valid:
        dist = [d / p_cond for d in dist]
    assert sum(dist) == 1
    return dist, p_cond


def prize_joint_given_hand(cards, cons):
    """cards: list of (total_in_deck, in_hand). Joint prize distribution over
    the tracked cards, given the kept hand. Returns (event prob, full table)."""
    rem = [c - h for c, h in cards]
    M = N - H
    tot = F(0)
    table = {}
    for ks in compositions([min(r, PRIZE) for r in rem], PRIZE):
        p = joint_pmf(rem, ks, M, PRIZE)
        if p == 0:
            continue
        table[ks] = p
        if in_range(ks, cons):
            tot += p
    assert sum(table.values()) == 1
    return tot, table


# ---------------------------------------------------------------- turn curve


def seen_at_least_one(x: int, n_seen: int) -> F:
    return 1 - hpmf(N, x, n_seen, 0) / 1  # = 1 - C(N-x, n)/C(N, n)


# ---------------------------------------------------------------- build cases


def main():
    cases = []

    # ---- Q1 -------------------------------------------------------------
    for B in [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20]:
        r = opening_basics(B)
        cases.append({
            "id": f"opening_basics_B{B}",
            "kind": "opening_basics",
            "params": {"N": N, "H": H, "basics": B},
            "expect": r,
        })

    # ---- Q2 -------------------------------------------------------------
    ev, table = combo_event([4, 4], [(1, 7), (1, 7)])
    cases.append({
        "id": "combo_A4_B4_atleast1_each",
        "kind": "combo_event",
        "params": {"N": N, "H": H, "counts": [4, 4],
                   "constraints": [[1, 7], [1, 7]]},
        "expect": {"event": fs(ev), "event_dec": dec(ev),
                   "cell_1_1": fs(table[(1, 1)])},
    })

    ev, table = combo_event([4, 3, 2], [(1, 7), (1, 7), (1, 7)])
    cases.append({
        "id": "combo_A4_B3_C2_atleast1_each",
        "kind": "combo_event",
        "params": {"N": N, "H": H, "counts": [4, 3, 2],
                   "constraints": [[1, 7], [1, 7], [1, 7]]},
        "expect": {"event": fs(ev), "event_dec": dec(ev),
                   "cell_1_1_1": fs(table[(1, 1, 1)]),
                   "cell_2_1_1": fs(table[(2, 1, 1)])},
    })

    ev, _ = combo_event([4], [(2, 2)])
    cases.append({
        "id": "combo_exactly2_of_4",
        "kind": "combo_event",
        "params": {"N": N, "H": H, "counts": [4], "constraints": [[2, 2]]},
        "expect": {"event": fs(ev), "event_dec": dec(ev)},
    })

    ev_c, p_valid = combo_event_valid([4, 3], [True, False], 6, [(1, 7), (1, 7)])
    cases.append({
        "id": "combo_valid_A4basic_B3_ob6_atleast1_each",
        "kind": "combo_event_valid",
        "params": {"N": N, "H": H, "counts": [4, 3],
                   "basic_flags": [True, False], "other_basics": 6,
                   "constraints": [[1, 7], [1, 7]]},
        "expect": {"event_given_valid": fs(ev_c),
                   "event_given_valid_dec": dec(ev_c),
                   "p_valid": fs(p_valid)},
    })

    # ---- Q3 -------------------------------------------------------------
    d = prize_uncond(4)
    at_least_1 = 1 - d[0]
    cases.append({
        "id": "prize_uncond_x4",
        "kind": "prize_uncond",
        "params": {"N": N, "P": PRIZE, "x": 4},
        "expect": {"dist": [fs(v) for v in d],
                   "dist_dec": [dec(v) for v in d],
                   "at_least_1": fs(at_least_1),
                   "at_least_1_dec": dec(at_least_1)},
    })

    for x in [1, 2, 3]:
        d = prize_uncond(x)
        cases.append({
            "id": f"prize_uncond_x{x}",
            "kind": "prize_uncond",
            "params": {"N": N, "P": PRIZE, "x": x},
            "expect": {"dist": [fs(v) for v in d],
                       "at_least_1": fs(1 - d[0])},
        })

    d = prize_given_hand(4, 1)
    cases.append({
        "id": "prize_given_hand_x4_h1",
        "kind": "prize_given_hand",
        "params": {"N": N, "H": H, "P": PRIZE, "x": 4, "in_hand": 1},
        "expect": {"dist": [fs(v) for v in d],
                   "dist_dec": [dec(v) for v in d],
                   "at_least_1": fs(1 - d[0])},
    })

    d = prize_given_hand(4, 0)
    cases.append({
        "id": "prize_given_hand_x4_h0",
        "kind": "prize_given_hand",
        "params": {"N": N, "H": H, "P": PRIZE, "x": 4, "in_hand": 0},
        "expect": {"dist": [fs(v) for v in d],
                   "at_least_1": fs(1 - d[0]),
                   "at_least_1_dec": dec(1 - d[0])},
    })

    # exchangeability identity: unconditioned pre-game == direct C(x,k)C(60-x,6-k)/C(60,6)
    d_pre, _ = prize_pregame(4, True, 6, condition_valid=False)
    d_direct = prize_uncond(4)
    assert d_pre == d_direct, "exchangeability identity failed"

    d_valid, p_valid = prize_pregame(4, True, 6, condition_valid=True)
    e_valid = sum(k * v for k, v in enumerate(d_valid))
    cases.append({
        "id": "prize_pregame_valid_x4basic_ob6",
        "kind": "prize_pregame_valid",
        "params": {"N": N, "H": H, "P": PRIZE, "x": 4,
                   "x_is_basic": True, "other_basics": 6},
        "expect": {"dist": [fs(v) for v in d_valid],
                   "dist_dec": [dec(v) for v in d_valid],
                   "expected_prized": fs(e_valid),
                   "expected_prized_dec": dec(e_valid),
                   "p_valid": fs(p_valid),
                   "at_least_1": fs(1 - d_valid[0]),
                   "at_least_1_dec": dec(1 - d_valid[0])},
    })

    # non-basic card, mulligan-aware (conditioning still shifts it slightly via hand size interaction? -> it should NOT shift a non-basic? It does, slightly, because valid hands contain >=1 basic, leaving fewer non-tracked slots) — keep as a vector.
    d_valid_nb, _ = prize_pregame(4, False, 10, condition_valid=True)
    cases.append({
        "id": "prize_pregame_valid_x4nonbasic_ob10",
        "kind": "prize_pregame_valid",
        "params": {"N": N, "H": H, "P": PRIZE, "x": 4,
                   "x_is_basic": False, "other_basics": 10},
        "expect": {"dist": [fs(v) for v in d_valid_nb],
                   "expected_prized": fs(sum(k * v for k, v in enumerate(d_valid_nb)))},
    })

    ev, table = prize_joint_given_hand([(4, 1), (3, 0)], [(1, 6), (1, 6)])
    cases.append({
        "id": "prize_joint_given_hand_A4h1_B3h0_atleast1_each",
        "kind": "prize_joint_given_hand",
        "params": {"N": N, "H": H, "P": PRIZE,
                   "cards": [[4, 1], [3, 0]],
                   "constraints": [[1, 6], [1, 6]]},
        "expect": {"event": fs(ev), "event_dec": dec(ev),
                   "cell_1_1": fs(table[(1, 1)]),
                   "cell_0_0": fs(table[(0, 0)])},
    })

    # ---- turn curve ------------------------------------------------------
    tc = {str(n): fs(seen_at_least_one(4, n)) for n in range(7, 14)}
    cases.append({
        "id": "turncurve_x4_seen7to13",
        "kind": "turn_curve",
        "params": {"N": N, "x": 4, "n_seen": list(range(7, 14))},
        "expect": {"at_least_1_by_n": tc},
    })

    out = {
        "meta": {
            "generator": "python3 fractions (independent reference)",
            "model": "PTCG: N=60, hand=7, prizes=6 after hand; mulligan = redraw until >=1 Basic",
            "format": "all probabilities are exact reduced fractions 'n/d'; *_dec are round-half-up decimals",
        },
        "deck": {"N": N, "hand": H, "prizes": PRIZE},
        "cases": cases,
    }

    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "..", "tests", "golden", "golden_vectors.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f"wrote {os.path.normpath(path)}  ({len(cases)} cases)")

    # ---- human-readable anchors for docs --------------------------------
    print("\n=== anchor numbers (for docs) ===")
    print(f"C(60,7) = {comb(60,7):,}   C(60,6) = {comb(60,6):,}   C(53,6) = {comb(53,6):,}")
    for B in (8, 10, 12):
        r = opening_basics(B)
        print(f"B={B}: mulligan = {r['mulligan']} = {pct(F(*map(int, r['mulligan'].split('/'))))}"
              f"   E[mulligans] = {r['expected_mulligans_dec'][:8]}")
    ev, _ = combo_event([4, 4], [(1, 7), (1, 7)])
    print(f"combo 4&4 >=1 each: {fs(ev)} = {pct(ev)}")
    ev, _ = combo_event([4, 3, 2], [(1, 7)] * 3)
    print(f"combo 4&3&2 >=1 each: {fs(ev)} = {pct(ev)}")
    d = prize_uncond(4)
    print(f"x=4 uncond P(>=1 prized) = {fs(1-d[0])} = {pct(1-d[0])}")
    d = prize_given_hand(4, 0)
    print(f"x=4 | h=0 P(>=1 prized) = {fs(1-d[0])} = {pct(1-d[0])}")
    print(f"x=4 basic, ob=6, valid-cond: dist = {[dec(v,6) for v in d_valid]}")
    print(f"   E[prized | valid] = {dec(e_valid, 10)}  (uncond E = {dec(F(PRIZE*4, N), 10)})")
    ev_c, pv = combo_event_valid([4, 3], [True, False], 6, [(1, 7), (1, 7)])
    print(f"combo valid A4(basic)&B3, ob=6: {pct(ev_c)} (p_valid={pct(pv)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
