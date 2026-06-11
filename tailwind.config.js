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
      paper: "#FAF8F3", // global background (warm paper)
      surface: "#FFFFFF", // cards
      ink: "#15181C", // primary text
      ink2: "#5A6069", // secondary text
      line: "#E3DFD6", // hairline
      blue: "#2B59C3", // the single accent: buttons, active chips, links
      good: "#0E7A4A", // emerald: favorable / rising delta / ideal hand
      warn: "#B45309", // amber: caution / playable hand
      bad: "#B3261E", // crimson: unfavorable / falling delta / dead hand
      receipt: "#FFFEF9", // receipt paper
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
      ctl: "6px", // controls
      card: "10px", // cards
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
