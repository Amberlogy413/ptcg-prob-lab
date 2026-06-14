# PTCG 概率實驗室 — 表達系統升級設計規格（借鑑 PriceRight，移植到石墨灰主調）

> 版本：DRAFT v1 · 2026-06-15
> 作者：資深產品設計
> 範圍：本文件係**設計邏輯規格**（design-logic spec），唔係實作 PR。佢界定我哋要由 PriceRight（實惠搬屋）借咩、點樣映射到我哋鎖死嘅石墨灰主調、要起咩共用組件、每個 workspace 點對應、同埋分階段點落地。
> 鐵律：**主調永遠係石墨灰 `#3B4658`（token `blue`）**。PriceRight 嘅綠 `#7EBC60`／黃 `#FFCE46`／藍一律**唔可以**做我哋嘅 UI 主調——飽和色只可以做 Pokémon 屬性／功能語意（data color），呢個係 `[[ui-accent-no-type-colors]]` memory 嘅紅線。我哋只借：版面（layout）、資訊架構（IA）、互動模型、組件解剖（component anatomy）、間距節奏（spacing rhythm）、同微文案語氣（microcopy tone）——**絕不借色相**。

---

## 0. 一句話總結（俾趕時間嘅人睇）

PriceRight 之所以「貴格、似精密儀器」，唔係靠隻綠色，而係靠**六樣結構性嘢**：① 頂部步進器（stepper）＋鎖步邏輯；② 右側 sticky live-summary 儀表板（一個大字數字＋一條 mini 帳目）；③ 編號 option card（icon tile ＋ `0X` mono 徽章 ＋ 標題 ＋ `｜` 分隔兩行描述）；④ 色彩分級嘅 contextual hint bar（「呢個選擇會改變咩」教學句）；⑤ 慷慨而一致嘅圓角／陰影／間距節奏；⑥ 短促、廣東話語氣、誠實對沖、emoji 做語意標記嘅微文案。

我哋本身已經有**完美匹配**嘅哲學基礎：石墨灰中性框架 ＋ data-only chroma ＋ 三格式概率 ＋ 數學收據。呢次升級 = 將上面六樣嘢用**我哋現有 token** 系統化成五個共用組件（`OptionCard / StepHeader / LiveSummaryPanel / HintBar / SectionHeader`），再逐個 workspace 換上去。落地分四階段，先做基建＋旗艦頁。

---

## 1. 借嘅「設計邏輯」——點解 PriceRight 睇落專業（拆解，非抄色）

呢節解釋**機制**，唔係外觀。每一項後面標明我哋會點轉化。

### 1.1 線性 4 步 stepper ＋ 鎖步 = 「呢個係一部受控嘅儀器」
PriceRight 用 `k6`（4 步）＋ `maxStep`（最遠已驗證步）：當前步 active、做完嘅步顯示 ✓、未解鎖嘅步顯示 🔒 並 `aria-disabled` ＋ tooltip「請先完成前面步驟的必填欄位才能前往此步」。可以點返去任何做完嘅步，但向前只可以去到 `maxStep`。
**點解專業**：用戶永遠知道「我喺邊、仲有幾多步、邊度未做」。鎖步將一個自由表單變成一條有保證嘅路徑——錯漏喺進入下一步之前就被攔截，唔係喺最後先爆。
**我哋點轉化**：我哋唔係單一線性流程（我哋有 11 個 workspace），所以 stepper **唔係全域導覽**（全域導覽留俾 TopNav）。Stepper 嘅邏輯改造成**頁內 StepHeader**：俾本身有自然次序嘅 workspace 用（Q2 sentence builder、Import Wizard、組牌工坊、Tracker 設定），表達「① 揀牌組 → ② 設條件 → ③ 睇概率＋收據」。鎖步 = 未揀牌組就唔可以入「設條件」。

### 1.2 右側 sticky live-summary = 「儀器讀數永遠在線」
`lg:grid-cols-[1fr_360px]`，右欄 sticky `top-24`，由 wizard state **純衍生**、即時重算、唔使 submit。頂部係**唯一一個深色面**（`bg-brand-dark`）：eyebrow（`text-[11px] uppercase tracking-widest`）＋ `text-4xl font-black tabular-nums` 大數字 ＋ 公式麵包屑 sub-line ＋ 訂金。下面係「快速狀態」label/value 帳目卡 ＋ 條件狀態 pill ＋ empty state。
**點解專業**：將「你而家改緊嘅嘢」同「結果」分屏並置——左邊操作、右邊讀數。深色面令到頭條數字有儀表盤嘅權威感；mini 帳目令大數字**可信**（睇得到佢由咩砌出嚟）。
**我哋點轉化**：我哋已經有 `lg:grid-cols-[300px_minmax(0,1fr)]` 嘅左側 `DeckSummary` aside。呢個 layout 已經啱晒，只係**陳列哲學要升級**：把 `DeckSummary` 重構成正式嘅 `LiveSummaryPanel`——一個深色頭條數字面（套用我哋嘅 `blue #3B4658` 做深面，白字數字，IBM Plex Mono `tabular-nums`）＋ 一條「快速狀態」mini-ledger ＋ 條件 pill ＋ empty state。佢嘅「頭條數字」= 當前 workspace 嘅主概率（mulligan% 或 query 結果），mini-ledger = 數學收據嘅精簡版。**PriceRight 嘅 `#4B4F58` 同我哋 `#3B4658` 幾乎一樣**，所以呢個深面係 1:1 移植——但訂金嗰個黃色高亮**丟棄**，改用白字或石墨灰。

### 1.3 編號 option card（icon tile ＋ `0X` ＋ 標題 ＋ `｜` 兩行描述）
PriceRight `uS`：左邊 48px icon tile（rounded-xl）＋ 右欄一行 {mono `0X` 徽章 → 粗體標題} ＋ 一條 `text-xs` `｜` 分隔 tagline；選中 = 邊框上色 ＋ 淺底 ＋ icon tile/徽章變實心填色 ＋ glow。
**點解專業**：① icon tile 做主視覺錨點，掃描超快；② `0X` mono 徽章俾選項一個「型號感」（似揀型號，唔似填問卷）；③ 兩行 `｜` 描述喺**揀之前**就講清楚「呢個選項係咩、包咩」，減少猶豫；④ 整張卡係點擊目標（fitts' law），易撳。
**我哋點轉化**：呢個正正係 owner #39 要嘅 pattern。我哋已經有齊原子：`TypeIcon`／`FnIcon`／`icons.tsx` 做 icon tile，IBM Plex Mono 做 `0X` 徽章，`cardSurface()` 做卡面 tint。選中態用**石墨灰一個 accent**（邊框 `#3B4658`、icon tile/徽章實心 `#3B4658` 配白字、淺底用石墨灰 ~8% tint）。**唔好**學佢用綠／黃做「進階流程」第二 accent——subtype 區分改用 outline 或一個文字 chip，唔用色相。

### 1.4 色彩分級 hint bar = 產品嘅教學層
PriceRight 有一套完整 hint 詞彙：黃＝後果（呢個選擇會點改變後面）、綠＝獎勵（解鎖優惠）、琥珀＝admin override、玫瑰＝阻擋性驗證（「仲差以下項目：」＋缺項清單）、灰＝中性。每個都係 `rounded-xl border-2 ＋ tinted-50 底 ＋ p-3/4 ＋ 前置 icon`，關鍵詞粗體。
**點解專業**：每一個 toggle／選項都配一句**人話**「呢個選擇會改變咩」。產品由「等你估」變成「主動教你」——呢個正正同我哋「數學收據」嘅透明哲學同源。
**我哋點轉化**：建立 `HintBar` 組件，五個 severity variant。**色相要石墨灰化**：中性 hint 用 `bg-paper`／`line` 邊框；阻擋性錯誤可以保留我哋已有嘅 `bad #B3261E` 語意色（但只做**短暫狀態**，唔做面 accent）；獎勵／資訊類用石墨灰 tint，**唔用綠**（綠撞草系）。語意色（`good/warn/bad`）只可以做 transient state，呢個同 `CompareView` 嘅 `DeltaBadge`（我哋唯一受認可嘅語意色用法）一致。

### 1.5 慷慨而一致嘅間距節奏
三層圓角階梯（chip 6px／控件 12px／卡 16px／sheet 24px）、signature soft shadow `0 4px 24px -8px rgba(75,79,88,.1)`、4px 間距網格、option grid `gap-3`、卡內 `gap-3`、panel `p-5 sm:p-6`、section `space-y-5`。
**點解專業**：節奏一致 = 視覺有呼吸、唔逼、似量度過。
**我哋點轉化**：我哋已有 `ctl 8px`／`card 14px` 兩層階梯——**保留我哋自己嘅階梯**（唔好改成佢嘅 12/16，我哋 8/14 已經係刻意人性化過嘅值，見 token 註解）。但**採納佢嘅間距節奏**：option grid `gap-3`、卡內 flex `gap-3`、panel `p-5 sm:p-6`、section `space-y-5`、icon+label 行 `gap-2.5`、option tile `min-h-[64px]`。陰影方面，我哋現只有 `shadow-receipt`（鎖死俾收據／CardVisual）；可以**加一個** `shadow-soft = 0 4px 24px -8px rgba(30,37,48,.10)`（石墨灰 tint，唔係綠）俾 LiveSummaryPanel／選中卡用，但 hover glow 都係石墨灰（`rgba(59,70,88,.30)`），唔好引入綠 glow。

### 1.6 微文案語氣——短促、廣東話、誠實對沖、emoji 做語意標記
PriceRight：祈使短句（下一步／上一步／落訂）、廣東話口語（仲差／撳／柯打）、誠實對沖（「本報價僅供參考，最終以師傅確實到場評估及報價為準」）、emoji 語意標記（✅❌⚠⚡🚚📦💡ℹ️）、每個費用變數都有「…明細（X 變數計算過程）」展開器。
**點解專業**：語氣有人味又老實，建立信任；展開器將「黑盒計算」變成「睇得到嘅推導」。
**我哋點轉化**：借**語氣**唔借字眼。保留術語鎖：**概率（永不機率）、獎賞卡、基礎寶可夢、重抽（Mulligan）**。UI chrome 用石墨灰主調，但文案可以注入廣東話祈使（下一步／上一步／計算／睇收據）同誠實對沖（「此為精確理論值，實戰受洗牌與手感影響」）。我哋嘅「數學收據」展開器**正正係**佢「X 變數計算過程」嘅同類物——用 emoji 做 hint bar 嘅前置語意標記係 OK 嘅（emoji 唔係主調色）。

---

## 2. 要起嘅組件系統（用我哋石墨灰 token 表達）

呢節係**可實作藍圖**。每個組件俾名、解剖、狀態、token 映射、API 草稿。全部 token 引用我哋現有 `tailwind.config.js`（`blue=#3B4658`、`ink/ink2/line/paper/surface/receipt`、`ctl/card`、`font-mono=IBM Plex Mono`、`duration-fast`）。

### 2.0 共用 token 增補（先加呢啲，下面組件先有得用）

| Token | 值 | 用途 | 點解唔撞紅線 |
|---|---|---|---|
| `boxShadow.soft` | `0 4px 24px -8px rgba(30,37,48,.10)` | LiveSummaryPanel、選中 OptionCard、StepHeader 卡 | 石墨灰 tint，非綠 glow |
| `boxShadow.glow`（選用） | `0 8px 28px -8px rgba(59,70,88,.30)` | 選中 OptionCard hover 強調 | 石墨灰 glow，重映射自佢嘅綠 glow |
| 衍生 `accent-50` | `#EEF0F3`（`#3B4658` @ ~8%） | OptionCard 選中淺底、active step 底、hint 中性底 | 石墨灰，非綠 50 |
| `font-mono` + `tabular-nums` | 現有 | 所有數字／分數／`0X` 徽章／路徑箭咀 | — |

> 註：`accent-50` 可以直接用 utility `bg-blue/5` 或定義一個 `surface-accent` token，二擇其一；建議顯式加 `colors["accent-50"] = "#EEF0F3"` 方便重用，唔好成日用 opacity（opacity 喺深底會走樣）。
> 同時修正既有 **token drift**（`PrecisionRuler` / Q2 MC-band SVG 硬編 `#2B59C3 #E3DFD6 #5A6069`）——順手換成 `#3B4658 / #E4E7EC / #5F6976`，等新組件同舊 SVG 一致。

---

### 2.1 `OptionCard` —— 編號 icon-tile 選擇卡（旗艦組件，對應 owner #39）

**用途**：任何「揀一種類型／情境／模式」嘅單選或多選。取代而家散落各處嘅 segmented button（Q3 mode、scenario constraint、deck templates、ask tabs preset 等）。

**解剖**（DOM 次序，整張 `<button>`／`<label>` 為點擊目標）：
```
button.group  text-left  flex items-start gap-3  p-4  rounded-card  border-2  transition-all duration-fast
 ├─ [ICON TILE]  div  h-12 w-12 shrink-0  rounded-ctl  grid place-items-center
 │     └─ <TypeIcon/> | <FnIcon/> | icons.tsx 圖示  (w-7 h-7)
 └─ div.flex-1.min-w-0
      ├─ div.flex.items-center.gap-2
      │     ├─ [NUMBER BADGE]  span  font-mono font-bold text-[11px]  px-1.5 py-0.5 rounded-ctl
      │     │      └─ "01" (zero-padded；可選，由 prop 控制)
      │     └─ [TITLE]  h4  text-base font-medium
      └─ [SUBLINE]  p  text-xs text-ink2  mt-1.5
             └─ "點對點搬運｜可同日棄置"  ← 用 ｜(U+FF5C) 分隔 2–4 facet
```

**狀態 → token 映射**：

| 狀態 | 邊框 | 底 | icon tile | 徽章 | 陰影 |
|---|---|---|---|---|---|
| 預設 | `border-line` | `bg-surface` | `bg-paper text-ink2` | `bg-paper text-ink2` | — |
| hover | `border-blue/40` | `bg-accent-50/60` | group-hover `text-ink` | — | — |
| 選中 | `border-blue`（2px） | `bg-accent-50` | **實心** `bg-blue text-white` | **實心** `bg-blue text-white` | `shadow-soft`（+ hover `shadow-glow`） |
| disabled | `border-line` | `bg-surface` | `text-line` | — | `opacity-50 cursor-not-allowed` |

**鐵律**：**只有一個 accent（石墨灰）**。唔好學 PriceRight 用第二隻黃做「進階卡」。要區分 subtype（例如「進階情境」），用一個 outline 文字 chip（`text-[10px] uppercase tracking-wider border-line`）或一個 `FnChip`，**唔用色相**。卡內如果要顯示 Pokémon 資料（例如揀屬性），先至可以出 `TypeChip` 嘅 data color——呢個係 data，唔係 chrome。

**API 草稿**：
```ts
interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;          // TypeIcon / FnIcon / icons.tsx
  badge?: string;           // "01"；唔傳就唔出徽章
  title: string;
  subline?: string;         // 已含 ｜ 的字串，或 string[] 內部 join("｜")
  disabled?: boolean;
  subtypeTag?: string;      // 替代「第二 accent」的 outline 文字 chip
}
```

**容器**：`OptionGrid` = `div.grid gap-3 sm:grid-cols-2 lg:grid-cols-3`（1→2→3 欄 reflow），外層包一個 `SectionHeader`（見 §2.5）。

---

### 2.2 `StepHeader` / `Stepper` —— 頁內步進器（非全域導覽）

**用途**：俾有自然次序嘅頁內流程（Q2 builder、Import Wizard、組牌工坊、Tracker、Prizes 句式）。**唔取代 TopNav**——TopNav 仍然係 11 個 workspace 嘅全域切換。

**解剖**：
```
ol.flex.gap-2  (print:hidden)
 └─ li.flex-1
      button  rounded-card border-2  px-3 py-2  flex items-center gap-2.5  transition-all duration-fast
        ├─ [CHIP]  h-8 w-8 rounded-ctl  grid place-items-center  font-mono font-bold text-sm
        │     └─ 編號 | ✓(done, icons.tsx 勾) | 🔒(locked, icons.tsx 鎖)
        └─ (hidden sm:block) div
              ├─ [LABEL]  text-sm font-medium  truncate
              └─ [SUBLINE] text-[10px] text-ink2  truncate   ← "日期 ｜ 時段 ｜ 路線"
```

**狀態（鍵：`current` / `done(id<current)` / `locked(id>maxStep)`）**：

| 狀態 | 卡 | chip |
|---|---|---|
| current | `border-blue bg-accent-50 shadow-soft` | `bg-blue text-white`（顯示編號） |
| done | `bg-surface border-blue/30 hover:border-blue` | `bg-accent-50 text-blue`（顯示 ✓） |
| locked | `bg-surface border-line opacity-50 cursor-not-allowed`，`aria-disabled`，`title="請先完成前面步驟的必填欄位才能前往此步"` | `bg-paper text-line`（顯示 🔒） |
| 未到（>current, ≤maxStep） | `bg-surface border-line` | `bg-paper text-ink2`（顯示編號） |

**行為**：撳 done 步可以跳返去；向前只可以去到 `maxStep`（gating 同 Next 鍵雙重把關）。手機只顯示 chip（label/subline `hidden sm:block`）。

**API 草稿**：
```ts
interface Step { id: number; label: string; subline: string; }
interface StepperProps {
  steps: Step[];
  current: number;
  maxStep: number;
  onJump: (id: number) => void;
}
```

**配套 Prev/Next footer nav**（`mt-6 flex items-center justify-between print:hidden`）：
- 左：`btn-ghost`「上一步」（step 1 時 disabled）；
- 右（step<last）：`btn-primary`「下一步」，未過驗證 `disabled:opacity-50 cursor-not-allowed` ＋ tooltip「請完成所有必填欄位才能進入下一步」；
- 右（last step）：換成終端 CTA，**我哋語境**唔係電話，而係「計算 / 睇數學收據 / 分享」。

---

### 2.3 `LiveSummaryPanel` —— 右（我哋係左）側 sticky 儀表讀數

**用途**：升級現有 `DeckSummary` aside，成為全域恆常嘅「儀器讀數」。任何 workspace 嘅主概率都打喺呢度，永遠在線。

**解剖（top→bottom，`sticky top-24 space-y-3`）**：

**A) 頭條數字卡（唯一深色面）**
```
div.rounded-card  p-5  bg-blue  text-white  shadow-soft
 ├─ eyebrow   p  text-[11px] uppercase tracking-widest text-white/60   → "起手抽到基礎寶可夢概率"
 ├─ number    p  text-headline font-mono font-black tabular-nums leading-none  → "84.6%"  (0 時顯示 "—")
 ├─ subline   p  text-xs text-white/60  → "重抽條件下 ｜ 有效起手 88.6%"
 └─ (divider border-t border-white/15) 次要數字 → fraction · oneIn (text-sm font-mono)
```
> 深面用 `blue #3B4658`，白字。**唔好**用 PriceRight 嘅黃色高亮做次數字——次數字用 `text-white/80` 或一個極克制嘅高亮（仍係石墨灰系），唔引入第二色。

**B) 「快速狀態」帳目卡（mini math-receipt）**
```
div.rounded-card border hairline bg-surface p-4
 ├─ eyebrow  p  text-[11px] uppercase tracking-widest text-ink2 font-bold  → "快速狀態"
 └─ ul.space-y-2.text-xs
      └─ li.flex.justify-between → label(text-ink2) · value(font-mono font-medium text-ink tabular-nums)
            • 牌組總數 → 60/60
            • 基礎寶可夢 → 12 張
            • 條件 → 重抽感知
            • 抽牌數 → 7
      └─ (條件 pill) "✓ 已套用重抽條件"  ← chip，石墨灰 tint，唔用綠
```

**C) Empty state**（無牌組／無 query）：置中 icon ＋「尚未產生概率」＋「請先喺左側揀／建立牌組，引擎先會計算。」

> 注意：呢個係 `DeckSummary` 嘅自然演化——而家已經有 total/60、basics、mulligan ＋ ProofNumber ＋ PrecisionRuler。升級 = 把 mulligan 區改造成「深色頭條 + 帳目」嘅儀表佈局，並俾**當前 workspace** 注入佢自己嘅頭條數字（透過 selector，唔喺組件做數）。`ProofNumber` 嘅 √ proof popover 保留喺頭條數字側邊。

---

### 2.4 `HintBar` —— 色彩分級 contextual 教學條

**用途**：每個重要選項／toggle 旁邊解釋「呢個選擇會改變咩」；阻擋性驗證列「仲差以下項目」。

**解剖**：
```
div.rounded-card border-2  p-4  flex items-start gap-2.5  text-sm
 ├─ [ICON]  shrink-0 mt-0.5  (icons.tsx：Warn / Info / Rotate …)
 └─ div  → 文字，關鍵詞用 font-medium 強調（唔用色強調）
```

**Variant → token（紅線：色相石墨灰化，語意色只做 transient state）**：

| Variant | 用途 | 邊框 / 底 / 文字 |
|---|---|---|
| `neutral`（預設） | 中性說明、「呢個選擇會改變咩」 | `border-line` · `bg-paper` · `text-ink` |
| `consequence` | 後果提示（對應佢嘅黃） | `border-line` · `bg-accent-50` · `text-ink`（**石墨灰**化，非黃） |
| `reward` | 獎勵／命中（對應佢嘅綠） | `border-line` · `bg-accent-50` · `text-ink` ＋ 前置 ✓ ／ ✨ emoji（**唔用綠底**，綠撞草系） |
| `blocking` | 阻擋性驗證「仲差以下項目：」 | `border-bad/40` · `bg-bad/5` · `text-bad` ＋ 缺項 `<ul>` |
| `caution` | 注意（如 not-60、無基礎、合規提示） | `border-warn/40` · `bg-warn/5` · `text-warn` |

> `blocking`／`caution` 用我哋既有語意色 `bad/warn`，但只做**短暫狀態**（錯誤／注意），唔做面 accent——同 `DeltaBadge`、Tracker 合規 amber note 嘅既有用法一致。`consequence`／`reward` 一律石墨灰，用 emoji（✓ ✨ ℹ️ ⚠️）做語意標記而非色相。

**API 草稿**：
```ts
interface HintBarProps {
  variant?: "neutral" | "consequence" | "reward" | "blocking" | "caution";
  icon?: ReactNode;
  children: ReactNode;       // blocking 時可傳缺項 string[]
}
```

---

### 2.5 `SectionHeader` —— 卡頭（標題 ＋ `｜` 副標 ＋ 助手句）

**用途**：統一每個 section／卡嘅頭部，注入 PriceRight 嘅「標題 + `｜` 副標 + 助手 helper 句」節奏。取代而家散亂嘅 `h2 text-xl + ink2 subtitle`。

**解剖**：
```
header.mb-4
 ├─ div.flex.items-center.gap-2
 │     ├─ [ICON] icons.tsx  (可選)
 │     └─ h2/h3  text-xl font-medium  → 標題
 ├─ p  text-[11px] uppercase tracking-widest text-ink2 font-bold mt-1  → "明細 ｜ 備註 ｜ 訂金" 型 ｜ 副標 (可選)
 └─ p  text-xs text-ink2 mt-1.5  → 助手句「系統會根據選項自動調整…」
```

> `｜` 副標係 PriceRight signature——「標題 + ｜分隔 facet 列」呢個 pattern 喺 step／option／summary 到處出現，採納佢做我哋 section 嘅統一節奏。助手句借**語氣**（誠實、教學），術語守鎖。

---

### 2.6 共用 button class（統一幾何，只差填色——全部石墨灰）

對齊 PriceRight 嘅 `.btn / .btn-primary / .btn-ghost / .btn-secondary` 同幾何，但填色全部石墨灰：
```
.btn         = inline-flex items-center justify-center gap-2 rounded-ctl px-5 py-2.5 text-sm font-medium
               transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed
.btn-primary  = .btn  bg-blue text-white            (hover: 輕微加深 / shadow-soft)
.btn-ghost    = .btn  border hairline bg-surface text-ink2 hover:bg-paper hover:text-ink
.btn-secondary= .btn  border-2 border-blue text-blue bg-surface   (取代佢嘅黃 secondary)
```
> 我哋而家 segmented/tab 已有「active `bg-blue text-white` / inactive `border hairline bg-surface text-ink2`」嘅 helper——直接同呢套 button class 合流，全產品一套幾何。

---

## 3. 逐 workspace 映射（11 個 + Ask 5 內頁）

> 原則：① 有自然次序嘅頁 → 上 `Stepper/StepHeader`；② 所有頁 → 頭條數字打去 `LiveSummaryPanel`；③ 所有「揀類型/模式」→ 換 `OptionCard`；④ 所有「呢個選擇會點」→ 加 `HintBar`；⑤ 所有卡頭 → 換 `SectionHeader`。**主調石墨灰不變。**

| Workspace | 借嘅 pattern | 具體改動 |
|---|---|---|
| **deck（牌組）** | OptionCard · SectionHeader · LiveSummary | Empty state 嘅 4 個 primary action → `OptionGrid` 嘅 4 張 `OptionCard`（icon tile：import/builder/blank/templates；`01–04` 徽章；`｜` 副標講每個做咩）。7 個 toolbar icon 鍵維持，但統一 `btn-ghost`。LiveSummaryPanel 顯示 total/basics/mulligan 頭條。 |
| **decks（牌組推薦）** | OptionCard · HintBar | ArchetypeCard accordion 保留，但 BuildRow 嘅 tier/placing pill 統一 chip 解剖；amber tierNote → `HintBar caution`。Owner #40「系列選擇器」：同 carry 嘅 decks 用 `OptionGrid` 排成一個系列卡欄（每張係 `OptionCard`，subline = 賽事＋日期 `｜` 分隔）。 |
| **report（體檢）** | LiveSummary · SectionHeader · HintBar | 每個 Section 換 `SectionHeader`（加 `｜` 副標）。guard/Cta 狀態 → `HintBar neutral`。分享鍵 → `btn-primary`。頭條 mulligan 同步去 LiveSummaryPanel。 |
| **trial（試抽桌）** | HintBar · OptionCard | amber notes（not-60 / no-basics）→ `HintBar caution`。發 1/10/100 → `btn-primary/ghost`。seed 模式如有多選 → 可考慮 OptionCard。 |
| **midgame（中局）** | StepHeader · HintBar · LiveSummary | 三個 calculator 用 `StepHeader`（情境分析 / 中局核心 / 洗回）做頁內分段，或維持 flex-col 但每段加 `SectionHeader`。constraint `<select>`（ge/eq/le）可換細 OptionCard。raw `<details>` 推導 → 對齊 MathReceipt 視覺。「實際意義」box → `HintBar consequence`。 |
| **battle（對戰）** | LiveSummary · OptionCard · HintBar | DrawHud 嘅 target `<select>` → OptionCard（any-Basic / named card）。draw odds 頭條保留 ProofNumber √ proof，並 echo 去 LiveSummaryPanel。control bar 統一 button class。回合限制提示 → `HintBar caution`。 |
| **ask（提問）** | **Stepper（旗艦）** · OptionCard · LiveSummary · HintBar | 5 個 tab（q1/q2/curve/grade/tools）改造：Q2 desktop sentence builder ＋ mobile `Q2Wizard` 正式上 `Stepper`（① 揀牌組 → ② 設句式條件 → ③ 結果＋收據），鎖步＋Prev/Next＋「仲差以下項目」`HintBar blocking`。PresetStrip chips 統一 chip 解剖。MulliganDashboard 三聯卡 ＝ LiveSummary 帳目嘅延伸。 |
| **prizes（獎賞卡）** | OptionCard · StepHeader · LiveSummary · HintBar | Q3 mode segmented（uncond/givenHand/preGame）→ 3 張 `OptionCard`（`01–03`，`｜` 副標講每個 conditioning 意思），ⓘ info line → `HintBar neutral`。句式控制行維持 sentence 風但對齊節奏。headline + E + baseline direction → LiveSummaryPanel。 |
| **compare（A/B 比較）** | SectionHeader · LiveSummary | 3-col [A｜Delta｜B] 保留——`DeltaBadge` 係**唯一受認可語意色**，不動。query 行統一控件節奏。可選：頂部加細 `StepHeader`（揀 A → 揀 B → 比較）。 |
| **trainer（訓練）** | OptionCard · HintBar · SectionHeader | 三模式（直覺訓練／LuckMeter／FallacyMuseum）入口 → `OptionGrid` 3 張 `OptionCard`。FallacyMuseum 嘅 wrong(bad)/right(good) 對照係正當語意色，保留。猜 % 後 reveal 嘅誤差 pp 着色（good/warn/bad）保留。 |
| **tracker（追蹤器）** | StepHeader · HintBar · LiveSummary | 設定（prizesTaken / seen）可上輕量 `StepHeader`。永久 amber 合規 note → `HintBar caution`（保留 amber）。每卡概率列頭條（atLeastOne/still/next）可摘要去 LiveSummaryPanel。 |

**全域（App.tsx / TopNav）**：
- TopNav **維持** 11 tab 全域導覽，active `bg-blue`——**唔加 stepper**（stepper 係頁內）。可借 PriceRight header line-2 嘅「版本標籤」節奏：tagline 旁加 `· V…`（`text-[11px] text-ink2`）。
- 加 PriceRight 嘅**手機 live chip**：當有主概率時，TopNav 右側出一個 `font-mono` pill 顯示當前頭條（手機收起 aside 時都見到讀數）。
- 主 grid 維持 `lg:grid-cols-[300px_minmax(0,1fr)]`（我哋左 aside），aside = 升級後 `LiveSummaryPanel`，`hidden lg:block print:hidden`。

---

## 4. 分階段落地計劃

四階段，每階段獨立可 ship、每個 commit 跑 `verify:seed` ＋ `/ship-check`。**唔郁 `src/lib/prob/` 任何數學**（呢次純表達層）。

### Phase 1 — 基建（token ＋ 5 個組件 ＋ 旗艦頁試點）
**目標**：建立組件系統，喺一個高價值頁（ask Q2 或 prizes Q3）落地驗證，唔掂其餘 10 頁。
**DoD**：5 個組件入 Storybook-style 展示頁或直接接入 1 個 workspace；新 token 加入 config；token drift 修正；`/ship-check` 綠；i18n parity；主調仍石墨灰（grep 確認無新增綠/黃/藍 hex 做 chrome）。

**Phase 1 任務清單（具體）**：
1. `tailwind.config.js`：加 `boxShadow.soft`、`boxShadow.glow`（石墨灰）、`colors["accent-50"]="#EEF0F3"`。
2. 修 token drift：`PrecisionRuler.tsx` ＋ Q2 MC-band SVG 硬編 hex → `#3B4658/#E4E7EC/#5F6976`。
3. 統一 button class：建 `Button.tsx`（或 `buttonClass()` helper）出 `btn / btn-primary / btn-ghost / btn-secondary`，合流現有 segmented helper。
4. 建 `src/components/ui/SectionHeader.tsx`（§2.5）。
5. 建 `src/components/ui/HintBar.tsx`（§2.4，5 variant，色相石墨灰化）。
6. 建 `src/components/ui/OptionCard.tsx` ＋ `OptionGrid`（§2.1，單一石墨灰 accent，icon/badge/subline/subtypeTag）。
7. 建 `src/components/ui/Stepper.tsx`（§2.2，current/done/locked ＋ onJump ＋ maxStep gating）＋ `StepNav`（Prev/Next）。
8. 重構 `DeckSummary.tsx` → `LiveSummaryPanel`（§2.3：深色頭條卡 ＋ 快速狀態帳目 ＋ empty state；保留 ProofNumber √）。
9. 試點接入：**prizes Q3 mode** 改用 3 張 `OptionCard`（`01–03` ＋ `｜` 副標）＋ mode `HintBar neutral`——細範圍、易驗證、即見效。
10. i18n：所有新文案落 i18n（zh-Hant 主、en 次），加廣東話祈使（下一步／上一步／計算／睇收據）＋ 誠實對沖句；術語鎖檢查（概率/獎賞卡/基礎寶可夢/重抽）。
11. 跑 `node --experimental-strip-types scripts/verify_seed.ts`（必須 `ALL GOLDEN VECTORS PASS`）＋ `/ship-check`。
12. 寫低決策入 `docs/DECISIONS.md`（單一 accent、色相石墨灰化、stepper=頁內非全域）；同步更新 `docs/04_UI_UX_SPEC.md`。

### Phase 2 — 旗艦流程（ask Q2 ＋ 組牌工坊上 Stepper）
- ask Q2 desktop builder ＋ `Q2Wizard` 正式上 `Stepper`（① 牌組 → ② 條件 → ③ 結果＋收據），鎖步 ＋ `HintBar blocking`「仲差以下項目」。
- `DeckBuilderDialog`（組牌工坊，#1 旗艦）分層 filter chip 對齊 chip 解剖；live deck bar 對齊 LiveSummaryPanel 頭條節奏。
- deck empty-state 4 action → `OptionGrid`。
- TopNav 加手機 live chip ＋ 版本標籤。

### Phase 3 — 廣鋪（report / midgame / prizes / trial / battle / trainer）
- 逐頁換 `SectionHeader` ＋ `HintBar` ＋ OptionCard（按 §3 表）。
- midgame raw `<details>` 推導 → 對齊 MathReceipt 視覺；trainer 三模式入口 → OptionGrid。
- 每頁頭條同步 LiveSummaryPanel。

### Phase 4 — 收尾（decks 系列選擇器 #40 / tracker / compare / 文檔）
- decks owner #40 系列選擇器（同 carry decks 排成系列 OptionGrid）。
- tracker / compare 輕量 StepHeader。
- 全面 i18n parity、`docs/04_UI_UX_SPEC.md` palette 章節重寫（清掉舊 Iono 描述）、`docs/DECISIONS.md` 補完。
- 全產品 grep float-leak ＋ chrome 色相審計（確認零綠/黃/藍做主調）。

---

## 5. 驗收清單（每階段 gate）

- [ ] **主調石墨灰**：grep 全 `src/`，UI chrome（chrome，非 data）無任何 `#7EBC60 / #FFCE46 / #2E8ECF / 綠/黃/藍` 做 accent；飽和色只出現喺 `typeColors.ts` / `fnColors.ts` / 三語意 token。
- [ ] **單一 accent**：OptionCard / Stepper 選中態只有石墨灰，無第二色 accent；subtype 用 outline/文字 chip 區分。
- [ ] **數學完整**：`verify:seed` ＝ `ALL GOLDEN VECTORS PASS`；`src/lib/prob/` 零改動；無 float leak。
- [ ] **三格式概率**：所有頭條仍係 percent ＋ fraction ＋ 1-in-N ＋ 數學收據／ProofNumber。
- [ ] **術語鎖**：概率（非機率）／獎賞卡／基礎寶可夢／重抽（Mulligan），zh-Hant 書面語 docs、廣東話 UI 語氣、英文 code。
- [ ] **i18n parity**：zh-Hant ＋ en ＋ tri 三 locale 無缺 key。
- [ ] **rhythm**：圓角守我哋 `ctl 8 / card 14` 階梯；間距採 `gap-3 / p-5 sm:p-6 / space-y-5 / min-h-[64px]`；數字 `font-mono tabular-nums`。
- [ ] **mono 數字**：所有數字／分數／`0X` 徽章／路徑箭咀用 IBM Plex Mono。
- [ ] `/ship-check` 綠。

---

## 6. 明確「借 vs 唔借」總表（俾 reviewer 一眼睇）

| 維度 | 借（layout/IA/互動/解剖/節奏/語氣） | 唔借（色相主調） |
|---|---|---|
| Stepper IA（active/done✓/locked🔒 ＋ 跳步 ＋ maxStep gating） | ✅ 改造成頁內 StepHeader | — |
| `lg:[1fr_360px]` sticky live-summary ＋ 深色頭條數字面 | ✅（我哋係左 aside `[300px_1fr]`；深面用 `#3B4658`） | ❌ 黃色訂金高亮 |
| 編號 OptionCard（icon tile ＋ `0X` ＋ `｜` 兩行描述） | ✅ owner #39 | ❌ 綠/黃選中 ＋ 綠/黃 進階第二 accent |
| 色彩分級 HintBar（consequence/reward/blocking/caution/neutral） | ✅ 解剖＋教學語氣 | ❌ 綠底/黃底；色相一律石墨灰化，語意色只做 transient state |
| 間距節奏（`gap-3 / p-5 sm:p-6 / space-y-5 / min-h-64`） | ✅ | ❌ 佢嘅 12/16 圓角（守我哋 8/14） |
| signature soft shadow | ✅ 石墨灰 tint 版 `rgba(30,37,48,.10)` | ❌ 綠 glow（重映射成石墨灰 `rgba(59,70,88,.30)`） |
| 微文案（短促祈使、廣東話、誠實對沖、emoji 語意標記、變數展開器） | ✅（emoji OK，唔係色） | ❌ 搬屋字眼／機率字 ❌ 破術語鎖 |
| `｜` 副標 pattern（標題 + facet 列） | ✅ SectionHeader / OptionCard / Stepper | — |
| 全域導覽 | 維持 TopNav 11 tab（stepper 係頁內，唔取代佢） | ❌ 唔將 wizard 變成全域唯一流程 |

---

### 附：相關檔案路徑（絕對路徑，供實作）
- Token：`C:\Users\user\Desktop\ptcg-prob-lab\tailwind.config.js`
- 全域 shell / 導覽：`C:\Users\user\Desktop\ptcg-prob-lab\src\App.tsx`、`C:\Users\user\Desktop\ptcg-prob-lab\src\components\TopNav.tsx`
- 待升級成 LiveSummaryPanel：`C:\Users\user\Desktop\ptcg-prob-lab\src\components\DeckSummary.tsx`
- 既有 proof / 收據（保留並對齊）：`...\src\components\MathReceipt.tsx`、`...\src\components\ProofNumber.tsx`、`...\src\components\PrecisionRuler.tsx`（修 token drift）
- data-color 原子（OptionCard icon/tint 來源）：`...\src\data\typeColors.ts`、`...\src\data\fnColors.ts`、`...\src\components\TypeChip.tsx`、`...\src\components\FnChip.tsx`、`...\src\components\icons.tsx`
- 新組件建議目錄：`C:\Users\user\Desktop\ptcg-prob-lab\src\components\ui\`（`OptionCard.tsx`、`Stepper.tsx`、`HintBar.tsx`、`SectionHeader.tsx`、`LiveSummaryPanel.tsx`、`Button.tsx`）
- 決策／規格同步：`...\docs\DECISIONS.md`（新建/補）、`...\docs\04_UI_UX_SPEC.md`（palette 章重寫）