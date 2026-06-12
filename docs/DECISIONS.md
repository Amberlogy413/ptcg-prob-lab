# DECISIONS — 規格缺口裁決紀錄

> 依 CLAUDE.md「When you're unsure」:規格出現缺口或矛盾時,選最小方案、記錄於此、保持黃金測試全綠。

## 2026-06-12 — `noUncheckedIndexedAccess` 與受保護核心的矛盾(Phase 0)

- **矛盾**:`docs/03 §4` 要求 tsconfig 開 `noUncheckedIndexedAccess: true`;但受保護的種子核心 `src/lib/prob/**` 與 `scripts/verify_seed.ts`(皆「一字不改」)在該旗標下無法通過 `tsc`(種子出廠時未附 tsconfig,核心程式風格先於此旗標)。
- **裁決**:用 TypeScript project references 同時滿足兩者——
  - 根 `tsconfig.json` 保留 `docs/03 §4` 全部旗標(含 `noUncheckedIndexedAccess: true`),適用於所有新寫的 app / tests 程式碼;
  - 受保護核心由 `tsconfig.prob.json` 子專案檢查(僅少 `noUncheckedIndexedAccess` 一旗,其餘 strict 全開;`emitDeclarationOnly` 輸出至 gitignored `.tsout/`);
  - `scripts/` 排除於 tsc 程式之外:`verify_seed.ts` 的正確性證明是「執行它」(`npm run verify:seed`,Node strip-types 不做型別檢查),且其本體受黃金測試法律約束。
- `npm run typecheck` = `tsc -b tsconfig.prob.json && tsc --noEmit -p tsconfig.json`,兩段皆須綠。

## 2026-06-12 — Tailwind 採 v3(classic `tailwind.config`)(Phase 0)

- **缺口**:`docs/03 §1` 鎖定「Tailwind CSS(+ 設計 token 於 `tailwind.config`)」未指定版本;Tailwind v4 已改為 CSS-first 設定,無經典 `tailwind.config` token 物件。
- **裁決**:採 Tailwind **v3.4**(`tailwind.config.js` 完整承載 `docs/04 §2` token),與規格字面一致、風險最小。

## 2026-06-12 — 本地字型檔以 @fontsource 套件供應(Phase 0)

- **缺口**:`docs/06` Phase 0 任務 5 要求「本地字型檔,離線可用」,未指定取得方式。
- **裁決**:採 `@fontsource/noto-sans-tc`、`@fontsource/ibm-plex-sans`、`@fontsource/ibm-plex-mono` npm 套件——字型檔隨依賴落地、由 Vite 打包、完全離線,無 CDN 請求、無遙測。非 UI 元件庫,不違反 `docs/03 §1` 的不引入清單。

## 2026-06-12 — 預設十問的對象與填充方式(Phase 4)

- **缺口**:PRD §4-14 與 `docs/06` Phase 4 要求「預設十問」一鍵載入,但 Q2 建構器以牌組卡為單位(cardId),預設問題(如「4 投卡」)未必對應用戶牌組中的卡。
- **裁決**:Q3 單卡查詢支援「自訂 ×x」來源(與牌組卡並列),八題直接填充 Q3 參數(全部對應 `02 §5` 錨點);第九題填充多卡聯合示範(A4 手1 + B3 手0);第十題跳轉 Q1(用戶自己牌組的重抽概率)。DoD 指定的「1 投卡被獎賞 = 10% 整」為第一題。Q2 類預設(依賴牌組卡 chip)留待 Phase 5 分享 URL 機制一併處理。
- 快捷列同時出現於「提問」與「獎賞卡」工作區頂部(`04 §4`:builder 上方一排快捷 chip)。

## 2026-06-12 — Phase 6 裁決

- **黃金管線 v2**:新數學(02 §6.4 能量斷流、§10 運氣尾概率)需要雙實作驗證,但種子三件套(`generate_golden.py` / `golden_vectors.json` / `verify_seed.ts`)受「一字不動」保護。裁決:平行開 v2 管線——`scripts/generate_golden_v2.py`(獨立 Python `fractions`,內建 Σ=1、可交換性、單調性自檢)→ `tests/golden/golden_vectors_v2.json` → TS `src/lib/probx/`(同樣 BigInt-only 紀律)→ `tests/goldenV2.spec.ts` 逐字元比對。首次交叉比對 71 斷言全中。
- **新數學擺位**:`src/lib/prob/index.ts` 受保護不可加 export,新模組放 `src/lib/probx/`(浮點禁令同等適用;ship-check 嘅浮點 grep 範圍應一併覆蓋——`probx` 內無任何 `Math.*`/float)。
- **D1 卡名別名合併、D3 百問題庫、深色主題**:延後至 Phase 7。理由:D2 嘅名單 JSON 以卡名為鍵、天然容納中英並列,已覆蓋 D1 八成需求;D3 需要先有自訂快捷儲存機制;深色主題規格本身標明「可選」。Roadmap 已同步。
- **PWA 圖示**:用現有原創 favicon.svg(`sizes: any` + maskable);Chrome 支援 SVG manifest icons。Lighthouse 實機跑分留待部署後(本環境無 Chrome audit 管道),manifest/SW/離線快取契約已具備並有測試。

## 2026-06-12 — Phase 5 雜項裁決

- **訓練模式紀錄鍵**:`docs/03 §7` 只列四個 localStorage 鍵;訓練誤差紀錄新增 `ppl.v1.training`(同樣帶 v1 前綴,上限 200 筆)。
- **分享 URL 範圍**:`03 §7` 的 query 欄位本期僅支援 Q2(`{type:"q2"}`);Q1/Q3 分享留待需求出現再擴充 schema。
- **敏感度/歸因的補位假設**:改動某卡投數時,牌組總數以「一般非基礎卡」補位維持 60——假設明示於 UI 文案。
- **比較視圖查詢形態**:A/B 比較以「同名卡、至少 n 張、可切重抽修正」為查詢單位(DoD 的 3投 vs 4投 場景);完整 Q2 句式跨牌組比較留待 V2。
- **PNG 圖卡字型**:SVG→canvas 光柵化無法載入網頁字型,圖卡用系統 monospace/sans 後備;版面與三格式不受影響。

## 2026-06-12 — 競品對齊的鐵律過濾(Phase 8 排程)

- **指示**:產品擁有者要求「先做到 ptcgtw.shop 所有功能,再開發革命性功能超越」。
  該站多項核心功能(卡圖資料庫、卡價爬蟲、官方 API 整合、多人對戰網)直接牴觸
  CLAUDE.md 鐵律 #6(IP 安全)與 #7(全客戶端)。
- **裁決**:逐項過濾,分三類記入 `08_COMPETITOR_ANALYSIS.md` §5——可對齊(A)、
  明確唔做(B,連理由)、革命性超越(C)。「所有功能」解讀為「所有通過鐵律的
  功能,各附精確數學增強」;不可對齊項以合規橋接替代(官方碼→PTCG Live 文字格式
  →本品),不靜默略過。
- **賽事登錄牌表**:不複製官方構築表版面(版式著作權風險),改原創排版、承載同等
  資訊;DoD 明文「無任何卡圖」。
- **引文術語**:競品分析文件中對方原文(「機率」「獎勵牌」)以引文照錄;本品 UI
  與文檔一律維持術語鎖(概率/獎賞卡)。
- **試抽桌的浮點邊界**:抽樣洗牌沿用 `mcSim.ts` 的 mulberry32(浮點僅用於洗牌
  次序,屬模擬教學,核心紀律不變);畫面上所有概率數字一律來自精確選擇器。
- **範本牌組庫的卡名(P8.2)**:範本列以**角色佔位名**(主攻手(基礎)、檢索球、
  神奇糖果等通用詞)而非真實卡名出貨——數學只讀投數與基礎標記,佔位名教構築形狀,
  且把 IP 風險降到零;用戶載入後可隨意改名。範本名稱/簡介行 i18n;列名屬牌組資料,
  維持 zh-Hant(en 用戶載入後同樣可改)。

## 2026-06-12 — Zustand persist 對應多個 localStorage 鍵(Phase 1)

- **缺口**:`docs/03 §7` 規定四個獨立鍵(`ppl.v1.decks` / `ppl.v1.activeDeckId` / `ppl.v1.basicTags` / `ppl.v1.settings`),但 Zustand `persist` 中介層一個 store 預設僅寫一個鍵。
- **裁決**:deck store 使用自訂 `PersistStorage`,把單一 store 狀態拆寫/拆讀至前三個鍵;settings store 直接以 `ppl.v1.settings` 為 persist 鍵。鍵名與規格逐字一致,皆帶 `v1` 前綴與 version 欄位以利未來遷移。
