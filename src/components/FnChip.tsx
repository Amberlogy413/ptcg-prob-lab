/**
 * Function-tag chip — SEMANTIC color + original stroke icon per function
 * (owner request 2026-06-14: 功能性、直觀、人性化 — show at a glance what a card
 * DOES). Mirrors TypeChip: original simple geometry, deliberately unlike any
 * official symbol. Colors live in src/data/fnColors.ts; labels in i18n (fnKey).
 */

import type { ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { fnKey } from "../data/catalog.ts";
import { fnColor } from "../data/fnColors.ts";

function glyph(tag: string): ReactNode {
  switch (tag) {
    case "attacker": // blade
      return (
        <>
          <path d="M3 13 11 5" />
          <path d="M9.5 3.5 12.5 6.5" />
          <path d="M3 11.2 4.8 13" />
        </>
      );
    case "boost": // double up-chevron
      return (
        <>
          <path d="M4 8.5 8 4.8l4 3.7" />
          <path d="M4 12 8 8.3l4 3.7" />
        </>
      );
    case "accel": // bolt
      return <path d="M9 2 4 9h3l-1 5 6-8H9l0-4Z" />;
    case "gust": // incoming arrow (pull up)
      return (
        <>
          <path d="M13 8H3.5" />
          <path d="M6.5 4.5 3 8l3.5 3.5" />
        </>
      );
    case "draw": // a card + a fanned card
      return (
        <>
          <rect x="3" y="6" width="6" height="7.2" rx="1" />
          <path d="M7 6V4.6a1 1 0 0 1 1-1h3.8a1 1 0 0 1 1 1V11" />
        </>
      );
    case "search": // magnifier
      return (
        <>
          <circle cx="7" cy="7" r="3.4" />
          <path d="M9.6 9.6 13 13" />
        </>
      );
    case "ability": // sparkle / 4-point star
      return <path d="M8 2.6 9.1 6.1 12.6 7.2 9.1 8.3 8 11.8 6.9 8.3 3.4 7.2 6.9 6.1Z" />;
    case "disrupt": // prohibition slash
      return (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="M4.5 4.5 11.5 11.5" />
        </>
      );
    case "protect": // shield
      return <path d="M8 2.6 12.8 4.6V8.4c0 3-2.1 4.8-4.8 5.6C5.3 13.2 3.2 11.4 3.2 8.4V4.6L8 2.6Z" />;
    case "heal": // heart
      return <path d="M8 13.2S3 9.7 3 6.6A2.5 2.5 0 0 1 8 5.1a2.5 2.5 0 0 1 5 1.5C13 9.7 8 13.2 8 13.2Z" />;
    case "recover": // circular return arrow
      return (
        <>
          <path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" />
          <path d="M12.5 3.5V6H10" />
        </>
      );
    default: // dot
      return <circle cx="8" cy="8" r="2" />;
  }
}

/** Small inline function icon, stroke in the tag's semantic color (or currentColor). */
export function FnIcon({ tag }: { tag: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
    >
      {glyph(tag)}
    </svg>
  );
}

interface FnChipProps {
  tag: string;
  /** Solid fill (selected filter chips); default is the tinted look. */
  solid?: boolean;
  /** Icon only, label in a tooltip (tight spots like card tiles). */
  compact?: boolean;
}

/** Labelled chip: icon + zh function name, colored by the tag's semantic color. */
export function FnChip({ tag, solid, compact }: FnChipProps) {
  const t = useT();
  const key = fnKey(tag);
  const label = key !== null ? t(key) : tag;
  const color = fnColor(tag);
  return (
    <span
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs" +
        (compact ? " px-1" : "")
      }
      style={
        solid
          ? { backgroundColor: color, borderColor: color, color: "#FFFFFF" }
          : { backgroundColor: `${color}1A`, borderColor: `${color}55`, color }
      }
    >
      <FnIcon tag={tag} />
      {!compact && label}
    </span>
  );
}
