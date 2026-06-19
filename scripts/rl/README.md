# `scripts/rl/` — 離線強化學習訓練骨架(真‧神經網絡 AI 第③–④步)

呢個係 docs/11_AI_AGENT.md「七步走」嘅 **離線訓練管線骨架**。對戰沙盤已經有
規則引擎(`src/engine`)、Observation、特徵向量同啟發式 bot;呢度將佢接落 Python,
等你可以喺有 GPU 嘅機(離線)真係訓練一個自我對弈嘅 agent。

## 誠實前提(必讀)

- **訓練一定離線、要 GPU**,跑幾個鐘到幾日;**唔可以喺我哋零後端嘅 web app 入面跑**。
  app 將來最多只可以做**推論**(載入訓練好嘅權重即時出招)。
- **引擎係忠實子集**(docs/11 §5 —— 唔係每張卡效都建模)。agent 嘅上限取決於環境,
  所以**最大嘅未完成工作係第①步(逐張卡效)**;呢個骨架只係令訓練「跑得起」。
- PPO script 係**起點,唔係調好嘅 trainer**(單次 REINFORCE+baseline 更新,留低 GAE/
  clip/entropy/league 等 TODO)。

## 架構(單一規則來源)

```
ppo_selfplay.py  (PyTorch, 離線+GPU)
      │  reset / step / legal / obs   ← Gym 式介面
      ▼
gym_env.py       (Python, 無 torch 依賴)
      │  JSON lines over stdin/stdout (subprocess)
      ▼
engine_server.ts (Node, node --experimental-strip-types)
      │  直接 import
      ▼
src/engine       (TypeScript 純規則引擎 —— 同 app 用嘅係同一份)
```

規則只有**一份**(TS 引擎)。Python 完全唔重寫規則,所以唔會同 app 分叉。

## 點跑

```bash
# 1) 環境煙霧測試(只需 Node 22+,無 Python 依賴):隨機策略跑幾局到分勝負
python scripts/rl/gym_env.py
# 預期:每個 seed steps>0、done=True

# 2) 訓練(需 GPU 機;先裝 deps)
pip install -r scripts/rl/requirements.txt
python scripts/rl/ppo_selfplay.py --iters 50 --episodes 16
# 產出 scripts/rl/agent.pt

# 3) (將來,第⑥/⑦步)匯出 ONNX / tf.js → 喺瀏覽器做推論
```

## 檔案

| 檔案 | 作用 |
|---|---|
| `engine_server.ts` | Node JSON 橋:驅動 `src/engine` 嘅 `BattleEnv`(reset/step/legal/obs),載入真 catalog,提供一副可戰示範牌組 |
| `gym_env.py` | Gym 式 Python env:spawn 上面個橋,經 JSON lines 傾;含隨機策略煙霧測試 |
| `ppo_selfplay.py` | PPO 自我對弈骨架(策略+價值網絡,按合法動作集評分取樣) |
| `requirements.txt` | `numpy` + `torch`(只訓練先需要) |

## 下一步(令 agent 真係有用)

1. **補齊第①步卡效**(最大投資)—— 環境越真,學到嘅策略越有意義。
2. 升級 PPO:GAE(λ)、clipped surrogate、entropy bonus、frozen-opponent league。
3. 觀察編碼加**牌張身分**(而家只係各區張數 + 戰鬥場對位,見 `encodeObservation`)。
4. 匯出權重 → `onnxruntime-web` / `tf.js` 喺 app 做推論(會新增依賴,需你拍板)。
