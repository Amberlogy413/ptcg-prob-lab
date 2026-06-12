/**
 * 預設十問 (PRD §4-14, docs/06 Phase 4): canonical one-click questions.
 * Eight fill the Q3 builder with fixed parameters (anchors from docs/02 §5),
 * one fills the prize joint demo, one jumps to the deck's own Q1 mulligan
 * rate. Design mapping recorded in docs/DECISIONS.md.
 */

import type { Q3Mode, Q3JointRowInput } from "./q3.ts";
import type { Q3SingleState } from "./q3Store.ts";

export type PresetDef =
  | {
      id: string;
      labelKey: string;
      labelParams?: Record<string, string | number>;
      kind: "q3single";
      mode: Q3Mode;
      single: Partial<Q3SingleState>;
    }
  | {
      id: string;
      labelKey: string;
      kind: "q3joint";
      rows: Array<Omit<Q3JointRowInput, "id">>;
    }
  | { id: string; labelKey: string; kind: "gotoQ1" };

export const PRESET_TEN: PresetDef[] = [
  {
    id: "aceSpec",
    labelKey: "preset.aceSpec",
    kind: "q3single",
    mode: "uncond",
    single: { x: 1, h: 0 },
  },
  {
    id: "x4Prized",
    labelKey: "preset.x4Prized",
    kind: "q3single",
    mode: "uncond",
    single: { x: 4, h: 0 },
  },
  {
    id: "x3Prized",
    labelKey: "preset.x3Prized",
    kind: "q3single",
    mode: "uncond",
    single: { x: 3, h: 0 },
  },
  {
    id: "x2Prized",
    labelKey: "preset.x2Prized",
    kind: "q3single",
    mode: "uncond",
    single: { x: 2, h: 0 },
  },
  {
    id: "x4h1",
    labelKey: "preset.x4h1",
    kind: "q3single",
    mode: "givenHand",
    single: { x: 4, h: 1 },
  },
  {
    id: "x4h0",
    labelKey: "preset.x4h0",
    kind: "q3single",
    mode: "givenHand",
    single: { x: 4, h: 0 },
  },
  {
    id: "basicPrized",
    labelKey: "preset.basicPrized",
    kind: "q3single",
    mode: "preGame",
    single: { x: 4, h: 0, isBasic: true, otherBasics: 6 },
  },
  {
    id: "nonbasicPrized",
    labelKey: "preset.nonbasicPrized",
    kind: "q3single",
    mode: "preGame",
    single: { x: 4, h: 0, isBasic: false, otherBasics: 10 },
  },
  {
    id: "jointDemo",
    labelKey: "preset.jointDemo",
    kind: "q3joint",
    rows: [
      { label: "A", count: 4, inHand: 1, min: 1, max: 6 },
      { label: "B", count: 3, inHand: 0, min: 1, max: 6 },
    ],
  },
  { id: "mulliganRate", labelKey: "preset.mulliganRate", kind: "gotoQ1" },
];


/** D3 question bank: generated canonical Q3 questions (beyond the ten). */
export const GENERATED_BANK: PresetDef[] = [1, 2, 3, 4].flatMap((x) => [
  {
    id: `bank_uncond_x${x}`,
    labelKey: "bank.prized",
    labelParams: { x },
    kind: "q3single" as const,
    mode: "uncond" as const,
    single: { x, h: 0 },
  },
  {
    id: `bank_h0_x${x}`,
    labelKey: "bank.prizedH0",
    labelParams: { x },
    kind: "q3single" as const,
    mode: "givenHand" as const,
    single: { x, h: 0 },
  },
  {
    id: `bank_h1_x${x}`,
    labelKey: "bank.prizedH1",
    labelParams: { x },
    kind: "q3single" as const,
    mode: "givenHand" as const,
    single: { x, h: 1 },
  },
]);
