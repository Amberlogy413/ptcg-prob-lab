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

## 2026-06-12 — 數學引擎深度審計(40 agent)+ 中局引擎落地

- **中局引擎(probx/midgame.ts)**:P(接下來 w 抽至少中 k 張解)= 種子核心
  `hypergeomAtLeast(u,x,w,k)` 純參數重映射,黃金 v2 新 kind `midgame`
  (9 案例)對拼獨立 Python 字符級全中。**語義裁決(審計 HIGH)**:u 一律
  定義為**未見池(牌庫+未翻獎賞卡)**——解卡可能被獎賞、玩家無從分辨,
  用牌庫張數參數化正是 docs/09 §3.1 的 Y/X 謬誤(會系統性高估);UI 標籤
  /提示已照此修訂。
- **推導明細+實際意義欄**:中局視圖附逐行代入推導(失敗組合 Σ、C(u,w)、
  既約分數、三格式)與 ±1 張解敏感度(精確 pp)——「對牌組的實際意義」
  以可操作建議呈現。此 pattern 將逐步鋪回其他結果卡。
- **即修正的審計項**:① Q2 收據「條件化」行等式為假(分子誤用未條件化
  值;非基礎追蹤卡情境實測差 16.19pp)→ 合計行改用 event∧valid =
  event×p_valid,鏈式等式恆真;錨點案例(event⊆valid)輸出不變。
  ② `ratPow` 由 n 次 schoolbook 乘法(每步必然空轉的 gcd,n=1000 需 16s)
  改為直接 BigInt 冪(互質⇒冪互質,不變量保持),黃金 luck_tail 不變。
  ③ 組牌器即時重抽讀數改經 `computeDeckSummary`(selector 邊界)並補齊
  三格式。④ 輪替預覽差值單位由「%」正名「pp」。⑤ 中局 UI 語義(見上)。
- **熱門排序(揀卡熱門排前)**:`pop` 排名 = 策展種子(40 名)+ 訓練家/
  能量**再版次數**代理(≥4 版;確定性、可重現),管道蓋章每 print;
  search 與組牌器排序層級:匹配層 → pop → 標準合法 → 最新;UI 註明來源,
  Phase 11 賽事管道接力後替換。寶可夢不入再版代理(收藏向噪音)。
## 2026-06-12 — 卡池真補完 + 真實賽制 + 追蹤器 v2

- **真實賽制(官方來源)**:標準賽制自 2026-02-06 起 = 標記 **H/I/J**
  (J 自 2026-01-09 起;asia.pokemon-card.com 標準賽制異動公告)。上游
  TCGdex `legal.standard` 滯後於真實輪替,故 `std` 改由**管道按標記自行
  推導**(`STANDARD_MARKS`,輪替時更新一處);基本能量恆合法。結果:
  G 標(如夢幻ex)正確退場,標準池 1,221 → 2,032。目錄 meta 帶
  `format`(規則+生效日+來源)與 `newest`(快照新鮮度),UI 注明。
- **卡池補完(包含最新)**:TCGdex 繁中停留 SV10(2025-05);缺失世代
  (SV11B/SV11W、M1L/M1S/M2/M3 = MEGA 世代)以**日文版補完**(set 名帶
  「(日)」,765 張,8,201 總卡),誠實標示;繁中上游補齊後同 id 自動以
  繁中取代。J 標卡上游尚未錄入——規則已備,一到自動合法。
- **追蹤器 v2(審計 🔴 修復)**:後驗以 p = 6 − 已取獎賞 參數化
  (`probx/prizesLeft.ts`,黃金 kind `prize_posterior_p`,7 案例對拼
  Python 全中;舊 P=6 寫死喺取獎後 +15.3pp 級錯誤,審計錨點
  u=20/ux=2/p=4 → 36.842105% 已測試釘死)。新欄:「≥1 仍在牌庫」
  「下一抽中率 = u_x/u」;u<6 終盤誤殺守衛改為 u<p;N 改用實際牌組
  總數(非 60 時明示);「已取獎賞計入已見」提示常駐。

## 2026-06-12 — 洗回重抽複合(奇樹/裁判;審計 #2)

- **模型**:三個族群——未知牌庫(D 張,為未見池 U=D+p 的均勻 D-子集,
  §5.5 家族)、未翻獎賞(p)、被洗回的**已知**手牌(h 張)。
  P(事件) = Σ_js multiHG(u, unseen, D, js) · Σ_ks multiHG(D+h, js+returned,
  draw, ks),ks 受逐類 [min,max] 約束。
- **驗證**:黃金 kind `shuffle_back_redraw`(5 案例,含雙類聯合)對拼
  獨立 Python 字符級全中;Python 自檢:h=0 單類退化 = 未見池直接視窗
  (嵌套可交換性)、p=0 退化 = 確定牌庫直接多元抽、混合權重 Σ=1。
- **UI**:中局工作區第二板塊;單類介面(D/p/未見解/洗回解/h/重抽/k),
  推導明細逐 j 列出混合項(單類時每項 = 普通超幾何乘積,可驗算),
  ±1 張解敏感度照樣輸出。預設值 = 黃金 Iono 錨點(53.200604%)。
- **多類聯合**:引擎已支援(黃金已釘),UI 留待 Q2 式建構器整合
  (Phase 13 後續)。

## 2026-06-12 — mulligan-aware 回合曲線(§6.3 數學債清還)

- **缺口**:回合曲線一直無條件(§6.3 標明這是誠實預設,但欠 mulligan-aware
  變體)。審計指出:非基礎目標可由 energy.ts 補集即得,只有基礎目標係真新分支
  (目標本身計入有效手條件)。
- **實作**:`probx/seenCurve.ts` `seenCurveValid(x, xBasic, otherBasics, want,
  nSeenList, N, H)` = 重組 searchFoldValid 嘅有效手規則
  (basics = (xBasic?kx:0)+kb ≥ 1)同 energy 嘅「手→抽」兩段混合;零新數學。
  黃金 kind `seen_curve_valid`(5 案例),Python 雙自檢:去掉有效條件 =
  hyper_at_least(可交換性)、非基礎目標 = 1 − energy_curve_valid(補集交叉)。
- **UI**:`computeTurnCurve` 加 `mulliganAware?: {xBasic, otherBasics}`;
  CurveSection 加「含重抽修正」開關。條件化 context 取自當前牌組
  (其他基礎 = deckBasics − (xBasic?x:0)、N = 牌組總數);開關只在
  牌組已載入(≥7)、extraSeen=0、且能組有效手時生效(否則常駐提示原因——
  extraSeen 無精確 mulligan-aware 模型,故互斥)。預設牌組卡自動帶 isBasic;
  自訂卡開關時提供「此卡為基礎」勾選。錨點 x=4 基礎/ob=6,going-second
  T1(n=8)= 57.366872%,已測試釘死。

## 2026-06-12 — 真實賽事熱門度(取代估算)+ 同名去重揀卡

- **指示**:擁有者明令「系統只用真實驗證及真實統計出來的數據,熱門卡片要極致
  深度修正」。原本嘅 `pop`(策展種子 + 再版次數代理)係**估算**,違令,全部移除
  (`popularity_seed.json` 刪除,`applyPopularity` 換成 `applyMeta`)。
- **真實數據源**:`scripts/fetch_meta.mjs` 由 Limitless TCG 公開 API
  (play.limitlesstcg.com/api,無需 key)抓取**已完成 STANDARD 賽事嘅真實
  decklist**,計每張卡嘅**採用率 = 含此卡嘅牌組 / 取樣牌組總數**。本次快照:
  53 場、4,212 副牌、2026-06-05~13。輸出 `scripts/meta_usage.json`,
  fetch_catalog 蓋 `pop`(排名)+ `usage`(%)+ `meta`(出處)落卡。
- **英→繁中橋(數據驅動,非手估)**:Limitless 用英文卡名,目錄係繁中。
  - **寶可夢**:全國圖鑑編號(dexId)+ 繪師交集 + ex/V/VMAX 後綴一致,
    且勝者嚴格唯一 → 可靠自動配對。
  - **訓練家/能量**:繪師交集對非寶可夢係雜訊(Ultra Ball 曾誤配 傷藥)——
    一律唔用;改以 `scripts/name_bridge.json` 逐張**存在性驗證**嘅事實翻譯表
    (只收唯一、確定 staple;目錄搵唔到即丟)。卡名翻譯係事實,非熱度估算。
  - 任何唔夠信心嘅一律**丟棄、唔配對、唔猜**(本次配中 106,丟 158)。
- **誠實限制(明示於 UI 出處行)**:現行 meta 大量用 SV10 之後嘅新卡,
  TCGdex 繁中停喺 2025-05,嗰批卡喺目錄只有日文名(由 ja 補完),所以最熱
  嗰批會顯示日文——真實情況,唔遮掩。繁中上游補齊後自動轉繁中。
- **同名去重揀卡(擁有者指示)**:`groupByName(catalog, cards)` 將搜尋/組牌
  結果每個卡名只出**一行**(代表 = 熱門→標準→最新嘅 print),其餘同名版本
  收喺該行嘅「版本」下拉(例如基本能量 4 個版本任揀)。picker 與組牌器同步。
- 更新數據:重跑 `node scripts/fetch_meta.mjs` 再 `node scripts/fetch_catalog.mjs`。

## 2026-06-13 — 真實比賽牌組推薦(Phase 11.2)

- **指示**:每個熱門主軸寶可夢要有一系列不同組合的真實比賽牌組,以最新公開
  比賽為依據排序(同賽制下:世界賽>地區大賽>道館賽>常規店賽)。
- **數據**:`scripts/fetch_decks.mjs` 由 Limitless 公開 API 抓真實 STANDARD
  decklist。**原型分類唔使估**——standings 嘅 `deck` 欄已帶 Limitless 官方
  分類(`{id,name,icons}`,如 `ogerpon-meganium-hydrapple`)。按原型分組,
  組內去重(卡多重集雜湊)保留多套不同組合。
- **等級限制(誠實)**:官方賽事等級(世界賽/地區/道館/店賽)**未開放 API**
  ——play API 只有社群/線上/店賽,冇官方頭銜欄。**唔扮官方等級**(扮就係猜);
  改以**客觀真實信號排序**:賽事規模(參賽人數)→ 近期 → 名次,並於 UI
  明示係依規模分級、非官方頭銜。若日後有官方結果源(RK9 等)再對齊。
- **卡片本地化**:每張卡解析成 zh+isBasic+section(寶可夢 dexId 橋、staple
  事實表、TCGdex en 後備定 isBasic);math 只需 count+isBasic,必定齊全。
  最新世代卡繁中未發行者顯示英/日名(誠實),math 照準。
- **輸出**:`public/catalog/decks-zh-Hant.json`(top 原型、每原型 ~5 套),
  lazy 載入;牌組推薦工作區一鍵 `載入此牌組` → importDeck(帶 isBasic)→
  體檢/組牌/數學。更新 = 重跑 fetch_decks.mjs。

## 2026-06-13 — 中盤情境分析器 + 三語對照 + 全自動更新

- **情境分析器**:中盤由抽象單目標升級為「自由加任何卡 + 自訂當前狀態(U/w
  + 每卡 [min,max])→ 精確聯合概率」。重用種子核心 comboOpening(N=U,H=w),
  零新公式;黃金 v2 `scenario_joint`。附單卡邊際 + 負相關提示 + 收據。
- **三語對照表**:TCGdex ja 與 zh-tw **共用卡 id** → 日文名 1:1 免費齊全
  (SV 世代 100%;pre-SV 唔共用 id 故缺)。`scripts/fetch_names.mjs` 加
  nameZh(7436)/nameJa(3589)/nameEn(1435,寶可夢 dexId+staple)。
  `name` 保留為儲存鍵(牌組匹配不變)。顯示由 cardName(card,lang) +
  useCardName + <CardName> 驅動;TopNav 加「卡名語言(auto/中/英/日)」+
  「三語對照」開關,主力語言大、其餘小。`scripts/zh_overrides.json`
  (id→zh)供擁有者補最新世代缺口。
- **全自動更新(擁有者選全自動)**:`.github/auto-update.yml.disabled`
  每週一 cron:fetch_meta + restamp_meta(輕量重蓋採用率,免重爬)+
  fetch_decks + 黃金/測試 gate + commit + 部署。**泊喺 .disabled**:
  現 token 冇 workflow scope;啟用 = gh auth refresh -s workflow → 搬入
  .github/workflows/ → push。重卡池/三語爬取仍手動(新卡包時)。
- **官方賽事等級數據源**(研究結論,待建):RK9.gg(地區/世界賽 official
  tier,HTML 無 API,需解析)+ limitlesstcg.com/tournaments;play API
  無官方等級。FB 金球戰車 = HK 社群本地賽果(人手)。下一步建解析。

- **審計遺留帳(13 項,排程)**:追蹤器 v2(PRIZE_COUNT 寫死 6——首張獎賞
  被取走後後驗即錯,+15.3pp 級;修法 P=6−k 參數化,黃金先行)、02 §5.6
  中局抽牌引理補規格、四個 selector 同名多行投數合計、Worker 門檻 16–390×
  高估重校、洗回重抽複合模組、mulligan-aware 回合曲線、三卡接力、類別
  聚合查詢、體檢報告/追蹤器/曲線/goldfish 收據全覆蓋等——全部記入
  Phase 13 與「收據全覆蓋」工作項。

## 2026-06-14 — 語言捆綁 + 屬性顏色 + 賽制法定過濾(Phase 1 基礎/清債)

- **語言捆綁(擁有者反饋:同一畫面太多語言唔專業)**:廢除「介面語言 +
  卡名語言 + 三語開關」三件分散控制,合併為**單一語言選擇器**
  (`settingsStore.language: "zh-Hant" | "en" | "tri"`)。卡名語言跟 UI 語言
  走;`tri`(三語對照)係其中一個刻意選項——只有揀 tri 先會多語並列,
  主力(擁有者繁中)大、其餘細。`uiLocaleOf()` 把 tri 解析為 zh-Hant UI。
  persist v2→v3 migrate:舊 triLingual=true → "tri",否則跟舊 locale。
  i18n/index、cardLang、App、TopNav 全部改讀 `language`;刪 cardlang.* keys。
- **屬性顏色(擁有者:不同寶可夢按屬性顏色顯示)**:推翻舊「只准一個 accent
  色、屬性只用文字 chip」決定。`typeColors.cardAccent(card)` = 寶可夢主屬性
  色(Trainer/Energy → 中性灰)。卡片詳情框、搜尋列、視覺組牌格子各加屬性色
  左緣 accent。卡名仍保留具名屬性 chip。**牌組列**暫未著色(列只存 name+count,
  要 catalog join 取屬性;留待對戰沙盤階段——屆時列會解析成完整卡資料)。
- **賽制法定過濾(擁有者:再三確保只有 H/I/J 卡)**:`catalog.isFormatLegal(card)
  = card.std`(單一真相)。CardPicker 加**預設開啟**「只顯示賽制合法卡(H/I/J)」,
  關掉先見非賽制版本。視覺組牌本來已有 stdOnly 預設開 + 誠實 format 行。
- **誠實位(真實核對)**:`format.standard = ["H","I","J"]`(來源
  asia.pokemon-card.com 標準賽制異動公告,生效 2026-02-06)。資料庫最新套
  M3(2026-01-23,全 I 標);**J 標卡全球未發行/TCGdex 未收錄**,故實際可選
  卡池 = H + I + 基礎能量。78 張 G 標 std=true **全部係基礎能量**(永不輪替,
  正確非 bug)。一出 J 標,全自動更新會收。

## 2026-06-14 — 功能性配色 + 人性化小圖示系統(屬性向重設計)

- **背景**:擁有者要「重設配色,全面換成屬性向、直觀、功能性、人性化嘅配色 +
  極致全面嘅小 icon」。先用 40-agent 級背景工作流(icon-color-coverage-audit)
  盤點全 app 380 個資訊元素 + 色/icon 缺口,再依清單落地。
- **設計原則(寫低做規格)**:UI token 仍只用 blue(主動作)+ pink(badge)+
  good/warn/bad + ink/ink2/line/paper(克制、專業底);**屬性色同功能色係
  data-encoding 色,inline 用 `cardAccent()`/`fnColor()`,唔入 token**;新 info
  圖示一律 `stroke=currentColor`,由文字色驅動著色。
- **功能色光譜(src/data/fnColors.ts)**:紅→橙→金=進攻(attacker/boost/accel);
  青→藍=引擎(draw/search);紫=特性;洋紅=干擾;靛=防守;綠/橄欖=維持
  (heal/recover);啡=gust。5 個邊緣色(boost/accel/draw/heal/recover)加深至
  過 4.5:1 對比(淺紙底)。
- **FnChip(src/components/FnChip.tsx)**:11 個功能各有原創 stroke icon + 語意色 +
  i18n label,compact(icon-only+tooltip)模式俾窄位用。鋪到 CardVisual、
  DeckBuilderDialog 功能過濾、CardPicker 結果列。
- **info 圖示(src/components/icons.tsx 新增組)**:IconHP(心)/Weakness(下三角)/
  Resistance(盾)/Retreat(回箭)/Stage(階梯)/Legal(圈剔)/Illegal(圈叉)/
  Flame(火苗)/Energy(水滴)/Warn(三角驚嘆)/Rotate(循環箭)/ArrowUp/Down。
  全部 `{className,size}`,`size="sm"` 內聯。`I` wrapper 升級支援 sm。
- **已接線**:CardVisual(HP 紅心、戰鬥列拆 弱點紅/抗性綠/撤退中性、合法剔/叉)、
  CardPicker(人氣火苗、HP 心、合法剔/叉、compact 功能 chip)、ReportView 三級評等
  (理想✓good/可玩⚠warn/報廢✗bad)、DeckEditor+DeckSummary(60 張警告 + 重抽循環
  + 有效起手剔)、CardRow(輪替出局循環圖示)。**全部限 UI 層,golden 不受影響。**
- **餘下(下一批)**:TrackerView 三警告、RotationPanel 升跌箭、MidgameView 靶心、
  DecksView 名次、TrainerView 誤差方向箭;牌組列卡名本地化(loaded deck 顯繁中)。

## 2026-06-14 — 全面屬性向配色:棄用奇樹拼色,改中性石墨框

- **擁有者**:「全面放棄並刪走原有奇樹拼色,全面轉為屬性向配色。」
- **落地**:推翻 §2 奇樹(Iono)藍+粉雙生強調。UI 框架改**中性石墨**
  (paper #FAFBFC、ink #1E2530、ink2 #5F6976、line #E4E7EC、surface/receipt 白),
  令**全 app 唯一彩色 = 資料色**(屬性色 typeColors.ts + 功能色 fnColors.ts)+
  三語意(good/warn/bad)。token key `blue`/`pink` 保留(避免大改 class)但改值:
  `blue` → #3B4658(中性石墨,主按鈕/作用 nav/focus ring/CountRing 嘅唯一 UI 強調),
  `pink` → #CC5A33(火焰色,只用於人氣/熱度高亮,配 IconFlame,語意化)。
  全部經 tailwind token 串連,改值即全 app 生效;runtime 無硬編 Iono hex
  (favicon/manifest/SVG 收據/尺規均不受影響)。
- **理據**:功能色已佔據大半色相,UI 框架保持中性先可以令資料色「跳出嚟」、
  專業而唔花;呢個就係「屬性向」(色=意義)嘅最克制詮釋。docs/04 §2 待重寫對齊
  (記入技術債);此 DECISIONS 條目為權威記錄。
- ⚠️ 改 tailwind.config.js 後 dev server 要**重啟**先見效(HMR 唔食 config);
  build/deploy 自動食。

## 2026-06-14 — 繁中零殘留:補齊全部非寶可夢卡繁中名

- **擁有者**:繁中版仲見到日文(M 世代日文源卡),要求全部修正,未有官方繁中名嘅
  參考 52poke 翻譯。
- **落地**:`scripts/fill_extra_zh.mjs` 兩步補 nameZh:(1)再版橋接(日文名→既有
  繁中印刷,7 張);(2)人手核實表 `scripts/extra_zh.json`(89 張,訓練家/能量/
  競技場)。確定官方繁中名為主(氣球/神奇糖果/稜鏡星能量/寶可夢交替…),少數最新
  M 世代卡用忠實翻譯(待官方發行修正)。結果:**全 8201 張卡 nameZh 齊全,std 0 缺**。
  實測組牌工坊能量分頁零日文。
- **新套更新管線次序**(更新):fetch_catalog → fetch_names → fill_zh_names →
  fetch_dex_names → embed_en_zh → **fill_extra_zh** → reclassify → restamp_meta。
  (restamp 保留所有 nameZh embed。)

## 2026-06-15 — 牌組推薦零殘留 + 角括號清理 + 原型名 override

- **擁有者**:牌組推薦見到「Festival 先手」「基礎 盒組」等怪名,指出「有時主題唔單
  指係寶可夢或其組合,可以係以寶可夢特性嚟組既牌組命名」;並要求繼續還清所有債、
  逐步完成。(亦提供 GS 球戰車隊 facebook 作牌名參考 —— 需登入,Claude **不會代登入**;
  改用可驗證來源:catalog/52poke/Bulbapedia/官方圖鑑。)
- **根因**:(1)牌組推薦 JSON 由 `fetch_decks.mjs` 生成,英文源 + 舊版 resolver
  缺口 → 牌表殘留 179 個日/英卡名;(2)`<火箭隊的>黑暗鴉` 嘅角括號係 **TCGdex
  zh-tw 上游 markup**(name/nameZh 兩欄都有,88 張)→ 全 app 中招;(3)原型大標題
  per-word 翻譯對「以特性命名」嘅牌組讀唔通。
- **落地**:
  - **角括號**:runtime `catalog.ts` `normalizeCatalog()` 載入即 strip(再 fetch
    都唔怕)+ 一次性 `scripts/strip_brackets.mjs` 清 served JSON(88→0)。
  - **牌表本地化** `scripts/relocalize_decks.mjs`(冪等,資料層重寫,**零靠估**):
    寶可夢 → `dex_names.json` 解析(日/英 species + 詞綴重組,**species-first** 避免
    メガニウム 被當 Mega);訓練家/能量 → ① catalog ja→zh(ja/zh 共用 id,官方);
    ② `scripts/trainer_en_ja.json`(en→ja→catalog,**繁中名 100% 嚟自 catalog 真實
    數據**,自動校正:Carmine→阿楓、Lana's Aid→水蓮的照顧、Cyrano→席藍、Eri→枇琶);
    ③ 仍未有 zh-tw 發行嘅最新卡 → `scripts/trainer_en_zh.json` 忠實翻譯(**暫譯**,
    參考 52poke,auto-update 出官方名即覆蓋)。結果:**3533 牌表卡名 0 殘留**,
    247/294 distinct 名由 catalog 官方印證。
  - **原型 override**:`src/data/decks.ts` `ARCH_OVERRIDE`(以特性/機制/社群慣稱命名
    嘅牌組;擁有者為 zh 賽制慣稱權威):Festival Lead→祭典樂舞、Basic Box→太晶Box。
- **誠實位**:約 28 張最新 ME/SV10.5/SV11 卡未有官方繁中 → 暫譯(已 flag),清單交
  擁有者校對;角色名一律用官方遊戲繁中(席藍/枇琶/可怕的哥哥…),唔自創。
- **新套更新管線次序**(更新):fetch_catalog → fetch_names → fill_zh_names →
  fetch_dex_names → embed_en_zh → fill_extra_zh → reclassify → **strip_brackets** →
  restamp_meta →(fetch_decks 後必跑)**relocalize_decks**。

## 2026-06-15 — 整張卡屬性底色 + 特性子分類 + 介面改革方向

- **擁有者**:① 寶可夢卡「成張卡連底色」都跟屬性色(唔淨係左邊框);② 功能標籤
  (例:特性系)之下要有子分類;③ 極致參考 PriceRight (priceright-moving-core.vercel.app)
  做徹底介面轉換;④ 同主軸寶可夢的熱門牌組要喺同一卡欄以系列形式揀。
- **本批落地(③④下批做)**:
  - **整張卡屬性底色**:`typeColors.ts` 新增 `cardSurface(card, strength)` → 柔和
    屬性色填充 + 同色邊框 + 較深左緣(tile ≈9% / row ≈5% alpha,文字仍清晰)。
    套用:組牌工坊 tile、CardVisual、CardPicker 結果列、CardRow(已解析列淡染)。
  - **特性子分類**:`classify.mjs` 新增 `ABILITY_SUB_RULES`,**只掃特性文字**(招式
    措辭唔會污染),父 fn = ability。8 類:ability.draw/search/accel/gust/damage/
    heal/disrupt/protect。reclassify 後 fnSub 由 1810→2145 張;抽樣核實準確
    (奇諾栗鼠抽2張→draw、布莉姆溫互換→gust、巨炭山充能→accel)。FN_SUB_ORDER/
    KEYS + i18n(繁/英)齊。
- **介面改革方向(緊記)**:借 PriceRight 嘅**版面/表達系統**(編號選項卡 + 圖示磚 +
  兩行 pipe 描述、置頂步驟列、右側即時摘要面板、情境提示條),但**主調維持中性石墨**
  ——唔跟佢哋嘅綠色主調(會撞 草/火/水 屬性色,不專業)。即:借 layout,唔借 accent hue。
  見 memory ui-accent-no-type-colors。

## 2026-06-15 — 卡片屬性 icon + 精準種類標籤 + 繁中日文覆核

- **擁有者**(嚴正):① 唔好綠色主調(撞草系,不專業,以後緊記);② 再三覆核繁中
  有冇其他語言;③ 快速加入卡片要明顯顯示屬性 icon;④ 唔好得「基礎/非基礎」二元標籤
  咁唔精準;⑤ 極致深扒 PriceRight 設計邏輯及底層邏輯,徹底改革。
- **本批落地**:
  - **屬性 icon**:typeColors `cardType(card)`(寶可夢主屬性 / 能量元素 / 否則 null)。
    CardPicker 結果列以屬性色 TypeIcon 取代幼色條;組牌工坊 tile 加 TypeChip;
    CardRow 解析列顯屬性 icon。
  - **精準種類**:CardRow 新增 `kindLabel`/`typeName`;已解析卡顯示**真實種類**
    (基礎/一階進化/二階進化、物品/支援者/競技場/寶可夢道具、基本/特殊能量),取代
    二元「基礎」掣;未解析的手動/範本列(例:範本牌組嘅「主攻手」佔位)先保留掣。
  - **繁中日文覆核(audit)**:卡名 **0 日文**(全清)。仲有日文嘅只係 **6 套最新、
    全球未出繁中版嘅卡集**(SV11B/W、M1L/S、M2、M3)嘅**效果/特性/招式文字(765 張)
    + 卡集名(6 個)** —— 官方根本未有中文。處理:背景 workflow 忠實翻譯(暫譯,
    auto-update 出官方即覆蓋)+ 卡集名以英文官方名為據翻譯。
- **介面改革**:已開背景 workflow(study-priceright-design)深扒參考站 design token
  /IA/表達手法,產出 design-logic spec + 分階段計劃。**主調維持中性石墨**,只借 layout。
