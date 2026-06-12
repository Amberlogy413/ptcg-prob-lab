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
- **Goldfish 重抽循環預設關(P9.2)**:回合曲線(02 §6)未含重抽修正(§6.3 待辦),
  故 goldfish 預設不啟用重抽循環——樣本與精確欄描述同一個伯努利,收斂教學乾淨。
  開啟循環(真實規則)時 UI 常駐警示:樣本與曲線的偏離正是 §6.3 欠的修正。抽牌
  排程直接取自 `cardsSeenByTurn` 的 nSeen 序列,模擬與精確逐回合對齊同一批抽牌。

## 2026-06-12 — Zustand persist 對應多個 localStorage 鍵(Phase 1)

- **缺口**:`docs/03 §7` 規定四個獨立鍵(`ppl.v1.decks` / `ppl.v1.activeDeckId` / `ppl.v1.basicTags` / `ppl.v1.settings`),但 Zustand `persist` 中介層一個 store 預設僅寫一個鍵。
- **裁決**:deck store 使用自訂 `PersistStorage`,把單一 store 狀態拆寫/拆讀至前三個鍵;settings store 直接以 `ppl.v1.settings` 為 persist 鍵。鍵名與規格逐字一致,皆帶 `v1` 前綴與 version 欄位以利未來遷移。

## 2026-06-12 — 真實卡牌目錄(card catalog)的鐵律邊界

- **指示**:產品擁有者要求「極致詳細地真實記錄所有卡片的所有真實資訊,以直觀
  簡單的方式讓用戶加卡」。種子 CLAUDE.md 寫「卡片身份為用戶輸入文字」,且競品
  分析曾把「卡圖資料庫」列入唔做清單(理由:IP 鐵律)。
- **裁決**:鐵律 #6 禁止的是**卡圖、官方標誌、掃描檔、系列符號**——不禁止事實性
  文字資料(卡名、HP、招式、法規標記皆屬遊戲事實)。卡牌目錄以**純文字**形式
  引入,佈局如下:
  - 資料管道 `scripts/fetch_catalog.mjs`(外部工具,如同 gh/wrangler,不進
    runtime 依賴)從 TCGdex 社群開源資料庫抓取 zh-tw(亞洲版編號)全卡池,
    **於源頭剝除** `image` / `pricing` / `variants` 欄位,並內建洩漏斷言
    (輸出含 `assets.tcgdex.net` 或 `"pricing"` 即失敗)。
  - 卡價同樣排除(競品唔做清單:價格爬蟲屬其商業領域,與概率無關)。
  - 輸出 `public/catalog/cards-zh-Hant.json` 靜態資產:**不進主 bundle**,
    首次使用 picker 才 lazy fetch(BASE_URL-aware),首載預算不受影響;
    SW cache-first 自動把它離線化。
  - 目錄是**輔助加卡層**:用戶輸入文字身份照舊是第一公民(目錄缺卡、改名、
    自創卡皆走原路);由目錄加卡時自動填 `isBasic`(category=Pokemon 且
    stage=Basic)、`section`、`set`、`number`、`mark`,並寫入 basicTags
    全域記憶(與手動切換同一行為)。
  - 語言只收 zh-tw(發佈受眾);en locale 用戶見到的卡名仍是繁中——卡名屬
    牌組資料,非 UI 字串,與範本牌組同一裁決。
  - 出處標註:picker 底部注明 TCGdex 來源;README 加 attribution。卡牌文字
    資料之權利屬原權利人,蓋於現有同人工具聲明(PRD §7)之下。

## 2026-06-12 — 視覺化卡片、全標籤列、逐層組牌

- **指示**:卡片視覺化(顯示全部資訊)、每行牌補完全部標籤(不只「基礎」)、
  系統化逐層揀卡組牌。
- **卡片視覺(CardVisual)**:原創純文字卡框,呈現目錄記錄的**每一項**事實
  (特性/招式/弱點/抗性/撤退/稀有度/繪師/圖鑑/風味文/系列/法規/賽制)。
  `docs/04 §2` 鎖死「全產品一隻 accent 色」——屬性身份以文字 chip(草/火/水…)
  表達,不引入屬性彩色;同時遠離官方版面,IP 風險為零。
- **全標籤列**:`DeckCard.catalogId` 連結真實卡;數學永不讀它(僅 isBasic 進
  數學)。「補完標籤」掃描:print 身份(set+number)優先於卡名;卡名取
  標準合法、最新系列之 print;明確 isBasic 寫入 basicTags 全域記憶(與手動
  切換同一契約);目錄外卡名保持原狀——用戶輸入身份仍是第一公民。
- **逐層組牌(DeckBuilderDialog)**:三層 chip(大類→細分→屬性,皆附在池
  計數)+ 結果格 + std-only 預設開。牌組即時讀數列顯示**精確**重抽概率
  (`openingBasics`,6 位小數),building-by-the-numbers 是本品差異化。
  層間互斥邏輯:轉大類清空下兩層;再點同一 chip 取消該層。
- **嵌套 Modal Esc**:只關最上層(以 DOM 末位 dialog 判定)。
- **42-agent 審查後補裁(同日)**:
  - **上游資料消毒(sanityPass)**:TCGdex zh-tw 有壞 print(物品卡標成基礎
    寶可夢、56 張 VSTAR 標成 VMAX、訓練家卡歸入能量)——壞 stage/category 會
    **毒害精確重抽數學**(isBasic = Pokemon+Basic)。管道新增三規則:
    名稱後綴 VMAX/VSTAR 決定 stage;同名 print 嚴格多數決 category(功能文字
    由最佳同名 print 提供——同名卡按遊戲規則共享規則文字);名稱無「能量」
    且有訓練家同名 print 的「能量」卡改歸訓練家。空白招式/特性槽於源頭剝除。
    本次修正 57 stage + 6 category。
  - **Modal 合約**:focus trap(aria-modal 承諾)、開啟者 focus 還原、
    mount-only focus(否則父層每次重繪搶 focus——組牌器每加一張卡都會搶)、
    常設 ✕ 關閉鈕(觸屏唯一可發現的出口)。
  - **行摺疊不變量**:「同一 print 永不分裂成兩行」——addCardFrom 將同名
    無身份(手動)行升級合併;補完標籤掃描遇到已存在同 print 行時合併計數。
  - **AT 可讀性**:加卡按鈕 aria-label 附帶同名合計與「非標準」;牌組讀數列
    role=status;ⓘ 一律 aria-haspopup=dialog、h-9 觸標。
  - `bg-bg` 並非 token(palette 是替換制)——一律 `bg-paper`。

## 2026-06-12 — Phase 10 人性化視覺革新裁決

- **日系粉色主題**:擁有者指示介面改日系粉色配搭。`04 §2` 屬硬規格,故**修訂
  規格本身**(已在 04 §1/§2 加註修訂):櫻粉紙 `#FBF5F7`、櫻玫瑰強調
  `#C8447C`(白底對比 ≈4.6:1 達標)、暖梅墨 `#32222B`;「單一強調色」與
  語義三色原則不變。**token 鍵名 `blue` 保留**(值改為櫻玫瑰)——改鍵名要動
  約 50 個檔案,風險大於混淆;規格與本檔皆註明。圓角 8px/14px(人性化修訂)。
- **icon 系統**:原創單色線條 SVG(`src/components/icons.tsx`,
  stroke=currentColor、aria-hidden、每個皆伴可見文字標籤),不引入 icon 庫
  (`03 §1` 依賴鎖)、不用 emoji 點綴(`04 §1` 反模式)。
- **功能分類器(P10.2)**:`fn` 標籤由**官方卡文的確定性關鍵詞規則**產生
  (管道 `classify()`,規則可重現、有註解);「干擾」採嚴格屬格
  `對手的(手牌|牌庫)`——「給對手看過後放回牌庫」不算干擾(實測修正 48 個
  誤判)。攻擊手 = 最大傷害 ≥120;特性系 = 有特性。標籤只作瀏覽輔助,
  不入任何數學。
- **判例題庫除籍不做清單**:擁有者明示要求判例題庫(Phase 12)。以靜態
  版本化數據集(原創撰寫)實現,維持「不做內容營運」的原意;roadmap 已註。

## 2026-06-12 — 配色修訂二:奇樹粉彩方案 + 屬性資料色票

- **澄清**:擁有者指明「粉色」= **粉彩色系**(pastel),非粉紅;基準為
  奇樹(Iono,朱紫道館館主)配色——粉彩電磁藍 × 粉彩粉雙馬尾、深藍墨。
  第一版櫻玫瑰方案棄用,`04 §2` 再修訂。
- **雙生強調**:`blue #2B76AD`(主操作)+ 新 token `pink #BE3D8F`(徽章/
  計數/輔助高亮),皆對白字 ≥4.5:1;「單一強調」修訂為「雙生強調、職責
  分明」——藍管操作、粉管計量徽章,語義三色不變。
- **屬性資料色票(TypeChip.tsx)**:屬性顏色屬**資料編碼色**(同圖表色),
  僅用於屬性身份(卡片視覺屬性/招式費用、組牌器屬性層),不作裝飾;
  inline style 供色(非 token——資料色不入 UI palette)。屬性 icon 為
  原創簡單幾何(葉/焰/滴/閃電/螺旋/拳/月/六角/翼/星/輝),刻意與官方
  能量符號造型不同,維持 IP 安全。
- 色彩只係嗜好調整時:配色方案再改只需動 `tailwind.config.js` +
  `TYPE_COLORS`,規格須同步修訂(本檔留紀錄)。
