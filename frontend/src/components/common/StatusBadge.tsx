import { type DeviceStatus } from "@/data/simulatedData";

const config: Record<DeviceStatus, { label: string; colorClass: string; bgClass: string }> = {
  healthy: { label: 'Healthy', colorClass: 'text-status-healthy', bgClass: 'bg-status-healthy/8 border-status-healthy/15' },
  warning: { label: 'Warning', colorClass: 'text-status-warning', bgClass: 'bg-status-warning/8 border-status-warning/15' },
  critical: { label: 'Critical', colorClass: 'text-status-critical', bgClass: 'bg-status-critical/8 border-status-critical/15' },
  offline: { label: 'Offline', colorClass: 'text-muted-foreground', bgClass: 'bg-muted/50 border-border' },
};

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border ${c.bgClass} ${c.colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${status !== 'offline' ? 'pulse-dot' : ''}`} />
      {c.label}
    </span>
  );
}
