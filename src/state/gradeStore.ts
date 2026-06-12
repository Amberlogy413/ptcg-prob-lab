/**
 * Hand-grade definitions (理想手/可用手), lifted out of GradeSection's local
 * state in P9.1 so the math health report reads the SAME definitions the
 * grading view edits — consistency by construction. Ephemeral on purpose:
 * grades describe a question, not deck data (no persist key).
 */

import { create } from "zustand";
import type { GradeCardDef } from "./q5.ts";

interface GradeState {
  ideal: GradeCardDef[];
  playable: GradeCardDef[];
  setIdeal: (defs: GradeCardDef[]) => void;
  setPlayable: (defs: GradeCardDef[]) => void;
}

export const useGradeStore = create<GradeState>()((set) => ({
  ideal: [],
  playable: [],
  setIdeal: (ideal) => set({ ideal }),
  setPlayable: (playable) => set({ playable }),
}));
