import { useParams, useNavigate } from "react-router-dom";
import { Component, useState, useEffect } from "react";
import { ArrowLeft, Cpu, Thermometer, MemoryStick, Zap, HardDrive, Wifi, Wind, Activity, Box, RefreshCw } from "lucide-react";
import type { Device } from "@/data/simulatedData";
import { HealthGauge } from "@/components/common/HealthGauge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricCard } from "@/components/common/MetricCard";
import { DigitalTwin3D } from "@/components/monitoring/DigitalTwin3D";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ensureDemoAuth,
  fetchDevices,
  fetchLatestTelemetry,
  fetchTelemetryHistory,
  fetchTelemetryRecords,
  historyToChartData,
  mapBackendDeviceToUI,
  type BackendDevice,
  type BackendTelemetry,
} from "@/lib/backend";

const CHART_COLORS = {
  primary: "hsl(160, 84%, 39%)",
  blue: "hsl(200, 70%, 55%)",
  purple: "hsl(280, 60%, 55%)",
  amber: "hsl(38, 92%, 50%)",
  red: "hsl(0, 72%, 51%)",
  grid: "hsl(0, 0%, 10%)",
  text: "hsl(0, 0%, 40%)",
};

const tooltipStyle = {
  background: "hsl(0, 0%, 8%)",
  border: "1px solid hsl(0, 0%, 15%)",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 12px",
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

class TwinErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Digital twin render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center text-[12px] text-muted-foreground bg-card">
          Digital twin unavailable on this device. Telemetry is still available below.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const [backendDevice, setBackendDevice] = useState<BackendDevice | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<BackendTelemetry | null>(null);
  const [activeChart, setActiveChart] = useState<"temperature" | "utilization" | "power">("temperature");
  const [fetchingRecords, setFetchingRecords] = useState(false);
  const [fetchMessage, setFetchMessage] = useState("");
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await ensureDemoAuth();
        const devices = await fetchDevices();
        const found = devices.find((d) => d.external_id === deviceId);
        if (!found || !mounted) return;

        setBackendDevice(found);

        const latest = await fetchLatestTelemetry(found.id).catch(() => undefined);
        if (mounted) {
          setLatestTelemetry(latest ?? null);
          setDevice(mapBackendDeviceToUI(found, latest));
        }

        const history = await fetchTelemetryHistory(found.id, 120);
        if (mounted) {
          setChartData(historyToChartData(history));
        }
      } catch (err) {
        console.error("Device detail load error", err);
      }
    };

    load();
    const iv = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [deviceId]);

  const handleFetchTelemetryRecords = async () => {
    if (!backendDevice) return;

    setFetchingRecords(true);
    setFetchMessage("");
    setFetchError("");

    try {
      await ensureDemoAuth();
      const latest = await fetchTelemetryRecords(backendDevice.id);
      const history = await fetchTelemetryHistory(backendDevice.id, 120);
      setLatestTelemetry(latest);
      setChartData(historyToChartData(history));
      setDevice(mapBackendDeviceToUI(backendDevice, latest));
      setFetchMessage(`Telemetry fetched at ${new Date(latest.ts).toLocaleTimeString()}`);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch telemetry records");
    } finally {
      setFetchingRecords(false);
    }
  };

  if (!device) return <div className="text-muted-foreground p-8">Loading device...</div>;

  const m = device.metrics;
  const tempSev = (t: number) => (t > 85 ? "critical" as const : t > 70 ? "warning" as const : "normal" as const);
  const utilSev = (u: number) => (u > 90 ? "critical" as const : u > 75 ? "warning" as const : "normal" as const);

  const chartConfigs = {
    temperature: {
      lines: [
        { key: "cpuTemp", color: CHART_COLORS.primary, name: "CPU Temp" },
        { key: "gpuTemp", color: CHART_COLORS.red, name: "GPU Temp" },
      ],
      domain: [20, 100] as [number, number],
    },
    utilization: {
      lines: [
        { key: "cpuUtil", color: CHART_COLORS.primary, name: "CPU %" },
        { key: "gpuUtil", color: CHART_COLORS.blue, name: "GPU %" },
        { key: "memoryUtil", color: CHART_COLORS.purple, name: "Memory %" },
      ],
      domain: [0, 100] as [number, number],
    },
    power: {
      lines: [{ key: "powerWatts", color: CHART_COLORS.amber, name: "Power (W)" }],
      domain: [0, 2000] as [number, number],
    },
  };

  const cc = chartConfigs[activeChart];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200"
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-xl font-semibold text-foreground tracking-tight truncate">{device.name}</h1>
            <StatusBadge status={device.status} />
          </div>
          <p className="text-[12px] text-muted-foreground">
            {device.location} · {device.ip} · Last seen: {device.lastSeen}
          </p>
          {fetchMessage && <p className="text-[12px] text-primary mt-1">{fetchMessage}</p>}
          {fetchError && <p className="text-[12px] text-status-critical mt-1">{fetchError}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchTelemetryRecords}
            disabled={!backendDevice || fetchingRecords}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw style={{ width: 13, height: 13 }} className={fetchingRecords ? "animate-spin" : ""} />
            {fetchingRecords ? "Fetching..." : "Fetch Telemetry Records"}
          </button>
          <HealthGauge score={device.healthScore} size="lg" showLabel />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 rounded-xl border-glass overflow-hidden" style={{ height: 360 }}>
          <div className="h-full relative">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg glass border-glass">
              <Box style={{ width: 12, height: 12 }} className="text-primary" />
              <span className="text-[11px] font-medium text-foreground">Digital Twin</span>
            </div>
            <div className="absolute bottom-4 left-4 z-10 text-[10px] text-muted-foreground/60">Drag to rotate · Scroll to zoom</div>
            <TwinErrorBoundary>
              <DigitalTwin3D deviceType={device.type} metrics={m} />
            </TwinErrorBoundary>
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
          <MetricCard label="CPU" value={`${Math.round(m.cpuUtil)}`} unit="%" icon={<Cpu style={{ width: 14, height: 14 }} />} severity={utilSev(m.cpuUtil)} />
          <MetricCard label="Memory" value={`${Math.round(m.memoryUtil)}`} unit="%" icon={<MemoryStick style={{ width: 14, height: 14 }} />} severity={utilSev(m.memoryUtil)} />
          <MetricCard label="CPU Temp" value={`${Math.round(m.cpuTemp)}`} unit="°C" icon={<Thermometer style={{ width: 14, height: 14 }} />} severity={tempSev(m.cpuTemp)} />
          <MetricCard label="GPU Temp" value={`${Math.round(m.gpuTemp)}`} unit="°C" icon={<Thermometer style={{ width: 14, height: 14 }} />} severity={tempSev(m.gpuTemp)} />
          <MetricCard label="Power" value={`${Math.round(m.powerWatts)}`} unit="W" icon={<Zap style={{ width: 14, height: 14 }} />} />
          <MetricCard label="Fan Speed" value={`${Math.round(m.fanSpeed)}`} unit="RPM" icon={<Wind style={{ width: 14, height: 14 }} />} />
          <MetricCard label="Disk I/O" value={`${Math.round(m.diskReadMBs)}/${Math.round(m.diskWriteMBs)}`} unit="MB/s" icon={<HardDrive style={{ width: 14, height: 14 }} />} />
          <MetricCard label="Network" value={`${Math.round(m.netUpMBs)} up / ${Math.round(m.netDownMBs)} down`} unit="MB/s" icon={<Wifi style={{ width: 14, height: 14 }} />} />
          <MetricCard
            label="Vibration"
            value={m.vibration.toFixed(2)}
            unit="g"
            icon={<Activity style={{ width: 14, height: 14 }} />}
            severity={m.vibration > 3 ? "critical" : m.vibration > 2 ? "warning" : "normal"}
          />
        </div>
      </div>

      <div className="rounded-xl bg-card border-glass p-5">
        <div className="flex items-center gap-5 mb-5">
          <h3 className="text-[13px] font-semibold text-foreground tracking-tight">Live Telemetry</h3>
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-elevated">
            {(["temperature", "utilization", "power"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveChart(tab)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
                  activeChart === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={cc.domain} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(0 0% 20%)" }} />
            {cc.lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={1.5} dot={false} name={l.name} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-card border-glass p-5">
        <h3 className="text-[13px] font-semibold text-foreground tracking-tight mb-4">Running Processes</h3>
        <div className="overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2">PID</th>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">CPU %</th>
                <th className="text-left py-2">Memory %</th>
              </tr>
            </thead>
            <tbody>
              {(latestTelemetry?.processes || []).map((p, idx) => (
                <tr key={`${p.pid || idx}-${p.name || "proc"}`} className="border-b border-border/20">
                  <td className="py-2 font-mono">{p.pid ?? "-"}</td>
                  <td className="py-2">{p.name || "unknown"}</td>
                  <td className="py-2 font-mono">{(p.cpu_percent ?? 0).toFixed(1)}</td>
                  <td className="py-2 font-mono">{(p.memory_percent ?? 0).toFixed(1)}</td>
                </tr>
              ))}
              {(!latestTelemetry?.processes || latestTelemetry.processes.length === 0) && (
                <tr>
                  <td className="py-2 text-muted-foreground" colSpan={4}>
                    No process data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
