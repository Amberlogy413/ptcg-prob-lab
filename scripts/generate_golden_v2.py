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

assertion_count = sum(
    1 + 2 * len(c["expect"].get("by_n", {})) if c["kind"] == "energy_curve_valid" else 2
    for c in cases
)
print(f"golden v2: {len(cases)} cases, ~{assertion_count} assertions -> {os.path.relpath(path, os.path.join(here, '..'))}")
print("ALL V2 SELF-CHECKS PASS")
