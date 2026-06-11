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

## 2026-06-12 — Zustand persist 對應多個 localStorage 鍵(Phase 1)

- **缺口**:`docs/03 §7` 規定四個獨立鍵(`ppl.v1.decks` / `ppl.v1.activeDeckId` / `ppl.v1.basicTags` / `ppl.v1.settings`),但 Zustand `persist` 中介層一個 store 預設僅寫一個鍵。
- **裁決**:deck store 使用自訂 `PersistStorage`,把單一 store 狀態拆寫/拆讀至前三個鍵;settings store 直接以 `ppl.v1.settings` 為 persist 鍵。鍵名與規格逐字一致,皆帶 `v1` 前綴與 version 欄位以利未來遷移。
