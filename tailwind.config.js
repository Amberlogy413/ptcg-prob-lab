/**
 * Design tokens (docs/04_UI_UX_SPEC.md §2). 2026-06-14 — owner dropped the 奇樹
 * (Iono) blue+pink scheme for a TYPE-ORIENTED system: a neutral graphite frame
 * so the only chroma in the app is DATA color (Pokémon type colors in
 * typeColors.ts + function colors in fnColors.ts) plus the three semantics.
 * The `blue`/`pink` keys are kept for stability but now hold neutral/flame
 * values (no longer Iono twins).
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      // Neutral graphite frame — lets type/function colors lead.
      paper: "#FAFBFC", // global background (near-white neutral)
      surface: "#FFFFFF", // cards
      ink: "#1E2530", // primary text (graphite)
      ink2: "#5F6976", // secondary text (neutral slate)
      line: "#E4E7EC", // hairline (neutral)
      // `blue` = primary actions/nav/focus → neutral graphite-slate (the single
      // UI accent). `pink` = popularity/"hot" highlight → flame (semantic).
      blue: "#3B4658",
      "accent-50": "#EEF0F3", // blue @ ~8% — option-card/step selected wash, neutral hints (graphite, NOT a new hue)
      pink: "#CC5A33",
      good: "#0E7A4A", // emerald: favorable / rising delta / ideal hand
      warn: "#B45309", // amber: caution / playable hand
      bad: "#B3261E", // crimson: unfavorable / falling delta / dead hand
      receipt: "#FCFCFD", // receipt paper (neutral white)
    },
    fontFamily: {
      sans: ['"Noto Sans TC"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
      mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    },
    fontSize: {
      xs: ["12px", { lineHeight: "1.5" }],
      sm: ["13.5px", { lineHeight: "1.5" }],
      base: ["15px", { lineHeight: "1.6" }],
      lg: ["18px", { lineHeight: "1.5" }],
      xl: ["24px", { lineHeight: "1.35" }],
      "2xl": ["36px", { lineHeight: "1.2" }],
      headline: ["clamp(40px, 9vw, 72px)", { lineHeight: "1.05" }],
    },
    borderRadius: {
      none: "0",
      ctl: "8px", // controls (humanized, 2026-06-12 revision)
      card: "14px", // cards
      full: "9999px",
    },
    extend: {
      spacing: {
        // 4px scale is Tailwind's default; nothing extra needed.
      },
      boxShadow: {
        // The math receipt's signature shadow.
        receipt: "0 1px 2px rgba(21, 24, 28, 0.08), 0 4px 12px rgba(21, 24, 28, 0.06)",
        // Design-system shadows (docs/07) — graphite-tinted, NOT a green glow.
        soft: "0 4px 24px -8px rgba(30, 37, 48, 0.10)",
        glow: "0 8px 28px -8px rgba(59, 70, 88, 0.30)",
      },
      transitionDuration: {
        fast: "120ms",
      },
    },
  },
  plugins: [],
};
