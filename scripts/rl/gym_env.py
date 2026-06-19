"""Gym-style Python environment over the TypeScript rules engine (AI step ②).

The PTCG rules live in TypeScript (src/engine). Rather than re-implement them in
Python (divergence!), this env spawns the Node bridge (engine_server.ts) and talks
to it over JSON lines, so there is ONE rules source. A reinforcement-learning loop
(see ppo_selfplay.py) drives this exactly like a Gym env.

Run a random-policy smoke test:
    python3 scripts/rl/gym_env.py

Requires: Node 22+ (for `--experimental-strip-types`). No Python deps for the env
itself; only ppo_selfplay.py needs numpy/torch.

HONEST SCOPE: the engine is a faithful SUBSET (docs/11 §5). An agent trained here
learns that subset; completing every card effect is step ① (the bulk of the work).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVER = ["node", "--experimental-strip-types", "scripts/rl/engine_server.ts"]

# The observation feature vector length (encodeObservation in src/engine/env.ts).
OBS_DIM = 24


class BattleEnv:
    """One self-play battle as a Gym-style environment.

    Reward is from the POV of the player who just acted (+1 win / -1 loss / 0).
    The action space is DYNAMIC: each step exposes `legal` (a list of action dicts);
    a policy must pick one of them (action masking), not a fixed index.
    """

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            SERVER,
            cwd=str(REPO_ROOT),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,  # the bridge writes only JSON to stdout
            text=True,
            encoding="utf-8",  # the bridge emits UTF-8 (zh card names); don't use the OS codec
            bufsize=1,
        )
        ping = self._rpc({"cmd": "ping"})
        if not ping.get("ok"):
            raise RuntimeError(f"engine bridge failed to start: {ping}")
        self.has_catalog: bool = bool(ping.get("hasCatalog"))

    def _rpc(self, msg: dict[str, Any]) -> dict[str, Any]:
        assert self.proc.stdin is not None and self.proc.stdout is not None
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if line == "":
            raise RuntimeError("engine bridge closed unexpectedly")
        return json.loads(line)

    def reset(self, seed: int = 1) -> dict[str, Any]:
        """Start a fresh game. Returns {observation, vector, legal, done}."""
        return self._rpc({"cmd": "reset", "seed": int(seed) & 0xFFFFFFFF})

    def step(self, action: dict[str, Any]) -> dict[str, Any]:
        """Apply one legal action. Returns {observation, vector, reward, done, legal}."""
        return self._rpc({"cmd": "step", "action": action})

    def legal_actions(self) -> list[dict[str, Any]]:
        return self._rpc({"cmd": "legal"}).get("legal", [])

    def render(self) -> str:
        return self._rpc({"cmd": "render"}).get("render", "")

    def close(self) -> None:
        try:
            if self.proc.stdin is not None:
                self.proc.stdin.close()
            self.proc.terminate()
        except Exception:
            pass


def _random_episode(seed: int, max_steps: int = 400) -> dict[str, Any]:
    """Drive a full game with a uniform-random legal policy (a smoke test)."""
    import random

    rng = random.Random(seed)
    env = BattleEnv()
    try:
        state = env.reset(seed)
        steps = 0
        while not state["done"] and steps < max_steps:
            legal = state["legal"]
            if not legal:
                break
            state = env.step(rng.choice(legal))
            steps += 1
        return {"steps": steps, "done": state["done"], "final_reward": state.get("reward", 0), "has_catalog": env.has_catalog}
    finally:
        env.close()


if __name__ == "__main__":
    # Random-policy smoke test across a few seeds: every step must be a legal move,
    # and games should terminate (win / wipe / deck-out) within the cap.
    ok = True
    for s in (1, 2, 3):
        r = _random_episode(s)
        print(f"seed {s}: steps={r['steps']} done={r['done']} reward={r['final_reward']} catalog={r['has_catalog']}")
        if r["steps"] == 0:
            ok = False
    print("OK" if ok else "FAILED")
    sys.exit(0 if ok else 1)
