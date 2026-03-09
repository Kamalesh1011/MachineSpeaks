import { useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Info, Check, Eye } from "lucide-react";
import { ensureDemoAuth, fetchAlerts, fetchDevices, updateAlert, type BackendAlert } from "@/lib/backend";

const severityConfig = {
  critical: { icon: AlertCircle, dotColor: "bg-status-critical", textColor: "text-status-critical", bgColor: "bg-status-critical/6", borderColor: "border-status-critical/12" },
  warning: { icon: AlertTriangle, dotColor: "bg-status-warning", textColor: "text-status-warning", bgColor: "bg-status-warning/6", borderColor: "border-status-warning/12" },
  info: { icon: Info, dotColor: "bg-primary", textColor: "text-primary", bgColor: "bg-primary/6", borderColor: "border-primary/12" },
};

export default function Alerts() {
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged" | "resolved">("all");
  const [alerts, setAlerts] = useState<BackendAlert[]>([]);
  const [deviceNameById, setDeviceNameById] = useState<Record<number, string>>({});

  const load = async () => {
    await ensureDemoAuth();
    const [alertRows, devices] = await Promise.all([fetchAlerts(), fetchDevices()]);
    setAlerts(alertRows);
    setDeviceNameById(Object.fromEntries(devices.map((d) => [d.id, d.name])));
  };

  useEffect(() => {
    load().catch((err) => console.error("alerts load error", err));
    const iv = setInterval(() => load().catch(() => undefined), 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => (filter === "all" ? alerts : alerts.filter((a) => a.status === filter)), [alerts, filter]);

  const onUpdate = async (alertId: number, status: "acknowledged" | "resolved") => {
    try {
      await updateAlert(alertId, status);
      await load();
    } catch (err) {
      console.error("update alert failed", err);
    }
  };

  return (
    <div className="space-y-6 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Alerts</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Monitor and manage system alerts</p>
      </div>

      <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-elevated w-fit">
        {(["all", "active", "acknowledged", "resolved"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200 capitalize ${
              filter === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            <span className="ml-1.5 text-muted-foreground/60">{tab === "all" ? alerts.length : alerts.filter((a) => a.status === tab).length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((alert, i) => {
          const sc = severityConfig[alert.severity];
          const Icon = sc.icon;
          return (
            <div
              key={alert.id}
              className={`rounded-xl border ${sc.borderColor} ${sc.bgColor} p-4 animate-fade-up transition-all duration-200 hover:bg-surface-hover/20`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${sc.bgColor}`}>
                  <Icon style={{ width: 15, height: 15 }} className={sc.textColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${sc.textColor}`}>{alert.severity}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[12px] text-muted-foreground">{deviceNameById[alert.device_id] || `Device ${alert.device_id}`}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground/60">{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[13px] text-foreground/90 mb-1">{alert.message}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {alert.metric}: <span className="font-mono text-foreground/80">{alert.value}</span>
                    <span className="text-muted-foreground/40"> · threshold: {alert.threshold}</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  {alert.status === "active" && (
                    <button
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-status-warning hover:bg-status-warning/8 transition-all"
                      title="Acknowledge"
                      onClick={() => onUpdate(alert.id, "acknowledged")}
                    >
                      <Eye style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                  {alert.status !== "resolved" && (
                    <button
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-status-healthy hover:bg-status-healthy/8 transition-all"
                      title="Resolve"
                      onClick={() => onUpdate(alert.id, "resolved")}
                    >
                      <Check style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
