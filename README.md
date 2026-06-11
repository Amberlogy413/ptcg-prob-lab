# PTCG 概率實驗室 · PTCG Probability Lab(seed)

**zh-Hant** — 這是一個「種子倉庫」:用來讓 Claude Code 建造一個全 client-side 的網頁應用,對 60 張 PTCG 牌組做**精確**(BigInt 既約分數、零浮點誤差)的抽卡與獎賞卡概率計算——起手 7 張的基礎寶可夢分布與 Mulligan(重抽)、指定卡組合的完整聯合分布(含重抽修正)、指定卡被放入 6 張獎賞卡的三種模式,以及回合曲線、A/B 比較、對局獎賞卡追蹤器等。數學核心**已完成並通過驗證**;其餘由 Claude Code 依 `docs/` 規格實作。

**en** — A seed repository for Claude Code to build a fully client-side web app computing **exact** (BigInt reduced fractions, zero float error) draw & prize probabilities for 60-card Pokémon TCG decks: opening-hand Basic distribution with mulligan conditioning, full joint distributions for tracked-card combos, three prize-card modes, turn curves, A/B comparison, and an in-game prize tracker. The math core is **finished and verified**; the app is built from the specs in `docs/`.

## 現狀 / Status

- `src/lib/prob/` — 完成的精確數學核心(零依賴、零框架)。
- `tests/golden/golden_vectors.json` — 由獨立 Python `fractions` 產生器生成的黃金向量:**27 案例 / 507 斷言,TypeScript 核心全數通過,含 15 位小數逐字元比對。**
- `docs/01–06` — PRD、數學規格、架構、UI/UX、測試計畫、路線圖(zh-Hant)。
- `CLAUDE.md` — Claude Code 的最高指導文件(en)。

## 自行驗證 / Verify yourself

需求:Node 22+(Python 3 僅在重新生成向量時需要)。

```bash
node --experimental-strip-types scripts/verify_seed.ts
# → ALL GOLDEN VECTORS PASS — TypeScript core matches the independent Python reference exactly.

python3 scripts/generate_golden.py   # optional: regenerate vectors (asserts its own identities)
```

## 用 Claude Code 開始 / Start with Claude Code

在此資料夾開啟 Claude Code,第一句建議照用:

> Read CLAUDE.md first, then docs/01 through docs/06 in order. Run `node --experimental-strip-types scripts/verify_seed.ts` and confirm ALL GOLDEN VECTORS PASS before touching anything. Then execute Phase 0 and Phase 1 of docs/06_ROADMAP.md, keeping `src/lib/prob/` byte-identical and golden tests green at every commit. Stop and show me the running app after Phase 1's DoD is met.

之後每階段:`Execute Phase N of docs/06_ROADMAP.md; run /ship-check before declaring done.`
內建指令:`/verify-math`、`/ship-check`、`/new-question`。

## 一眼看出它在算什麼 / A taste of the math

| 問題 | 精確值 | ≈ |
|---|---|---|
| 4 投卡在起手 7 張中至少 1 張 | 38962/97527 | 39.949963% |
| 10 張基礎寶可夢的重抽率 | 75670/292581 | 25.862923% |
| A(4投,基礎)+B(3投)各至少 1 —— 真實對局(含重抽) | 11011691/71580630 | 15.383618% |
| 同上,天真算法(忽略重抽) | 11011691/96551730 | 11.404965% |
| 1 投卡被放入獎賞卡 | 1/10 | 恰好 10% |

## 聲明 / Disclaimer

非官方粉絲工具,與 The Pokémon Company / Nintendo / Creatures / GAME FREAK 無關;不使用任何官方圖像或標誌。Unofficial fan tool; not affiliated with The Pokémon Company, Nintendo, Creatures, or GAME FREAK; no official artwork or logos are used.
