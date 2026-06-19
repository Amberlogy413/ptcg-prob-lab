"""PPO self-play SKELETON for the PTCG agent (AI steps ③–④).

This is the OFFLINE training scaffold the owner asked for ("真神經網絡 AI"). It
trains a policy+value network by self-play against the TypeScript rules engine
(via gym_env.BattleEnv). It is a STARTING POINT, not a tuned trainer:

  * Real training needs a GPU and many iterations (hours+), run OFFLINE — never in
    the zero-backend web app. The app can only ever do INFERENCE on an exported net.
  * The engine is a faithful SUBSET (docs/11 §5); an agent is only as good as its
    environment, so the bulk of the remaining work is step ① (every card effect).
  * The action space is DYNAMIC (a per-step list of legal action dicts), so the
    policy SCORES each legal action (pointer-style) and samples over the legal set —
    there is no fixed action head / illegal-action masking needed.

Run (after `pip install -r scripts/rl/requirements.txt`):
    python scripts/rl/ppo_selfplay.py --iters 50 --episodes 16

Without torch installed it prints how to install and exits — the env itself
(gym_env.py) runs with no Python deps.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from gym_env import BattleEnv, OBS_DIM

try:
    import numpy as np
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
except ImportError:
    print("This skeleton needs numpy + torch. Install:\n  pip install -r scripts/rl/requirements.txt")
    sys.exit(0)

# --- Action encoding --------------------------------------------------------
# Each legal action is a dict like {"type":"attack","index":0} or
# {"type":"playToBench","iid":"p1-3"}. We encode it to a fixed feature vector so
# the policy can score a variable-length legal set.
ACTION_TYPES = [
    "playToActive", "playToBench", "evolve", "attachEnergy", "attachTool",
    "playStadium", "playSupporter", "playGust", "playSwitch", "search",
    "retreat", "attack", "promote", "endTurn",
]
ACT_DIM = len(ACTION_TYPES) + 1  # one-hot type + a single scalar (e.g. attack index)


def encode_action(a: dict[str, Any]) -> "np.ndarray":
    v = np.zeros(ACT_DIM, dtype=np.float32)
    t = a.get("type")
    if t in ACTION_TYPES:
        v[ACTION_TYPES.index(t)] = 1.0
    v[-1] = float(a.get("index", 0))  # attack index (0 otherwise)
    return v


# --- Network: a state encoder + a per-action scorer + a value head ----------
class PolicyValueNet(nn.Module):
    def __init__(self, obs_dim: int = OBS_DIM, act_dim: int = ACT_DIM, hidden: int = 128) -> None:
        super().__init__()
        self.state = nn.Sequential(nn.Linear(obs_dim, hidden), nn.ReLU(), nn.Linear(hidden, hidden), nn.ReLU())
        self.act = nn.Sequential(nn.Linear(act_dim, hidden), nn.ReLU())
        self.score = nn.Linear(hidden, hidden, bias=False)  # bilinear-ish state·action score
        self.value = nn.Linear(hidden, 1)

    def forward(self, obs: "torch.Tensor", acts: "torch.Tensor") -> tuple["torch.Tensor", "torch.Tensor"]:
        s = self.state(obs)                       # [hidden]
        a = self.act(acts)                        # [n_legal, hidden]
        logits = (a @ self.score(s))              # [n_legal] — score each legal action
        value = self.value(s).squeeze(-1)         # scalar
        return logits, value


def run_iteration(net: PolicyValueNet, opt: "torch.optim.Optimizer", episodes: int, gamma: float, seed0: int) -> dict[str, float]:
    """Collect `episodes` self-play games, then do one PPO-style update.

    NOTE: a production trainer would add GAE(λ), a clipped surrogate with multiple
    epochs, entropy bonus, minibatching, and a frozen-opponent league. This skeleton
    does a single REINFORCE-with-baseline update so the wiring is clear and runnable.
    """
    obs_buf, act_buf, idx_buf, logp_buf, val_buf, ret_buf = [], [], [], [], [], []
    wins = 0
    for e in range(episodes):
        env = BattleEnv()
        try:
            state = env.reset(seed0 + e)
            traj: list[tuple[Any, Any, int, float, float]] = []
            steps = 0
            while not state["done"] and steps < 400:
                legal = state["legal"]
                if not legal:
                    break
                obs_t = torch.tensor(state["vector"], dtype=torch.float32)
                acts_t = torch.tensor(np.stack([encode_action(a) for a in legal]), dtype=torch.float32)
                logits, value = net(obs_t, acts_t)
                dist = torch.distributions.Categorical(logits=logits)
                ai = int(dist.sample().item())
                traj.append((state["vector"], [encode_action(a) for a in legal], ai, float(dist.log_prob(torch.tensor(ai))), float(value)))
                state = env.step(legal[ai])
                steps += 1
            # Terminal reward from the LAST actor's POV; discount back through the trajectory.
            final = float(state.get("reward", 0))
            wins += 1 if final > 0 else 0
            g = final
            for (o, a, ai, lp, v) in reversed(traj):
                obs_buf.append(o); act_buf.append(a); idx_buf.append(ai); logp_buf.append(lp); val_buf.append(v); ret_buf.append(g)
                g *= gamma
        finally:
            env.close()

    if not obs_buf:
        return {"loss": 0.0, "winrate": 0.0, "samples": 0}

    # One update (REINFORCE + value baseline). Variable legal-set sizes → loop.
    opt.zero_grad()
    returns = torch.tensor(ret_buf, dtype=torch.float32)
    returns = (returns - returns.mean()) / (returns.std() + 1e-6)
    pol_loss = torch.zeros(())
    val_loss = torch.zeros(())
    for o, a, ai, ret in zip(obs_buf, act_buf, idx_buf, returns):
        logits, value = net(torch.tensor(o, dtype=torch.float32), torch.tensor(np.stack(a), dtype=torch.float32))
        logp = torch.distributions.Categorical(logits=logits).log_prob(torch.tensor(ai))
        adv = (ret - value).detach()
        pol_loss = pol_loss - logp * adv
        val_loss = val_loss + F.mse_loss(value, ret)
    loss = (pol_loss + 0.5 * val_loss) / len(obs_buf)
    loss.backward()
    opt.step()
    return {"loss": float(loss.item()), "winrate": wins / max(1, episodes), "samples": len(obs_buf)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--iters", type=int, default=10)
    ap.add_argument("--episodes", type=int, default=8)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--gamma", type=float, default=0.99)
    ap.add_argument("--out", type=str, default="scripts/rl/agent.pt")
    args = ap.parse_args()

    net = PolicyValueNet()
    opt = torch.optim.Adam(net.parameters(), lr=args.lr)
    for it in range(args.iters):
        stats = run_iteration(net, opt, args.episodes, args.gamma, seed0=1 + it * 1000)
        print(f"iter {it:3d}  loss={stats['loss']:.4f}  winrate={stats['winrate']:.2f}  samples={stats['samples']}")
    torch.save(net.state_dict(), args.out)
    print(f"saved {args.out}  (export to ONNX/tf.js for in-browser inference — step ⑥/⑦)")


if __name__ == "__main__":
    main()
