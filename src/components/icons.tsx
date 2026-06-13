/**
 * Original single-color stroke icon set (docs/04 §2 2026-06-12 revision).
 * Hand-drawn geometry — no third-party icon library, no emoji, no official
 * symbols. stroke=currentColor so icons inherit the text color of their
 * control; aria-hidden because every usage sits beside a visible label or
 * inside a labelled button.
 */

import type { ReactNode } from "react";

/** Info-icon props: colored by `className` (text color), `sm` for inline use. */
export interface IconProps {
  className?: string;
  size?: "sm" | "md";
}

function I({ children, size = "md", className = "" }: IconProps & { children: ReactNode }) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${dim} shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

/** 牌組 — two stacked cards. */
export function IconDeck() {
  return (
    <I>
      <rect x="2.5" y="4.5" width="8.5" height="9" rx="1.5" />
      <path d="M6 2.5h6a1.5 1.5 0 0 1 1.5 1.5v7.5" />
    </I>
  );
}

/** 體檢 — clipboard with a check. */
export function IconReport() {
  return (
    <I>
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" />
      <path d="m5.5 8.5 2 2 3.5-4.5" />
    </I>
  );
}

/** 試抽 — a die. */
export function IconTrial() {
  return (
    <I>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <circle cx="5.7" cy="5.7" r="0.4" fill="currentColor" />
      <circle cx="10.3" cy="10.3" r="0.4" fill="currentColor" />
      <circle cx="8" cy="8" r="0.4" fill="currentColor" />
    </I>
  );
}

/** 提問 — speech bubble. */
export function IconAsk() {
  return (
    <I>
      <path d="M8 2.5a5.5 5.5 0 1 1-4 9.3L2.5 13.5l.7-2.7A5.5 5.5 0 0 1 8 2.5Z" />
      <circle cx="8" cy="8" r="0.4" fill="currentColor" />
    </I>
  );
}

/** 獎賞卡 — five-point star. */
export function IconPrizes() {
  return (
    <I>
      <path d="m8 2.2 1.7 3.5 3.8.6-2.7 2.7.6 3.8L8 11l-3.4 1.8.6-3.8-2.7-2.7 3.8-.6L8 2.2Z" />
    </I>
  );
}

/** 比較 — two bars of different height. */
export function IconCompare() {
  return (
    <I>
      <rect x="3" y="7.5" width="3.5" height="6" rx="0.8" />
      <rect x="9.5" y="3" width="3.5" height="10.5" rx="0.8" />
    </I>
  );
}

/** 訓練 — target rings. */
export function IconTrainer() {
  return (
    <I>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="8" cy="8" r="0.4" fill="currentColor" />
    </I>
  );
}

/** 追蹤 — an eye. */
export function IconTracker() {
  return (
    <I>
      <path d="M1.8 8C3.6 4.8 5.8 3.2 8 3.2S12.4 4.8 14.2 8c-1.8 3.2-4 4.8-6.2 4.8S3.6 11.2 1.8 8Z" />
      <circle cx="8" cy="8" r="1.8" />
    </I>
  );
}

/** 視覺組牌 — 2×2 grid with one tile filled. */
export function IconBuilder() {
  return (
    <I>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" fill="currentColor" stroke="none" />
    </I>
  );
}

/** 匯入 — arrow into a tray. */
export function IconImport() {
  return (
    <I>
      <path d="M8 2.5v7M5.5 7 8 9.5 10.5 7" />
      <path d="M3 10.5v2A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </I>
  );
}

/** 匯出 — arrow out of a tray. */
export function IconExport() {
  return (
    <I>
      <path d="M8 9.5v-7M5.5 5 8 2.5 10.5 5" />
      <path d="M3 10.5v2A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </I>
  );
}

/** 牌表 — document with lines. */
export function IconSheet() {
  return (
    <I>
      <rect x="3.5" y="2" width="9" height="12" rx="1.5" />
      <path d="M6 5.5h4M6 8h4M6 10.5h2.5" />
    </I>
  );
}

/** 基礎名單 — a tag. */
export function IconTag() {
  return (
    <I>
      <path d="M2.5 7.5v-4a1 1 0 0 1 1-1h4L13 8l-5 5-5.5-5.5Z" />
      <circle cx="5.5" cy="5.5" r="0.4" fill="currentColor" />
    </I>
  );
}

/** 別名 — chain link. */
export function IconLink() {
  return (
    <I>
      <path d="M6.5 9.5 9.5 6.5" />
      <path d="m7 4.8 1.3-1.3a2.5 2.5 0 0 1 3.5 3.5L10.5 8.3" />
      <path d="m9 11.2-1.3 1.3a2.5 2.5 0 0 1-3.5-3.5L5.5 7.7" />
    </I>
  );
}

/** 範本 — stacked boxes. */
export function IconTemplate() {
  return (
    <I>
      <rect x="2.5" y="2.5" width="11" height="4" rx="1" />
      <rect x="2.5" y="9.5" width="4.5" height="4" rx="1" />
      <rect x="9" y="9.5" width="4.5" height="4" rx="1" />
    </I>
  );
}

/** 牌組推薦 — trophy. */
export function IconDecks() {
  return (
    <I>
      <path d="M5 2.5h6v3a3 3 0 0 1-6 0v-3Z" />
      <path d="M5 3.5H3.2v1a2 2 0 0 0 2 2M11 3.5h1.8v1a2 2 0 0 1-2 2" />
      <path d="M8 8.5v2M5.8 13.5h4.4M6.5 13.5c0-1.2.7-2 1.5-2s1.5.8 1.5 2" />
    </I>
  );
}

/** 中局 — hourglass (the game clock is running). */
export function IconMidgame() {
  return (
    <I>
      <path d="M4 2.5h8M4 13.5h8" />
      <path d="M5 2.5v2.2c0 1.8 3 2.5 3 3.3 0 .8-3 1.5-3 3.3v2.2M11 2.5v2.2c0 1.8-3 2.5-3 3.3 0 .8 3 1.5 3 3.3v2.2" />
    </I>
  );
}

/** 搜尋 — magnifier. */
export function IconSearch() {
  return (
    <I>
      <circle cx="7" cy="7" r="4.2" />
      <path d="m10.2 10.2 3.3 3.3" />
    </I>
  );
}

// ---------------------------------------------------------------------------
// Info icons (audit 2026-06-14) — small, color-by-text glyphs that sit beside a
// data value so players grok it at a glance. All accept {className,size}; pass a
// text-color class to tint (e.g. text-bad for weakness, text-good for legal).

/** HP — a heart. */
export function IconHP(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 13.2S3 9.7 3 6.6A2.5 2.5 0 0 1 8 5.1a2.5 2.5 0 0 1 5 1.5C13 9.7 8 13.2 8 13.2Z" />
    </I>
  );
}

/** 弱點 — down triangle over a baseline (takes more damage). */
export function IconWeakness(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 11 4 5h8L8 11Z" />
      <path d="M3.5 13.5h9" />
    </I>
  );
}

/** 抗性 — a shield (reduces damage). */
export function IconResistance(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 2.6 12.8 4.6V8.4c0 3-2.1 4.8-4.8 5.6C5.3 13.2 3.2 11.4 3.2 8.4V4.6L8 2.6Z" />
    </I>
  );
}

/** 撤退 — a back-turning arrow. */
export function IconRetreat(p: IconProps) {
  return (
    <I {...p}>
      <path d="M9 4 5 8l4 4" />
      <path d="M5 8h7" />
    </I>
  );
}

/** 階級 — rising steps (Basic → Stage 1 → Stage 2). */
export function IconStage(p: IconProps) {
  return (
    <I {...p}>
      <path d="M3 12.5h3.2v-3h3.2v-3h3.4" />
    </I>
  );
}

/** 合法 — a circled check. */
export function IconLegal(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="m5 8 2 2.2 4-4.4" />
    </I>
  );
}

/** 不合法 — a circled cross. */
export function IconIllegal(p: IconProps) {
  return (
    <I {...p}>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 5.5 10.5 10.5M10.5 5.5 5.5 10.5" />
    </I>
  );
}

/** 人氣 — a flame. */
export function IconFlame(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 2c1 2.5 4 3.5 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 .4 1.8 1 2.2C7.4 5.5 7.5 3.6 8 2Z" />
    </I>
  );
}

/** 能量 — a droplet. */
export function IconEnergy(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 2.2C10.4 5.2 12 7.3 12 9.4a4 4 0 0 1-8 0c0-2.1 1.6-4.2 4-7.2Z" />
    </I>
  );
}

/** 警告 — a triangle with a bang. */
export function IconWarn(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 2.8 14 13H2L8 2.8Z" />
      <path d="M8 6.8v3" />
      <circle cx="8" cy="11.4" r="0.5" fill="currentColor" />
    </I>
  );
}

/** 重抽／輪替 — a circular return arrow. */
export function IconRotate(p: IconProps) {
  return (
    <I {...p}>
      <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" />
      <path d="M12.5 3.5V6H10" />
    </I>
  );
}

/** Trend up — used for positive pp deltas. */
export function IconArrowUp(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
    </I>
  );
}

/** Trend down — used for negative pp deltas. */
export function IconArrowDown(p: IconProps) {
  return (
    <I {...p}>
      <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
    </I>
  );
}
