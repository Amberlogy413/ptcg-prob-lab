# 05 — 測試計畫(TEST PLAN)

> 信任是本產品唯一的賣點,測試就是產品本身。本計畫分六層;**A 層(黃金測試)是法律**:黃金測試失敗時,錯的永遠是程式碼,不是向量。

## A. 黃金測試(雙獨立實作交叉驗證)

- 來源:`scripts/generate_golden.py` 用 Python 標準庫 `fractions` **獨立**實作全部公式(不共享任何程式碼),輸出 `tests/golden/golden_vectors.json`。目前 27 案例、507 斷言。
- 驗證:`scripts/verify_seed.ts` 把每個案例餵進 TS 核心,要求:
  - 既約分數字串 `"n/d"` **逐字元相等**;
  - 15 位 round-half-up 小數(`*_dec` 欄)**逐字元相等**(同時驗證 `format.decimalStr`)。
- 產生器內建恆等式 assert(向量出廠前自檢):各 pmf 精確總和 = 1;可交換性(模式 (c) 取消條件化後 == 模式 (a) 直接公式);p_valid 與 Q1 的 valid 交叉相等。
- 鐵律:
  1. `tests/golden/golden_vectors.json` 嚴禁手改;只能改產生器後重新生成。
  2. 新功能 = 先在產生器加案例與恆等式 → 重新生成 → 再寫 TS → 驗證器加對應 kind。流程已封裝為 `/new-question` 指令。
  3. Phase 0 把驗證器移植成 Vitest spec 後,Node 直跑版(`npm run verify:seed`)仍保留於 CI 作第二道防線。

## B. 性質測試(Vitest,對隨機參數)

對隨機合法參數(N≤60、各 count、約束)斷言**精確**等式(用 `eq`,絕不用近似比較):
1. `Σ_k hypergeomPmf(N,K,n,k) = 1`;多類別同理(枚舉 compositions 加總 = 1)。
2. Vandermonde:`Σ_k C(a,k)·C(b,n−k) = C(a+b,n)`(以 `binom` 驗)。
3. 互補:`hypergeomAtLeast(…,w) + hypergeomAtMost(…,w−1) = 1`。
4. 條件化守恆:`comboOpening` 條件表加總 = 1;`event = Σ(滿足列)`;`eventUnconditioned = event(無條件呼叫)`。
5. 可交換性:`prizeDistPreGame(x,{conditionOnValid:false})` 與 `prizeDistUnconditional(x)` 逐項相等。
6. 線性:`expectedPrizedUnconditional(x) = rat(6x, 60)`;`openingBasics.expectedBasics = rat(7B,60)`。
7. 退化界:約束 [0,7] 全卡 → event = 1;count=0 卡 → 分布集中於 k=0。
8. `decimalStr` 性質:進位邊界(`9995/10000, 3 位 → "1.000"`)、places=0、負數;`oneInStr(0) = "—"`。

## C. 跨實作擴充協定

任何新數學(例:Mulligan-aware 回合曲線)必須:規格(02)新增小節 → Python 產生器新增 kind+恆等式 → 重生成 → TS 實作 → 驗證器新增 dispatch → 全綠。兩實作**禁止**互相翻譯程式碼;以公式各自獨立實作,差異即 bug 偵測器。

## D. 蒙地卡羅對賬(驗證與教學用,非答案來源)

- 模擬器:Fisher–Yates 洗 60 張,完整重演規則(含重抽迴圈、取 6 獎賞、逐回合抽牌),可注入種子(mulberry32 之類的小型可種子 PRNG)以重現。
- 自動化:每個黃金 kind 抽 1–2 案例,n = 1,000,000 局,斷言 `|p̂ − p| < 5σ`,σ = √(p(1−p)/n)。此測試標記 `slow`,CI 夜間或手動跑。
- UI「驗證」按鈕:Worker 跑 100,000 局,展示模擬值、95% 信賴帶與精確值並列(04 §6)。

## E. UI 與整合測試

- Builder → 核心參數對應快照:每種句型組合產生的 `comboOpening/prize*` 呼叫參數正確(這層最容易把「至多」接成「至少」)。
- 三格式渲染一致性:任取結果,百分比/分數/1-in-N 三者由同一 `Rat` 派生(分數還原後相等)。
- 匯入解析:PTCG Live 樣本(正常/缺區段/含空行/非 60 張)夾具測試。
- 分享 URL 來回:encode→decode 後 deck+query 深度相等;壞字串走友善錯誤路徑。
- i18n 鍵集合 zh-Hant == en(腳本比對)。

## F. 手動 QA 清單(每 Phase 收尾)

- [ ] `npm run verify:seed` 與 Vitest 全綠;`/ship-check` 通過。
- [ ] 02 §8 錨點表抽 3 條在 UI 重現,逐位核對。
- [ ] 重抽開關切換:頭條值、對照行、收據「條件化」行三處同步更新。
- [ ] 鍵盤走完一次完整查詢;讀屏唸出頭條三格式。
- [ ] 行動寬度 360px:精靈流程可完成、頭條數字不破版。
- [ ] 離線(關網)重載:既有牌組與查詢可用。

## CI 門(順序即優先級)

`tsc --noEmit` → Vitest(單元+性質+黃金)→ `npm run verify:seed`(Node 直跑)→ ESLint + 浮點守門 grep(03 §10)→ build。任何一步紅 = 不得合併。
