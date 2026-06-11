/**
 * The precision ruler (docs/04 §5): a horizontal 0–100% scale with 10% major
 * and 5% minor ticks, a blue cursor pressed on the value. The aria-label must
 * carry the exact value (docs/04 §8).
 */

interface PrecisionRulerProps {
  /** Position in [0, 1] — chart-bridge float, display only. */
  value: number;
  ariaLabel: string;
  /** Show 0 / 50 / 100 endpoint labels (result-card size). */
  labels?: boolean;
}

export function PrecisionRuler({ value, ariaLabel, labels = false }: PrecisionRulerProps) {
  const w = 240;
  const h = labels ? 26 : 18;
  const base = labels ? 18 : h;
  const x = Math.max(0, Math.min(1, value)) * w;
  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const major = i % 2 === 0;
    ticks.push(
      <line
        key={i}
        x1={(i / 20) * w}
        y1={base}
        x2={(i / 20) * w}
        y2={base - (major ? 7 : 4)}
        stroke="#E3DFD6"
        strokeWidth="1"
      />,
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full max-w-md" role="img" aria-label={ariaLabel}>
      <line x1="0" y1={base - 0.5} x2={w} y2={base - 0.5} stroke="#E3DFD6" strokeWidth="1" />
      {ticks}
      <line x1={x} y1={base} x2={x} y2={2} stroke="#2B59C3" strokeWidth="2" />
      {labels && (
        <>
          <text x="0" y={h} fontSize="6.5" fill="#5A6069" className="font-mono">
            0%
          </text>
          <text x={w / 2} y={h} fontSize="6.5" fill="#5A6069" textAnchor="middle" className="font-mono">
            50%
          </text>
          <text x={w} y={h} fontSize="6.5" fill="#5A6069" textAnchor="end" className="font-mono">
            100%
          </text>
        </>
      )}
    </svg>
  );
}
