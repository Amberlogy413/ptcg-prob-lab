/**
 * Design tokens per docs/04_UI_UX_SPEC.md §2 — these values are hard spec.
 * Colors are replaced (not extended): the product allows exactly one accent
 * color (blue) plus the three semantic colors, used only for good/bad/delta.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      paper: "#FBF5F7", // global background (sakura paper, 2026-06-12 revision)
      surface: "#FFFFFF", // cards
      ink: "#32222B", // primary text (warm plum ink)
      ink2: "#7C5F6D", // secondary text (mauve)
      line: "#F1DCE5", // hairline (pink)
      // The single accent. Token KEY stays "blue" for class-name stability
      // across ~50 files; the VALUE is now sakura rose (docs/04 §2 revision).
      blue: "#C8447C",
      good: "#0E7A4A", // emerald: favorable / rising delta / ideal hand
      warn: "#B45309", // amber: caution / playable hand
      bad: "#B3261E", // crimson: unfavorable / falling delta / dead hand
      receipt: "#FFFBFC", // receipt paper (pink-white)
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
        // The ONLY shadow in the product — reserved for the math receipt.
        receipt: "0 1px 2px rgba(21, 24, 28, 0.08), 0 4px 12px rgba(21, 24, 28, 0.06)",
      },
      transitionDuration: {
        fast: "120ms",
      },
    },
  },
  plugins: [],
};
