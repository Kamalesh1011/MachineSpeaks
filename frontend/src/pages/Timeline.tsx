import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { ensureDemoAuth, fetchAlerts, fetchDevices } from "@/lib/backend";

export default function Timeline() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      await ensureDemoAuth();
      const [alerts, devices] = await Promise.all([fetchAlerts(), fetchDevices()]);
      const names = Object.fromEntries(devices.map((d) => [d.id, d.name]));
      const mapped = alerts.slice(0, 20).map((a, i) => ({
        id: a.id,
        icon: a.severity === "critical" ? AlertCircle : a.severity === "warning" ? AlertTriangle : Info,
        color:
          a.severity === "critical"
            ? "text-status-critical"
            : a.severity === "warning"
              ? "text-status-warning"
              : "text-primary",
        bgColor:
          a.severity === "critical"
            ? "bg-status-critical/8"
            : a.severity === "warning"
              ? "bg-status-warning/8"
              : "bg-primary/8",
        device: names[a.device_id] || `Device ${a.device_id}`,
        desc: a.message,
        time: new Date(a.created_at).toLocaleTimeString(),
        sortTs: new Date(a.created_at).getTime() - i,
      }));
      setEvents(mapped.sort((a, b) => b.sortTs - a.sortTs));
    };

    load().catch((err) => console.error("timeline load error", err));
    const iv = setInterval(() => load().catch(() => undefined), 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-6 max-w-[800px]">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Timeline</h1>
        <p className="text-[13px] text-muted-foreground mt-1">System events and activity log</p>
      </div>

      <div className="relative pl-8">
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border/50" />
        <div className="space-y-3">
          {events.map((e, i) => {
            const Icon = e.icon;
            return (
              <div key={e.id} className="relative flex gap-4 animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`absolute -left-8 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center ${e.bgColor} border-glass z-10`}>
                  <Icon style={{ width: 13, height: 13 }} className={e.color} />
                </div>
                <div className="flex-1 rounded-xl bg-card border-glass p-4 hover:bg-surface-hover/30 transition-all duration-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[12px] font-medium text-foreground">{e.device}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground/50 font-mono">{e.time}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{e.desc}</p>
                </div>
              </div>
            );
          })}
          {events.length === 0 && <p className="text-[13px] text-muted-foreground">No events yet.</p>}
        </div>
      </div>
    </div>
  );
}
