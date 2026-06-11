import { useT } from "../i18n/index.ts";
import { DECK_SIZE } from "../constants.ts";

/** The 60-card count ring (docs/04 §6). Blue when exactly 60. */
export function CountRing({ total }: { total: number }) {
  const t = useT();
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, total / DECK_SIZE));
  const exact = total === DECK_SIZE;
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      role="img"
      aria-label={t("deck.count.aria", { n: total })}
      className="shrink-0"
    >
      <circle cx="32" cy="32" r={r} fill="none" stroke="#E3DFD6" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={exact ? "#2B59C3" : "#5A6069"}
        strokeWidth="4"
        strokeDasharray={`${c * frac} ${c}`}
        strokeLinecap="butt"
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="31"
        textAnchor="middle"
        dominantBaseline="middle"
        className="font-mono"
        fontSize="16"
        fill="#15181C"
      >
        {total}
      </text>
      <text
        x="32"
        y="45"
        textAnchor="middle"
        className="font-mono"
        fontSize="9"
        fill="#5A6069"
      >
        /{DECK_SIZE}
      </text>
    </svg>
  );
}
