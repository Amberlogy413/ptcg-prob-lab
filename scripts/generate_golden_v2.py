#!/usr/bin/env python3
"""Golden generator v2 — INDEPENDENT Python reference for math added after
the seed (docs/02 §6.4 energy shortfall curve, §10 luck tail).

The original seed pipeline (generate_golden.py / golden_vectors.json /
verify_seed.ts) is protected and untouched; this file extends the
dual-implementation guarantee for new question kinds only.

Run:  python3 scripts/generate_golden_v2.py
Out:  tests/golden/golden_vectors_v2.json
"""

from fractions import Fraction
from math import comb
import json
import os

# ---------------------------------------------------------------------------
# helpers (independent of the TS core, and of generate_golden.py)
# ---------------------------------------------------------------------------


def frac_str(f: Fraction) -> str:
    return f"{f.numerator}/{f.denominator}"


def dec15(f: Fraction) -> str:
    """15-place round-half-up (away from zero) decimal, character-exact."""
    places = 15
    n, d = abs(f.numerator), f.denominator
    scale = 10**places
    q, rem = divmod(n * scale, d)
    if rem * 2 >= d:
        q += 1
    s = str(q).rjust(places + 1, "0")
    out = f"{s[:-places]}.{s[-places:]}"
    return "-" + out if f < 0 and q != 0 else out


def hyper_at_most(N: int, K: int, n: int, w: int) -> Fraction:
    total = comb(N, n)
    acc = Fraction(0)
    for k in range(0, min(w, K, n) + 1):
        acc += Fraction(comb(K, k) * comb(N - K, n - k), total)
    return acc


# ---------------------------------------------------------------------------
# §6.4 — energy shortfall, conditioned on a valid opening hand
# ---------------------------------------------------------------------------


def energy_curve_valid(N: int, H: int, E: int, B: int, want: int, n_seen: int):
    """P(total energy seen < want | hand has >= 1 Basic), exact Fractions.

    Categories are disjoint: E energy, B Basics, R = N - E - B other.
    Hand: (e, b) over H cards; valid iff b >= 1. Then d = n_seen - H draws
    from the remaining N - H cards containing E - e energy.
    """
    assert E + B <= N and H <= N and n_seen >= H
    R = N - E - B
    total_hand = comb(N, H)
    M = N - H
    d = n_seen - H
    total_draw = comb(M, d)

    p_valid = Fraction(0)
    p_short_and_valid = Fraction(0)
    pmf_sum = Fraction(0)

    for e in range(0, min(E, H) + 1):
        for b in range(0, min(B, H - e) + 1):
            r = H - e - b
            if r < 0 or r > R:
                continue
            ph = Fraction(comb(E, e) * comb(B, b) * comb(R, r), total_hand)
            pmf_sum += ph
            if b < 1:
                continue
            p_valid += ph
            rem_e = E - e
            inner = Fraction(0)
            for j in range(0, min(rem_e, d) + 1):
                if e + j >= want:
                    continue
                inner += Fraction(comb(rem_e, j) * comb(M - rem_e, d - j), total_draw)
            p_short_and_valid += ph * inner

    assert pmf_sum == 1, "hand pmf must sum to 1"
    assert p_valid > 0, "deck must be able to produce a valid hand"

    # Exchangeability self-check: dropping the b >= 1 condition must reproduce
    # the single-category formula exactly.
    p_short_uncond = Fraction(0)
    for e in range(0, min(E, H) + 1):
        for b in range(0, min(B, H - e) + 1):
            r = H - e - b
            if r < 0 or r > R:
                continue
            ph = Fraction(comb(E, e) * comb(B, b) * comb(R, r), total_hand)
            rem_e = E - e
            inner = Fraction(0)
            for j in range(0, min(rem_e, d) + 1):
                if e + j >= want:
                    continue
                inner += Fraction(comb(rem_e, j) * comb(M - rem_e, d - j), total_draw)
            p_short_uncond += ph * inner
    assert p_short_uncond == hyper_at_most(N, E, n_seen, want - 1), (
        f"exchangeability failed at N={N} E={E} n={n_seen} w={want}"
    )

    return p_short_and_valid / p_valid, p_valid


# ---------------------------------------------------------------------------
# §10 — luck tail: (1 - p)^n
# ---------------------------------------------------------------------------


def luck_tail(p: Fraction, n: int) -> Fraction:
    return (1 - p) ** n


# ---------------------------------------------------------------------------
# cases
# ---------------------------------------------------------------------------

cases = []

ENERGY_CASES = [
    {"E": 10, "B": 10, "want": 1},
    {"E": 8, "B": 10, "want": 1},
    {"E": 12, "B": 8, "want": 2},
    {"E": 15, "B": 12, "want": 3},
    {"E": 10, "B": 6, "want": 1},
]
N, H = 60, 7
NS = [8, 9, 10, 11, 12, 13]

for spec in ENERGY_CASES:
    by_n = {}
    by_n_dec = {}
    p_valid_out = None
    prev = None
    for n in NS:
        p, p_valid = energy_curve_valid(N, H, spec["E"], spec["B"], spec["want"], n)
        if prev is not None:
            assert p <= prev, "shortfall must be monotone non-increasing in n"
        prev = p
        by_n[str(n)] = frac_str(p)
        by_n_dec[str(n)] = dec15(p)
        p_valid_out = p_valid
    cases.append(
        {
            "id": f"energy_valid_E{spec['E']}_B{spec['B']}_w{spec['want']}",
            "kind": "energy_curve_valid",
            "params": {"N": N, "H": H, "E": spec["E"], "B": spec["B"], "want": spec["want"], "n_seen": NS},
            "expect": {
                "p_valid": frac_str(p_valid_out),
                "by_n": by_n,
                "by_n_dec": by_n_dec,
            },
        }
    )

LUCK_CASES = [
    # p = going-second T1 sees a 4-of (docs/02 §6.2 anchor n=8), 5 misses in a row
    {"p": Fraction(43382, 97527), "n": 5, "label": "t1_4of_5misses"},
    # p = opening >= 1 of a 4-of (n=7 anchor), 10 misses in a row
    {"p": Fraction(38962, 97527), "n": 10, "label": "open_4of_10misses"},
    # p = mulligan rate at B=10, 3 mulligans in a row uses p directly: tail of NOT mulligan
    {"p": Fraction(216911, 292581), "n": 3, "label": "mull_B10_3row"},
]

for spec in LUCK_CASES:
    tail = luck_tail(spec["p"], spec["n"])
    cases.append(
        {
            "id": f"luck_tail_{spec['label']}",
            "kind": "luck_tail",
            "params": {"p": frac_str(spec["p"]), "n": spec["n"]},
            "expect": {"tail": frac_str(tail), "tail_dec": dec15(tail)},
        }
    )



# ---------------------------------------------------------------------------
# §6.5 — multi-turn relay event (A by n1 AND B by n2, nested windows)
# ---------------------------------------------------------------------------


def hyper_at_least(N: int, K: int, n: int, w: int) -> Fraction:
    if w <= 0:
        return Fraction(1)
    return 1 - hyper_at_most(N, K, n, w - 1)


def multi_hg(N: int, counts, n: int, ks) -> Fraction:
    rest = N - sum(counts)
    krest = n - sum(ks)
    if krest < 0 or krest > rest:
        return Fraction(0)
    num = 1
    for c, k in zip(counts, ks):
        if k < 0 or k > c:
            return Fraction(0)
        num *= comb(c, k)
    return Fraction(num * comb(rest, krest), comb(N, n))


def relay_event(N: int, cA: int, cB: int, wA: int, wB: int, n1: int, n2: int) -> Fraction:
    assert 0 <= n1 <= n2 <= N
    acc = Fraction(0)
    for a1 in range(wA, min(cA, n1) + 1):
        for b1 in range(0, min(cB, n1 - a1) + 1):
            ph = multi_hg(N, [cA, cB], n1, [a1, b1])
            if ph == 0:
                continue
            acc += ph * hyper_at_least(N - n1, cB - b1, n2 - n1, max(wB - b1, 0))
    return acc


RELAY_CASES = [
    {"cA": 4, "cB": 3, "wA": 1, "wB": 1, "n1": 8, "n2": 10},
    {"cA": 4, "cB": 4, "wA": 1, "wB": 1, "n1": 7, "n2": 9},
    {"cA": 4, "cB": 2, "wA": 2, "wB": 1, "n1": 9, "n2": 13},
    {"cA": 3, "cB": 3, "wA": 1, "wB": 2, "n1": 8, "n2": 12},
]

for spec in RELAY_CASES:
    N = 60
    p = relay_event(N, spec["cA"], spec["cB"], spec["wA"], spec["wB"], spec["n1"], spec["n2"])

    degen = relay_event(N, spec["cA"], spec["cB"], spec["wA"], 0, spec["n1"], spec["n2"])
    assert degen == hyper_at_least(N, spec["cA"], spec["n1"], spec["wA"]), "wB=0 degeneration failed"

    joint = Fraction(0)
    for a in range(spec["wA"], min(spec["cA"], spec["n1"]) + 1):
        for b in range(spec["wB"], min(spec["cB"], spec["n1"] - a) + 1):
            joint += multi_hg(N, [spec["cA"], spec["cB"]], spec["n1"], [a, b])
    assert relay_event(N, spec["cA"], spec["cB"], spec["wA"], spec["wB"], spec["n1"], spec["n1"]) == joint, (
        "single-window equivalence failed"
    )

    assert p <= hyper_at_least(N, spec["cA"], spec["n1"], spec["wA"])
    assert p <= hyper_at_least(N, spec["cB"], spec["n2"], spec["wB"])

    cases.append(
        {
            "id": "relay_A{cA}w{wA}n{n1}_B{cB}w{wB}n{n2}".format(**spec),
            "kind": "relay_event",
            "params": dict(N=N, **spec),
            "expect": {"p": frac_str(p), "p_dec": dec15(p)},
        }
    )

# ---------------------------------------------------------------------------
# §4.3 — search-chain fold (optimistic / conservative), mulligan-aware
# ---------------------------------------------------------------------------


def search_fold_valid(N, H, x, x_basic, s, ob, want):
    p_valid = Fraction(0)
    p_opt = Fraction(0)
    p_con = Fraction(0)
    p_opt_uncond = Fraction(0)
    for kx in range(0, min(x, H) + 1):
        for ks_ in range(0, min(s, H - kx) + 1):
            for j in range(0, min(ob, H - kx - ks_) + 1):
                ph = multi_hg(N, [x, s, ob], H, [kx, ks_, j])
                if ph == 0:
                    continue
                opt_hit = kx + ks_ >= want
                if opt_hit:
                    p_opt_uncond += ph
                basics = (kx if x_basic else 0) + j
                if basics < 1:
                    continue
                p_valid += ph
                if opt_hit:
                    p_opt += ph
                if kx >= want:
                    p_con += ph
    assert p_valid > 0
    assert p_opt_uncond == hyper_at_least(N, x + s, H, want), "fold identity failed"
    return p_opt / p_valid, p_con / p_valid, p_valid


FOLD_CASES = [
    {"x": 4, "x_basic": True, "s": 4, "ob": 6, "want": 1},
    {"x": 3, "x_basic": False, "s": 4, "ob": 10, "want": 1},
    {"x": 2, "x_basic": False, "s": 3, "ob": 12, "want": 1},
]

for spec in FOLD_CASES:
    N, H = 60, 7
    p_opt, p_con, p_valid = search_fold_valid(
        N, H, spec["x"], spec["x_basic"], spec["s"], spec["ob"], spec["want"]
    )
    assert p_con <= p_opt, "conservative must not exceed optimistic"
    fid = "fold_x{}{}_s{}_ob{}_w{}".format(
        spec["x"], "b" if spec["x_basic"] else "n", spec["s"], spec["ob"], spec["want"]
    )
    cases.append(
        {
            "id": fid,
            "kind": "search_fold_valid",
            "params": dict(N=N, H=H, **spec),
            "expect": {
                "optimistic": frac_str(p_opt),
                "optimistic_dec": dec15(p_opt),
                "conservative": frac_str(p_con),
                "conservative_dec": dec15(p_con),
                "p_valid": frac_str(p_valid),
            },
        }
    )

# ---------------------------------------------------------------------------
# §11 — optimizer enumeration (free slots over candidates, argmax)
# ---------------------------------------------------------------------------


def optimizer_cell(N, H, cands, ob, alloc):
    counts = [c["base"] + a for c, a in zip(cands, alloc)]
    p_valid = Fraction(0)
    p_hit = Fraction(0)

    def rec(i, ks):
        nonlocal p_valid, p_hit
        if i == len(counts):
            for j in range(0, min(ob, H - sum(ks)) + 1):
                ph = multi_hg(N, counts + [ob], H, ks + [j])
                if ph == 0:
                    continue
                basics = j + sum(k for k, c in zip(ks, cands) if c["basic"])
                if basics < 1:
                    continue
                p_valid += ph
                if all(k >= c["want"] for k, c in zip(ks, cands)):
                    p_hit += ph
            return
        for k in range(0, min(counts[i], H - sum(ks)) + 1):
            rec(i + 1, ks + [k])

    rec(0, [])
    assert p_valid > 0
    return p_hit / p_valid


OPT_CASE = {
    "N": 60,
    "H": 7,
    "free": 5,
    "ob": 6,
    "cands": [
        {"base": 2, "basic": True, "want": 1},
        {"base": 1, "basic": False, "want": 1},
    ],
}

allocs = {}
best_id, best_p = None, Fraction(-1)
for a in range(0, OPT_CASE["free"] + 1):
    for b in range(0, OPT_CASE["free"] - a + 1):
        p = optimizer_cell(OPT_CASE["N"], OPT_CASE["H"], OPT_CASE["cands"], OPT_CASE["ob"], [a, b])
        key = "{}_{}".format(a, b)
        allocs[key] = frac_str(p)
        if p > best_p:
            best_p, best_id = p, key
cases.append(
    {
        "id": "optimizer_A2b_B1n_free5_ob6",
        "kind": "optimizer_enum",
        "params": OPT_CASE,
        "expect": {"allocs": allocs, "best": best_id, "best_dec": dec15(best_p)},
    }
)


out = {
    "meta": {
        "generator": "python3 fractions (independent reference, v2 pipeline)",
        "scope": "docs/02 §6.4 energy shortfall (mulligan-aware) + §10 luck tail",
        "format": "exact reduced fractions 'n/d'; *_dec are 15-place round-half-up",
    },
    "cases": cases,
}

here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, "..", "tests", "golden", "golden_vectors_v2.json")
with open(path, "w", encoding="utf-8", newline="\n") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
    fh.write("\n")

assertion_count = sum(len(json.dumps(c["expect"]).split(":")) for c in cases)
print(f"golden v2: {len(cases)} cases, ~{assertion_count} assertions -> {os.path.relpath(path, os.path.join(here, '..'))}")
print("ALL V2 SELF-CHECKS PASS")
