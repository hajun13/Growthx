'use client';

export interface ProgressDonutProps {
  done: number;
  total: number;
  size?: number;
  label?: string;
}

export function ProgressDonut({
  done,
  total,
  size = 64,
  label,
}: ProgressDonutProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const center = label ?? `${done}/${total}`;

  return (
    <div
      role="img"
      aria-label={`완료 ${done}/${total}, ${pct}%`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-foreground"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums text-foreground">
        {center}
      </span>
    </div>
  );
}
