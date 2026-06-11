# 03 — 技術架構(ARCHITECTURE)

## §1 技術棧(鎖定)

| 層 | 選型 | 理由 |
|---|---|---|
| 建置 | Vite | 快、零配置 TS、worker 一級支援 |
| UI | React 18 + TypeScript(`strict` 全開) | 生態與 Vitest/Testing Library 整合 |
| 樣式 | Tailwind CSS(+ 設計 token 於 `tailwind.config`) | 落實 `04_UI_UX_SPEC.md` 的 token 制 |
| 狀態 | Zustand(含 `persist` 中介層 → localStorage) | 輕、可序列化、無樣板 |
| 圖表 | 自製 SVG 元件優先;需要時可用 Recharts | 長條/曲線都簡單,自製可完全控制風格與 tabular 數字 |
| 測試 | Vitest(+ Testing Library) | 直接吃 TS、與 Vite 同管線 |
| 數學核心 | `src/lib/prob/`(**零依賴、零框架**,已完成) | 可單獨驗證、可被 Worker 與 Node 腳本共用 |

不引入:後端、資料庫、UI 套件庫(shadcn 等)、CSS-in-JS、任何遙測 SDK。

## §2 目錄佈局(目標形態)

```
src/
  lib/prob/            ← 既有核心,搬入時【一字不改】
  workers/prob.worker.ts ← 重查詢的計算入口
  state/               ← Zustand stores(deck / query / ui / prizeTracker)
  i18n/{zh-Hant.json,en.json}
  components/          ← 依 04 規格:QueryBuilder, ResultCard, MathReceipt,
                         DistTable, DistChart, DeckEditor, MulliganGauge, …
  views/               ← Deck / Ask(Q1+Q2) / Prizes(Q3) / Compare / Tracker
  utils/{share.ts,deckImport.ts,storage.ts}
scripts/               ← 既有 Python 產生器與 Node 驗證器(保留可獨立執行)
tests/                 ← golden/ + Vitest specs
```

## §3 數學核心 API(已實作、已驗證;簽名不可破壞)

| 函式 | 用途 |
|---|---|
| `rat, ratInt, add, sub, mul, div, cmp, eq, isZero, toNumber` | BigInt 既約有理數 |
| `binom(n,k): bigint` | 記憶化二項式係數 |
| `hypergeomPmf/AtMost/AtLeast(N,K,n,k)` | 單類別超幾何 |
| `multiHypergeomPmf(N,n,counts,ks)`、`compositions(maxes,total)` | 多類別與枚舉 |
| `openingBasics(B,N,H) → {dist, mulligan, valid, conditionalDist, expectedMulligans, expectedBasics}` | Q1 |
| `mulliganCountPmf(q,m)` | 恰好 m 次重抽 |
| `comboOpening(cards, {N,H,mulliganAware:{otherBasics}}) → {event, table, pValid?, eventUnconditioned?}` | Q2(含條件化) |
| `prizeDistUnconditional(x,N,P)` / `prizeDistGivenHand(x,h,N,H,P)` | Q3 (a)(b) |
| `prizeDistPreGame(x,{isBasic,otherBasics,conditionOnValid,N,H,P}) → {dist,expected,atLeastOne,pValid?}` | Q3 (c) |
| `prizeJointGivenHand(cards,{N,H,P}) → {event, table}` | Q3 多卡 |
| `atLeastOnePrized(dist)`、`expectedPrizedUnconditional(x)` | 便利函式 |
| `cardsSeenByTurn / pSeenAtLeast / seenCurve` | 回合曲線 |
| `fractionStr / decimalStr / percentStr / oneInStr / toChartNumber` | 顯示橋接(唯一允許浮點處) |

擴充規則:新增能力 = 新增函式;改既有行為必先改 `02_MATH_SPEC.md` 與黃金產生器。

## §4 模組與匯入慣例(重要)

核心檔以**顯式 `.ts` 副檔名**互相匯入(`import … from "./rational.ts"`),這是 Node `--experimental-strip-types` 直跑驗證器的需求。請保留此風格,並在 `tsconfig.json` 設:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2022",            // BigInt 求冪/字面值
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```

Vite/Vitest 對 `.ts` 副檔名匯入原生相容;`scripts/verify_seed.ts` 在 Phase 0 之後仍須能用 Node 22+ 獨立執行(CI 的第二道防線)。

## §5 Worker 邊界與序列化

- 規則:聯合表預估 >2,000 格、或任何敏感度掃描/比較批次,進 `prob.worker.ts`;單點查詢可主執行緒直跑(<10ms)。
- `postMessage` 走 structured clone,**BigInt 可直接傳遞**;切勿 `JSON.stringify` 含 BigInt 的物件。
- 需要落地(localStorage / URL)時,以 `fractionStr` 的 `"n/d"` 字串序列化,讀回用 `rat(BigInt(n), BigInt(d))`。
- Worker 介面:`{ kind: "combo" | "prizeJoint" | "sweep" | …, params } → { id, result }`,以 `id` 對應請求,支援取消(忽略過期 id)。

## §6 效能預算(中端手機)

| 操作 | 預算 |
|---|---|
| Q1 全分布 | <5ms |
| Q2 ≤5 卡聯合表 | <50ms |
| Q3 任一模式 | <50ms |
| 敏感度掃描(4 點)/ A/B 比較 | <200ms(Worker) |
| 首次載入 JS(gzip) | <180KB,圖表程式碼可分割 |

`binom` 已記憶化;BigInt 在 n ≤ 60 範圍極快,預算寬裕。超預算先量測再優化,禁止以精度換速度。

## §7 持久化與分享

- localStorage 鍵:`ppl.v1.decks`、`ppl.v1.activeDeckId`、`ppl.v1.basicTags`(卡名→是否基礎的全域字典)、`ppl.v1.settings`。一律帶 `v1` 版本前綴,升級時寫遷移函式。
- 分享 URL:`#/q=<base64url(JSON)>`,JSON 含 `{schema:1, deck:{name,cards:[{name,count,isBasic}]}, query:{…}}`;解碼失敗顯示友善錯誤而非崩潰。長度超過 ~2KB 時提示改用匯出檔。
- 結果圖卡匯出:以 SVG 模板渲染後轉 PNG(`canvas`),含查詢描述、三格式數值、產品名與「精確計算」徽章。

## §8 PTCG Live 牌表解析(`utils/deckImport.ts`)

容錯規則:
- 行格式 `^(\d+)\s+(.+?)(?:\s+([A-Z0-9-]{2,6})\s+(\w+))?$` → 投數、卡名、(可選)系列代碼與編號;系列資訊保留但不參與計算。
- 區段標頭(`Pokémon: 12` / `Trainer:` / `Energy:` / `Total Cards: 60`)用於分組顯示,缺失也能解析。
- 匯入後驗證總數;≠60 給警告但允許繼續(供構築中牌組)。
- **基礎寶可夢標記**:文字牌表無法判定 → 匯入精靈第二步要求對 Pokémon 區段逐行標記(提供「全部標記/全部取消」),結果寫入 `basicTags` 字典,之後同名卡自動帶入。此標記是 Mulligan 數學的輸入,UI 不得跳過此步驟而默默假設。

## §9 i18n

極簡自製:`t(key)` 讀取目前語系 JSON,缺鍵時回退 en 並 console.warn。所有 UI 字串(含錯誤、空狀態、收據文案)必須走 i18n;`/ship-check` 會比對 zh-Hant 與 en 鍵集合一致。zh-Hant 為預設語系。

## §10 程式碼守則

- ESLint(flat config)+ Prettier;`lib/prob` 內以 grep 守門禁止 `Math.random|Math.pow|Math.sqrt|Math.log|Math.exp|parseFloat|toFixed`(`format.ts` 與整數 `Math.min/max/floor` 於索引/邊界用途除外——浮點禁令針對**概率值**,整數計數用 `number` 合法)。
- 元件不直接呼叫核心;一律經 `state/` 的 selector/action,方便測試與 Worker 切換。
- 嚴禁在 UI 層做任何數學;UI 只排版核心回傳的精確值。
