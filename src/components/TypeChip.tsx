/**
 * Pokémon type chip — DATA color + original mini icon per type (docs/04 §2
 * revision two). Type colors are data-encoding colors (like chart colors),
 * applied only to type identity, never as UI decoration. Icons are original
 * simple geometry, deliberately unlike the official energy symbols.
 */

import type { ReactNode } from "react";
import { useT } from "../i18n/index.ts";
import { typeKey } from "../data/catalog.ts";
import { TYPE_COLORS } from "../data/typeColors.ts";

function glyph(type: string): ReactNode {
  switch (type) {
    case "Grass": // leaf
      return <path d="M3 13C3 7 7 3 13 3c0 6-4 10-10 10Zm0 0c2-4 5-7 8-8" />;
    case "Fire": // flame
      return <path d="M8 2c1 2.5 4 3.5 4 7a4 4 0 0 1-8 0c0-2 1-3 2-4 0 1 .4 1.8 1 2.2C7.4 5.5 7.5 3.6 8 2Z" />;
    case "Water": // droplet
      return <path d="M8 2.2C10.4 5.2 12 7.3 12 9.4a4 4 0 0 1-8 0c0-2.1 1.6-4.2 4-7.2Z" />;
    case "Lightning": // bolt
      return <path d="M9.5 2 4 9h3.2L6.5 14 12 7H8.8L9.5 2Z" />;
    case "Psychic": // spiral
      return <path d="M8 8c0-1 .9-1.8 2-1.8S12 7.2 12 8.6 10.6 11.4 8 11.4 3 9.6 3 7.2 5.2 3 8 3c2.4 0 4.4 1.4 5 3.4" />;
    case "Fighting": // fist (rounded square + knuckle lines)
      return (
        <>
          <rect x="3.5" y="5" width="9" height="7.5" rx="2" />
          <path d="M6.2 5v2.4M8.5 5v2.4M10.8 5v2.4" />
        </>
      );
    case "Darkness": // crescent
      return <path d="M11.8 11.5A5.3 5.3 0 0 1 5 4.2a5.3 5.3 0 1 0 6.8 7.3Z" />;
    case "Metal": // hex nut
      return (
        <>
          <path d="M8 2.5 12.8 5.2v5.6L8 13.5 3.2 10.8V5.2L8 2.5Z" />
          <circle cx="8" cy="8" r="1.6" />
        </>
      );
    case "Dragon": // angular wing
      return <path d="M2.5 12C5 11 6 9.5 6.5 7.5c2 1 4-.5 4.5-2.5 1 1.5 2.5 2 2.5 2-1 4-4.5 6.5-8 6.5-1.2 0-2.3-.5-3-1.5Z" />;
    case "Fairy": // sparkle
      return <path d="M8 2.5 9.3 6.7 13.5 8l-4.2 1.3L8 13.5 6.7 9.3 2.5 8l4.2-1.3L8 2.5Z" />;
    default: // Colorless — four-point star
      return <path d="M8 2.8 9.6 6.4 13.2 8 9.6 9.6 8 13.2 6.4 9.6 2.8 8l3.6-1.6L8 2.8Z" />;
  }
}

/** Small inline icon, stroke in the type's data color (or currentColor). */
export function TypeIcon({ type }: { type: string }) {
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
      {glyph(type)}
    </svg>
  );
}

interface TypeChipProps {
  type: string;
  /** Solid fill (selected chips); default is the tinted pastel look. */
  solid?: boolean;
}

/** Labelled chip: icon + zh type name, colored by the type's data color. */
export function TypeChip({ type, solid }: TypeChipProps) {
  const t = useT();
  const key = typeKey(type);
  const label = key !== null ? t(key) : type;
  const color = TYPE_COLORS[type] ?? "#8A9298";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-xs"
      style={
        solid
          ? { backgroundColor: color, borderColor: color, color: "#FFFFFF" }
          : { backgroundColor: `${color}1A`, borderColor: `${color}55`, color }
      }
    >
      <TypeIcon type={type} />
      {label}
    </span>
  );
}
