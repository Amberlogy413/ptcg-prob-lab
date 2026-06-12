/**
 * P9.3 training loop: the trial table can hand a freshly dealt hand to the
 * trainer as a question ("how likely was this hand?"). Ephemeral by design —
 * the pending question describes a moment, not deck data.
 */

import { create } from "zustand";
import type { TrainerKind, TrainerQuestion } from "./q5.ts";

export interface PendingQuestion {
  kind: TrainerKind;
  q: TrainerQuestion;
}

interface TrainerState {
  pending: PendingQuestion | null;
  setPending: (p: PendingQuestion | null) => void;
}

export const useTrainerStore = create<TrainerState>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
