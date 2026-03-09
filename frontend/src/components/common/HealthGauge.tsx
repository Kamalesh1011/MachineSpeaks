interface HealthGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthGauge({ score, size = 'md', showLabel = false }: HealthGaugeProps) {
  const dims = { sm: 40, md: 72, lg: 120 };
  const strokes = { sm: 3, md: 5, lg: 6 };
  const fonts = { sm: 'text-[11px]', md: 'text-base', lg: 'text-2xl' };
  
  const d = dims[size];
  const s = strokes[size];
  const r = (d - s) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;

  const color = pct >= 80 ? 'hsl(var(--status-healthy))' : pct >= 50 ? 'hsl(var(--status-warning))' : 'hsl(var(--status-critical))';
  const bgOpacity = pct >= 80 ? '0.08' : pct >= 50 ? '0.08' : '0.08';

  return (
    <div className="relative inline-flex flex-col items-center justify-center gap-1">
      <div className="relative" style={{ width: d, height: d }}>
        <svg width={d} height={d} className="-rotate-90">
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke={`hsl(0 0% 100% / 0.04)`} strokeWidth={s} />
          <circle
            cx={d / 2} cy={d / 2} r={r} fill="none"
            stroke={color} strokeWidth={s}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 6px ${color.replace(')', ` / 0.3)`)})` }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono font-semibold ${fonts[size]}`}
          style={{ color }}
        >
          {Math.round(pct)}
        </span>
      </div>
      {showLabel && (
        <span className="text-[10px] text-muted-foreground font-medium">Health</span>
      )}
    </div>
  );
}
