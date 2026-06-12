/**
 * Original single-color stroke icon set (docs/04 §2 2026-06-12 revision).
 * Hand-drawn geometry — no third-party icon library, no emoji, no official
 * symbols. stroke=currentColor so icons inherit the text color of their
 * control; aria-hidden because every usage sits beside a visible label or
 * inside a labelled button.
 */

import type { ReactNode, SVGProps } from "react";

function I({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
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
      className={"h-4 w-4 shrink-0 " + (props.className ?? "")}
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
