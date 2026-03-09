import { useNavigate } from "react-router-dom";
import { Server, Cpu, Cog, MonitorCog, Network, Fan, ArrowUpRight } from "lucide-react";
import { type Device, type DeviceType } from "@/data/simulatedData";
import { HealthGauge } from "@/components/common/HealthGauge";
import { StatusBadge } from "@/components/common/StatusBadge";

const typeIcons: Record<DeviceType, React.ReactNode> = {
  server: <Server style={{ width: 14, height: 14 }} />,
  "gpu-workstation": <Cpu style={{ width: 14, height: 14 }} />,
  "industrial-motor": <Cog style={{ width: 14, height: 14 }} />,
  "cnc-machine": <MonitorCog style={{ width: 14, height: 14 }} />,
  "network-switch": <Network style={{ width: 14, height: 14 }} />,
  "fan-pump": <Fan style={{ width: 14, height: 14 }} />,
};

export function DeviceGrid({ devices }: { devices: Device[] }) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Device Fleet</h3>
        <span className="text-[12px] text-muted-foreground">{devices.length} devices</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {devices.map((device, i) => (
          <div
            key={device.id}
            onClick={() => navigate(`/devices/${device.id}`)}
            className="group rounded-xl bg-card border-glass p-5 cursor-pointer hover:border-glass-hover hover:bg-surface-hover/30 transition-all duration-300 animate-fade-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-surface-elevated border-glass flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
                  {typeIcons[device.type as DeviceType] || <Server style={{ width: 14, height: 14 }} />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{device.name}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{device.location}</p>
                </div>
              </div>
              <HealthGauge score={device.healthScore} size="sm" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <StatusBadge status={device.status} />
              <span className="text-[10px] text-muted-foreground/60">{device.lastSeen}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
              {[
                { label: "Temp", value: `${Math.round(device.metrics.cpuTemp)}°` },
                { label: "CPU", value: `${Math.round(device.metrics.cpuUtil)}%` },
                { label: "Memory", value: `${Math.round(device.metrics.memoryUtil)}%` },
              ].map((m) => (
                <div key={m.label}>
                  <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{m.label}</span>
                  <p className="font-mono text-[13px] font-medium text-foreground mt-0.5">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-[10px] text-primary flex items-center gap-1">
                View details <ArrowUpRight style={{ width: 10, height: 10 }} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
