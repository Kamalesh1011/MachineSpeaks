import { Server, AlertTriangle, AlertCircle, Activity, Zap, Brain } from "lucide-react";
import { type Device } from "@/data/simulatedData";

export function SummaryCards({ devices, criticalAlerts = 0 }: { devices: Device[]; criticalAlerts?: number }) {
  const online = devices.filter((d) => d.status !== "offline").length;
  const warnings = devices.filter((d) => d.status === "warning").length;
  const avgHealth = devices.length
    ? Math.round(devices.reduce((s, d) => s + d.healthScore, 0) / devices.length)
    : 0;

  const cards = [
    { label: "Devices Online", value: `${online}/${devices.length}`, icon: Server, accent: false },
    { label: "Warnings", value: `${warnings}`, icon: AlertTriangle, accent: false, warn: true },
    { label: "Critical Alerts", value: `${criticalAlerts}`, icon: AlertCircle, accent: false, critical: true },
    { label: "Fleet Health", value: `${avgHealth}%`, icon: Activity, accent: true },
    { label: "Events Today", value: "Live", icon: Zap, accent: false },
    { label: "AI Insights", value: "Auto", icon: Brain, accent: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const valueColor = c.critical
          ? "text-status-critical"
          : c.warn
            ? "text-status-warning"
            : c.accent
              ? "text-primary"
              : "text-foreground";
        return (
          <div
            key={c.label}
            className="group rounded-xl bg-card border-glass p-4 hover:border-glass-hover transition-all duration-300 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.08em]">{c.label}</span>
              <Icon
                style={{ width: 14, height: 14 }}
                className={`${c.critical ? "text-status-critical/50" : c.warn ? "text-status-warning/50" : c.accent ? "text-primary/50" : "text-muted-foreground/30"} group-hover:text-muted-foreground transition-colors`}
              />
            </div>
            <span className={`font-mono text-2xl font-semibold tracking-tight ${valueColor}`}>{c.value}</span>
          </div>
        );
      })}
    </div>
  );
}
