import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Scatter } from "recharts";
import { ensureDemoAuth, fetchAnomalies, fetchDevices, fetchTimeseries, historyToChartData, type BackendDevice } from "@/lib/backend";

const COLORS = {
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
  boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
};

export default function Analytics() {
  const [devices, setDevices] = useState<BackendDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<Array<{ ts: string; value: number }>>([]);

  useEffect(() => {
    const bootstrap = async () => {
      await ensureDemoAuth();
      const rows = await fetchDevices();
      setDevices(rows);
      if (rows.length > 0) {
        setSelectedDevice(rows[0].id);
      }
    };
    bootstrap().catch((err) => console.error("analytics bootstrap error", err));
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;

    const load = async () => {
      const [ts, an] = await Promise.all([fetchTimeseries(selectedDevice, 24), fetchAnomalies(selectedDevice, 24)]);
      setData(historyToChartData(ts));
      setAnomalies(
        an.map((a) => ({
          ts: new Date(a.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          value: a.value,
        }))
      );
    };

    load().catch((err) => console.error("analytics load error", err));
    const iv = setInterval(() => load().catch(() => undefined), 7000);
    return () => clearInterval(iv);
  }, [selectedDevice]);

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Analytics</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Historical telemetry analysis</p>
      </div>

      <div className="flex gap-0.5 p-0.5 rounded-lg bg-surface-elevated w-fit flex-wrap">
        {devices.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDevice(d.id)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
              selectedDevice === d.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-card border-glass p-5">
        <h3 className="text-[13px] font-semibold mb-5 tracking-tight">Temperature History</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[20, 100]} tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(0 0% 20%)" }} />
            <Line type="monotone" dataKey="cpuTemp" stroke={COLORS.primary} strokeWidth={1.5} dot={false} name="CPU Temp" />
            <Line type="monotone" dataKey="gpuTemp" stroke={COLORS.red} strokeWidth={1.5} dot={false} name="GPU Temp" />
            <Scatter data={anomalies.map((a) => ({ time: a.ts, cpuTemp: a.value }))} fill={COLORS.amber} name="Anomaly" />
            <Brush dataKey="time" height={20} stroke="hsl(160, 84%, 39%)" fill="hsl(0, 0%, 5%)" travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl bg-card border-glass p-5">
        <h3 className="text-[13px] font-semibold mb-5 tracking-tight">Utilization History</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fill: COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(0 0% 20%)" }} />
            <Line type="monotone" dataKey="cpuUtil" stroke={COLORS.primary} strokeWidth={1.5} dot={false} name="CPU %" />
            <Line type="monotone" dataKey="gpuUtil" stroke={COLORS.blue} strokeWidth={1.5} dot={false} name="GPU %" />
            <Line type="monotone" dataKey="memoryUtil" stroke={COLORS.purple} strokeWidth={1.5} dot={false} name="Memory %" />
            <Brush dataKey="time" height={20} stroke="hsl(160, 84%, 39%)" fill="hsl(0, 0%, 5%)" travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
