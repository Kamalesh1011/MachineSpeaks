interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  severity?: 'normal' | 'warning' | 'critical';
}

export function MetricCard({ label, value, unit, icon, severity = 'normal' }: MetricCardProps) {
  const sevColor = severity === 'critical' ? 'text-status-critical' : severity === 'warning' ? 'text-status-warning' : 'text-foreground';

  return (
    <div className="group rounded-xl bg-card border-glass p-4 hover:border-glass-hover transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        {icon && <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-xl font-semibold tracking-tight ${sevColor}`}>{value}</span>
        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
