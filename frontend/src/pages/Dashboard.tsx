import { useState, useEffect } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { DeviceGrid } from "@/components/dashboard/DeviceGrid";
import { FleetCharts } from "@/components/dashboard/FleetCharts";
import type { Device } from "@/data/simulatedData";
import {
  ensureDemoAuth,
  fetchAlerts,
  fetchDevices,
  fetchLatestTelemetry,
  fetchTelemetryHistory,
  historyToChartData,
  mapBackendDeviceToUI,
} from "@/lib/backend";

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState(0);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        await ensureDemoAuth();
        const backendDevices = await fetchDevices();
        const latestList = await Promise.all(
          backendDevices.map(async (d) => {
            try {
              return await fetchLatestTelemetry(d.id);
            } catch {
              return undefined;
            }
          })
        );

        if (!mounted) return;
        const mapped = backendDevices.map((d, i) => mapBackendDeviceToUI(d, latestList[i]));
        setDevices(mapped);

        if (backendDevices.length > 0) {
          const hist = await fetchTelemetryHistory(backendDevices[0].id, 60);
          if (mounted) setChartData(historyToChartData(hist));
        }

        const active = await fetchAlerts("active");
        if (mounted) setCriticalAlerts(active.filter((a) => a.severity === "critical").length);
      } catch (err) {
        console.error("Dashboard load error", err);
      }
    };

    load();
    const iv = setInterval(load, 5000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Real-time fleet monitoring overview</p>
      </div>
      <SummaryCards devices={devices} criticalAlerts={criticalAlerts} />
      <FleetCharts devices={devices} chartData={chartData} />
      <DeviceGrid devices={devices} />
    </div>
  );
}
