import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { type Device } from "@/data/simulatedData";
import { useMemo } from "react";

const CHART_COLORS = {
  primary: "hsl(160, 84%, 39%)",
  green: "hsl(160, 60%, 45%)",
  amber: "hsl(38, 92%, 50%)",
  red: "hsl(0, 72%, 51%)",
  grid: "hsl(0, 0%, 10%)",
  text: "hsl(0, 0%, 40%)",
  line2: "hsl(200, 70%, 55%)",
  line3: "hsl(280, 60%, 55%)",
};

const tooltipStyle = {
  background: 'hsl(0, 0%, 8%)',
  border: '1px solid hsl(0, 0%, 15%)',
  borderRadius: 10,
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 8px 32px hsl(0 0% 0% / 0.4)',
};

export function FleetCharts({ devices, chartData }: { devices: Device[]; chartData: any[] }) {
  const healthDist = useMemo(() => {
    const healthy = devices.filter(d => d.healthScore >= 80).length;
    const warning = devices.filter(d => d.healthScore >= 50 && d.healthScore < 80).length;
    const critical = devices.filter(d => d.healthScore < 50).length;
    return [
      { name: 'Healthy', value: healthy, color: CHART_COLORS.green },
      { name: 'Warning', value: warning, color: CHART_COLORS.amber },
      { name: 'Critical', value: critical, color: CHART_COLORS.red },
    ];
  }, [devices]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* System Load */}
      <div className="lg:col-span-2 rounded-xl bg-card border-glass p-5">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-[13px] font-semibold text-foreground tracking-tight">System Load</h4>
          <div className="flex items-center gap-4">
            {[
              { name: 'CPU', color: CHART_COLORS.primary },
              { name: 'GPU', color: CHART_COLORS.line2 },
              { name: 'Memory', color: CHART_COLORS.line3 },
            ].map(l => (
              <div key={l.name} className="flex items-center gap-1.5">
                <span className="w-2 h-[2px] rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-muted-foreground">{l.name}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData.slice(-30)}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'hsl(0 0% 20%)' }} />
            <Line type="monotone" dataKey="cpuUtil" stroke={CHART_COLORS.primary} strokeWidth={1.5} dot={false} name="CPU %" />
            <Line type="monotone" dataKey="gpuUtil" stroke={CHART_COLORS.line2} strokeWidth={1.5} dot={false} name="GPU %" />
            <Line type="monotone" dataKey="memoryUtil" stroke={CHART_COLORS.line3} strokeWidth={1.5} dot={false} name="Memory %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Health Donut */}
      <div className="rounded-xl bg-card border-glass p-5 flex flex-col">
        <h4 className="text-[13px] font-semibold text-foreground tracking-tight mb-4">Fleet Health</h4>
        <div className="flex-1 flex items-center justify-center">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={healthDist} cx="50%" cy="50%" innerRadius={48} outerRadius={64} paddingAngle={4} dataKey="value" strokeWidth={0}>
                {healthDist.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-5 mt-3">
          {healthDist.map(h => (
            <div key={h.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: h.color }} />
              <span className="text-[11px] text-muted-foreground">{h.name} ({h.value})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
