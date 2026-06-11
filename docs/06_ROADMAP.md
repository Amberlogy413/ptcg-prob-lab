# 06 — 開發路線圖(ROADMAP)

> 每個 Phase 都有「完成定義(DoD)」;DoD 不滿足不得進入下一 Phase。每 Phase 收尾執行 `/ship-check` 與 `05 §F` 手動清單。**全程鐵律:黃金測試恆綠。**

## Phase 0 — 腳手架與核心搬遷

目標:把種子變成可開發的 Vite 專案,數學核心原封不動接上測試管線。

任務:
1. `npm create vite@latest`(react-ts)就地初始化;裝 Tailwind、Zustand、Vitest、Testing Library、ESLint(flat)+ Prettier。
2. `tsconfig` 依 `03 §4` 設定(`allowImportingTsExtensions` 等);**`src/lib/prob/` 一字不改**。
3. 把 `scripts/verify_seed.ts` 的斷言邏輯移植為 `tests/golden.spec.ts`(讀同一份 JSON);Node 直跑版保留。
4. 建 `package.json` scripts:`dev / build / test / verify:seed / golden / lint / typecheck`。
5. Tailwind token 依 `04 §2` 落地;載入 Noto Sans TC / IBM Plex Sans / IBM Plex Mono(本地字型檔,離線可用)。

DoD:`npm run typecheck && npm test && npm run verify:seed` 全綠;`npm run dev` 顯示帶 token 的空殼頁(頂列四工作區、頁腳聲明與「精確計算 · 非模擬」徽章)。

## Phase 1 — 牌組編輯器與匯入

目標:60 張牌組的建立、保存、匯入匯出與基礎寶可夢標記(後續一切數學的輸入)。

任務:行編輯器(投數/卡名/基礎切換)、60 計數環、多牌組管理(Zustand persist → `ppl.v1.*`,`03 §7`)、PTCG Live 匯入精靈兩步與匯出(`03 §8`)、`basicTags` 全域字典。

DoD:貼入真實 PTCG Live 牌表 → 標記基礎 → 左欄摘要即時顯示基礎數與重抽率小錶(調用 `openingBasics`);重載與離線後資料還在;匯入夾具測試通過(`05 §E`)。

## Phase 2 — Q1 視圖(基礎寶可夢與重抽)

任務:重抽儀表板三聯卡、原始分布 vs 條件分布表(「你實際拿到的手」)、自製 SVG 長條圖、頭條層三格式 + 精密量尺、第一份數學收據(Q1 公式)。

DoD:B=10 牌組顯示 25.862923% / 75670/292581 / 1 in 3.867;收據可展開、可複製;`02 §8` 錨點抽查吻合;a11y:量尺有 aria-label。

## Phase 3 — 句子式查詢建構器(Q2)

任務:`04 §4` 句型(卡 chip、約束下拉、≤5 卡)、重抽修正開關(未標記基礎時置灰引導)、結果卡三層完整版(聯合表+微長條、收據含「條件化」行)、Worker 接入(>2,000 格才進 Worker,`03 §5`)、builder→參數快照測試。

DoD:重現殺手示範——A(4,基礎)+B(3),其餘基礎 6:開關開 15.383618%、關 11.404965%、對照行顯示 −3.98pp;收據五行式與 `04 §5` 範例一致;360px 寬可用精靈流程完成同一查詢。

## Phase 4 — Q3 獎賞卡(MVP 收官)

任務:三模式分段控件(賽前無條件/已知手牌/賽前·含重抽)+ ⓘ 解說、單卡分布與多卡聯合(`prizeJointGivenHand`)、預設十問快捷列(PRD §4-14)、CSV 匯出分布表。

DoD:三模式錨點全中(35.145960% / 手1→30.782037% / 基礎ob6 E=0.381570 且 UI 註明方向直覺);「1 投卡被獎賞 = 10% 整」作為預設十問之一可一鍵重現;`/ship-check` 通過 ⇒ **MVP 宣告完成**。

## Phase 5 — V1:曲線、比較、敏感度、分享

任務:回合曲線(先攻/後攻、`extraSeen` 滑桿、歷史規則開關預設關、「未含重抽修正」標示,`02 §6.3`)、A/B 比較與 delta 徽章、敏感度滑桿(投數 0–4 掃描,Worker 批次)、分享 URL(`03 §7`)與結果圖卡 PNG 匯出、起手品質分級(理想/可用/死手,Mulligan-aware)。

DoD:x=4 曲線 n=7…13 與 `02 §6.2` 錨點逐點吻合;分享連結來回測試綠;比較視圖用「3投 vs 4投」展示 delta;圖卡 PNG 含三格式與徽章。

## Phase 6 — V2:追蹤器、驗證、雙語、PWA

任務:對局獎賞卡追蹤器(`02 §5.5`,含常駐合規提醒)、蒙地卡羅驗證按鈕(100,000 局 + 信賴帶動畫,`05 §D`)、en 介面補齊與 i18n 鍵零缺漏、PWA(manifest + service worker,離線完整可用)、列印樣式、深色主題(可選)。

DoD:追蹤器勾選若干「已見」後,後驗值與手算 `1 − C(u−u_x,6)/C(u,6)` 抽查一致;MC 按鈕展示收斂於精確值;Lighthouse PWA 可安裝;`05 §F` 全項通過。

## 給 Claude Code 的啟動提示(建議原文照用)

> Read CLAUDE.md first, then docs/01 through docs/06 in order. Run `node --experimental-strip-types scripts/verify_seed.ts` and confirm ALL GOLDEN VECTORS PASS before touching anything. Then execute Phase 0 and Phase 1 of docs/06_ROADMAP.md, keeping `src/lib/prob/` byte-identical and golden tests green at every commit. Stop and show me the running app after Phase 1's DoD is met.

之後每階段:「Execute Phase N of docs/06_ROADMAP.md; run /ship-check before declaring done.」
