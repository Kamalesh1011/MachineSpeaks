import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { ensureDemoAuth, fetchSettings, saveSettings } from "@/lib/backend";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function SettingsPage() {
  const [retentionDays, setRetentionDays] = useState(90);
  const [thresholdsJson, setThresholdsJson] = useState("{}");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      await ensureDemoAuth();
      const s = await fetchSettings();
      setRetentionDays(s.retention_days);
      setThresholdsJson(JSON.stringify(s.default_thresholds, null, 2));
    };
    load().catch((err) => console.error("settings load error", err));
  }, []);

  const onSave = async () => {
    try {
      await saveSettings({ retention_days: retentionDays, default_thresholds: JSON.parse(thresholdsJson) });
      setStatus("Saved");
      setTimeout(() => setStatus(""), 2000);
    } catch (err) {
      console.error(err);
      setStatus("Invalid JSON or save failed");
    }
  };

  return (
    <div className="space-y-8 max-w-[700px]">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Platform configuration</p>
      </div>

      <div className="rounded-xl bg-card border-glass p-5 space-y-4">
        <div>
          <label className="text-[12px] text-muted-foreground">Retention Days</label>
          <input
            type="number"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="w-full mt-1 px-3 h-10 rounded-lg bg-surface-elevated border border-border"
          />
        </div>
        <div>
          <label className="text-[12px] text-muted-foreground">Default Thresholds (JSON)</label>
          <textarea
            value={thresholdsJson}
            onChange={(e) => setThresholdsJson(e.target.value)}
            className="w-full mt-1 px-3 py-2 min-h-[220px] rounded-lg bg-surface-elevated border border-border font-mono text-[12px]"
          />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onSave} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium">
            Save Settings
          </button>
          <a
            href={`${API_BASE}/agent/download`}
            target="_blank"
            rel="noreferrer"
            className="h-9 px-4 rounded-lg border border-border text-[12px] font-medium inline-flex items-center"
          >
            Download Agent
          </a>
        </div>
        {status && <p className="text-[12px] text-muted-foreground">{status}</p>}
      </div>

      <div>
        <h3 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-[0.1em] mb-3">System</h3>
        <div className="rounded-xl bg-card border-glass overflow-hidden divide-y divide-border/30">
          {[{ label: "Agent Endpoint", value: "GET /agent/download" }].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover/30 transition-all duration-200 group">
              <span className="text-[13px] text-foreground">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-muted-foreground">{item.value}</span>
                <ChevronRight style={{ width: 14, height: 14 }} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
