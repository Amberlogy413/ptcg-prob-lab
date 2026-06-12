/**
 * Q3 prize-query state (ephemeral, like the Q2 query store). The single-card
 * query supports a deck card OR a custom ×x — presets (PRD §4-14) fill it
 * one-click. Joint rows are manual (count / in-hand / prize constraint).
 */

import { create } from "zustand";
import { uid } from "../utils/uid.ts";
import { readJSON, writeJSON } from "../utils/storage.ts";
import type { Q3Mode, Q3JointRowInput } from "./q3.ts";

/** D3: user-saved Q3 quick questions (ppl.v1.customPresets). */
export interface CustomPreset {
  id: string;
  label: string;
  mode: Q3Mode;
  single: Q3SingleState;
}

const CUSTOM_PRESETS_KEY = "ppl.v1.customPresets";

export interface Q3SingleState {
  /** "custom" or a DeckCard id. */
  source: string;
  x: number;
  h: number;
  isBasic: boolean;
  otherBasics: number;
}

interface Q3StoreState {
  mode: Q3Mode;
  single: Q3SingleState;
  joint: Q3JointRowInput[];
  custom: CustomPreset[];
  setMode: (mode: Q3Mode) => void;
  setSingle: (patch: Partial<Q3SingleState>) => void;
  addJointRow: () => void;
  updateJointRow: (id: string, patch: Partial<Omit<Q3JointRowInput, "id">>) => void;
  removeJointRow: (id: string) => void;
  /** One-click preset fill (預設十問). */
  applySinglePreset: (mode: Q3Mode, single: Partial<Q3SingleState>) => void;
  applyJointPreset: (rows: Array<Omit<Q3JointRowInput, "id">>) => void;
  saveCustomPreset: (label: string) => void;
  removeCustomPreset: (id: string) => void;
}

const DEFAULT_SINGLE: Q3SingleState = {
  source: "custom",
  x: 4,
  h: 0,
  isBasic: false,
  otherBasics: 10,
};

export const useQ3Store = create<Q3StoreState>()((set, get) => ({
  mode: "uncond",
  single: DEFAULT_SINGLE,
  joint: [],
  custom: readJSON<CustomPreset[]>(CUSTOM_PRESETS_KEY) ?? [],
  setMode: (mode) => set({ mode }),
  setSingle: (patch) => set((s) => ({ single: { ...s.single, ...patch } })),
  addJointRow: () =>
    set((s) => ({
      joint: [
        ...s.joint,
        { id: uid(), label: "", count: 4, inHand: 0, min: 1, max: 6 },
      ],
    })),
  updateJointRow: (id, patch) =>
    set((s) => ({
      joint: s.joint.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  removeJointRow: (id) => set((s) => ({ joint: s.joint.filter((r) => r.id !== id) })),
  applySinglePreset: (mode, single) =>
    set((s) => ({ mode, single: { ...s.single, source: "custom", ...single } })),
  applyJointPreset: (rows) =>
    set({ joint: rows.map((r) => ({ ...r, id: uid() })) }),
  saveCustomPreset: (label) => {
    const trimmed = label.trim();
    if (trimmed === "") return;
    const { mode, single, custom } = get();
    const updated = [...custom, { id: uid(), label: trimmed, mode, single: { ...single } }].slice(-50);
    writeJSON(CUSTOM_PRESETS_KEY, updated);
    set({ custom: updated });
  },
  removeCustomPreset: (id) => {
    const updated = get().custom.filter((c) => c.id !== id);
    writeJSON(CUSTOM_PRESETS_KEY, updated);
    set({ custom: updated });
  },
}));
