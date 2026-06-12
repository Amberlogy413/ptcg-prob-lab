# PTCG 概率實驗室 · PTCG Probability Lab

**zh-Hant** — 全 client-side 的「牌組概率計量儀器」:對 60 張 PTCG 牌組做**精確**(BigInt 既約分數、零浮點誤差)的抽卡與獎賞卡概率計算。每個概率都以三格式呈現(百分比/精確分數/「1 in N」),附可展開、可複製的**數學收據**;所有涉及起手的問題預設**含 Mulligan(重抽)修正**——這正是市面上計算器集體算錯的地方。零後端、零遙測、可離線(PWA)。

**en** — A fully client-side "measuring instrument" for 60-card Pokémon TCG deck probability: **exact** BigInt reduced fractions, zero float error. Every probability ships in three formats (percent / exact fraction / "1 in N") with an expandable, copyable **math receipt**; every opening-hand question is **mulligan-aware by default** — the correction most calculators get wrong. No backend, no telemetry, offline-capable (PWA).

## 功能 / Features

| 工作區 | 內容 |
|---|---|
| 牌組 | 行編輯器、60 計數環、多牌組管理、PTCG Live 匯入精靈(強制基礎寶可夢標記)/匯出、容錯匯入(「4 卡名」「卡名 x4」、中文段落標題)+ 外部工具搬家三步指南、**範本牌組庫**(六副純文字構築骨架,徽章即精確重抽率)、牌組圖卡 PNG(自帶精確徽章)、賽事登錄牌表列印(原創排版)、**輪替預覽**(賽制標記 → 退場灰顯 → 精確前後對照 → 一鍵分叉)、社群基礎名單 JSON、卡名別名對照 |
| **體檢** | **牌組數學體檢報告**:一頁全套——重抽率、品質分級、關鍵組合(重抽條件化)、能量斷流、獎賞風險——逐項可展開數學收據,與各工作區完全一致;可分享圖卡 PNG |
| **試抽桌** | 種子化誠實發牌(起手/獎賞/第一抽,真重抽循環)+ ×100 批次統計疊精確值與 95% 信賴帶;**Goldfish 逐回合**(樣本與精確曲線並排、接力事件檢查);任意一手一鍵變訓練題 |
| 提問 | **Q1** 基礎與重抽儀表板 · **Q2** 句子式查詢建構器(殺手示範:含重抽 15.383618% vs 天真 11.404965%)+ 蒙地卡羅驗證掣 + 敏感度掃描 + 分享連結 + PNG 圖卡 · **回合曲線**(含能量斷流、多回合接力)· **品質分級**(理想/可用/死手 + 死手歸因排行榜)· **構築工具**(檢索鏈摺疊、局部優化器) |
| 獎賞卡 | Q3 三模式(賽前無條件/已知手牌/賽前·含重抽)+ 多卡聯合 + 預設十問/題庫/自訂快捷 + CSV 匯出 |
| 比較 | A/B 牌組同題對照,±pp delta 徽章,一鍵分叉 |
| 訓練 | 概率直覺訓練(用你牌組的真實數字出題,**接駁試抽閉環**)+ 運氣儀表 + 謬誤互動博物館 |
| 追蹤器 | 對局獎賞卡後驗追蹤(含常駐賽事合規提醒) |

> v1.1.0 起的「體檢/試抽桌」與牌組工具擴充,源自對市場現有工具的深度對照分析(`docs/08_COMPETITOR_ANALYSIS.md`):凡是合規(全 client-side、IP 安全)的功能全數對齊,並逐項疊上現有工具都沒有的精確數學;體檢報告與「樣本貼住精確值收斂」的教學是本品獨有。

## 信任從何而來 / Why trust it

1. **雙獨立實作交叉驗證**:獨立 Python `fractions` 產生器 vs TypeScript BigInt 核心,逐字元比對(含 15 位 round-half-up 小數)。種子管線 27 案例/507 斷言;v2 管線(能量斷流、運氣尾概率、接力事件、檢索鏈摺疊、優化器枚舉)16 案例,**全數通過**。
2. **數學收據**:每個結果可展開公式代入過程,任何人可手工覆核;收據引用對應黃金向量 id。
3. **謬誤免疫**:獨立相乘、二項近似、忽略重抽、期望當概率——`docs/02 §9` 全列,訓練工作區有互動演示。

## 開發 / Development

需求:Node 22+(Python 3 僅在重新生成黃金向量時需要)。

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck && npm test && npm run verify:seed   # 全綠才算數
npm run build        # 產出 dist/(全靜態,任何靜態主機可部署)
```

黃金管線:

```bash
npm run verify:seed                    # 種子核心 vs 獨立 Python 參考(27 案例/507 斷言)
python3 scripts/generate_golden.py     # 重生成種子向量(內建恆等式自檢;受保護,勿手改)
python3 scripts/generate_golden_v2.py  # 重生成 v2 向量(種子後新數學)
```

規格在 `docs/01–07`(zh-Hant);裁決紀錄在 `docs/DECISIONS.md`;Claude Code 指導文件為 `CLAUDE.md`。內建指令:`/verify-math`、`/ship-check`、`/new-question`(新題型必走雙實作管線)。

## 一眼看出它在算什麼 / A taste of the math

| 問題 | 精確值 | ≈ |
|---|---|---|
| 4 投卡在起手 7 張中至少 1 張 | 38962/97527 | 39.949963% |
| 10 張基礎寶可夢的重抽率 | 75670/292581 | 25.862923% |
| A(4投,基礎)+B(3投)各至少 1 —— 真實對局(含重抽) | 11011691/71580630 | 15.383618% |
| 同上,天真算法(忽略重抽) | 11011691/96551730 | 11.404965% |
| 1 投卡被放入獎賞卡 | 1/10 | 恰好 10% |

## 聲明 / Disclaimer

非官方粉絲工具,與 The Pokémon Company / Nintendo / Creatures / GAME FREAK 無關;不使用任何官方圖像或標誌。對局追蹤器僅供練習與覆盤——正式比賽使用外部工具可能違反賽事規定。Unofficial fan tool; not affiliated with The Pokémon Company, Nintendo, Creatures, or GAME FREAK; no official artwork or logos are used. The in-game tracker is for practice and review only — using external tools in sanctioned play may violate tournament rules.

卡牌目錄之文字資料(卡名、HP、招式等遊戲事實)取自社群開源資料庫 [TCGdex](https://tcgdex.dev)(zh-tw),由 `scripts/fetch_catalog.mjs` 一次性抓取並**於源頭剝除所有卡圖與價格欄位**;卡牌文字之權利屬原權利人。Card catalog text data (names, HP, attacks — game facts) comes from the community-run [TCGdex](https://tcgdex.dev) database (zh-tw), fetched once by `scripts/fetch_catalog.mjs` with **all image and pricing fields stripped at the source**; card text rights belong to their respective owners.
