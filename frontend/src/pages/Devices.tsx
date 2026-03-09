import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, ArrowUpRight, ShieldCheck, Copy, Check } from "lucide-react";
import type { Device } from "@/data/simulatedData";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  createDevice,
  ensureDemoAuth,
  fetchDevices,
  fetchLatestTelemetry,
  fetchSystemAbout,
  mapBackendDeviceToUI,
  provisionAgentInstall,
  type AgentProvisionResponse,
  type SystemAbout,
} from "@/lib/backend";

const DEVICE_TYPES = ["server", "gpu-workstation", "industrial-motor", "cnc-machine", "network-switch"] as const;

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inferDeviceTypeFromSystem(about: SystemAbout) {
  const machine = (about.machine || "").toLowerCase();
  if (machine.includes("arm")) return "network-switch";
  return "server";
}

function inferOsFromNavigator(): "windows" | "linux" | "macos" {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macos";
  return "linux";
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [detailsSource, setDetailsSource] = useState<"manual" | "system">("manual");
  const [systemAbout, setSystemAbout] = useState<SystemAbout | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemError, setSystemError] = useState("");

  const [showInstallWizard, setShowInstallWizard] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [installDeviceId, setInstallDeviceId] = useState("my-device-001");
  const [installOs, setInstallOs] = useState<"windows" | "linux" | "macos">(inferOsFromNavigator());
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState("");
  const [installData, setInstallData] = useState<AgentProvisionResponse | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [form, setForm] = useState({
    external_id: "",
    name: "",
    type: "server",
    location: "",
    ip: "",
    connection_method: "agent",
    specs: {} as Record<string, unknown>,
  });

  const navigate = useNavigate();

  const loadDevices = async (mounted = true) => {
    try {
      await ensureDemoAuth();
      const list = await fetchDevices();
      const latest = await Promise.all(
        list.map(async (d) => {
          try {
            return await fetchLatestTelemetry(d.id);
          } catch {
            return undefined;
          }
        })
      );
      if (!mounted) return;
      setDevices(list.map((d, i) => mapBackendDeviceToUI(d, latest[i])));
    } catch (err) {
      console.error("Devices load error", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadDevices(mounted);
    const iv = setInterval(() => loadDevices(mounted), 5000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const filtered = useMemo(
    () => devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.location.toLowerCase().includes(search.toLowerCase())),
    [devices, search]
  );

  const fetchFromSystemAbout = async () => {
    setSystemLoading(true);
    setSystemError("");
    try {
      await ensureDemoAuth();
      const about = await fetchSystemAbout();
      const inferredType = inferDeviceTypeFromSystem(about);
      const inferredLocation = [about.os, about.os_version].filter(Boolean).join(" ");
      setSystemAbout(about);
      setForm((s) => ({
        ...s,
        external_id: s.external_id.trim() || slugify(about.hostname || "device"),
        name: s.name.trim() || about.hostname || s.name,
        type: s.type === "server" ? inferredType : s.type,
        location: s.location.trim() || inferredLocation,
        ip: s.ip.trim() || about.ip || "",
        connection_method: "manual",
        specs: {
          ...s.specs,
          ...about,
          source: "system-about",
        },
      }));
    } catch (err) {
      setSystemError(err instanceof Error ? err.message : "Unable to fetch system details");
    } finally {
      setSystemLoading(false);
    }
  };

  const onAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError("");
    try {
      const externalId = form.external_id.trim() || slugify(form.name.trim() || "device");
      await createDevice({
        ...form,
        external_id: externalId,
      });
      setShowAdd(false);
      setDetailsSource("manual");
      setSystemAbout(null);
      setSystemError("");
      setForm({
        external_id: "",
        name: "",
        type: "server",
        location: "",
        ip: "",
        connection_method: "agent",
        specs: {},
      });
      await loadDevices(true);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add device");
    } finally {
      setAdding(false);
    }
  };

  const onProvisionInstall = async () => {
    setInstallError("");
    setInstallData(null);
    setCopiedIdx(null);

    if (!consentAccepted) {
      setInstallError("Please accept the permission/consent checkbox first.");
      return;
    }

    const cleanDeviceId = slugify(installDeviceId);
    if (!cleanDeviceId || cleanDeviceId.length < 3) {
      setInstallError("Device external ID must be at least 3 valid characters.");
      return;
    }

    setInstalling(true);
    try {
      await ensureDemoAuth();
      const result = await provisionAgentInstall({
        device_external_id: cleanDeviceId,
        os_name: installOs,
        consent_accepted: true,
      });
      if (!result.ok) {
        setInstallError(result.detail || "Failed to provision agent install.");
      } else {
        setInstallData(result);
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Provision failed");
    } finally {
      setInstalling(false);
    }
  };

  const copyCommand = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      setInstallError("Clipboard copy failed. Copy manually from the command box.");
    }
  };

  const resetInstallWizard = () => {
    setShowInstallWizard(false);
    setConsentAccepted(false);
    setInstallError("");
    setInstallData(null);
    setCopiedIdx(null);
  };

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Devices</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{devices.length} devices registered</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInstallWizard(true)}
            className="h-9 px-4 rounded-lg border border-border text-[12px] font-medium flex items-center gap-2 text-foreground hover:bg-surface-hover"
          >
            <ShieldCheck style={{ width: 14, height: 14 }} /> Install Agent
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium flex items-center gap-2 hover:bg-primary/90 transition-all duration-200 shadow-premium"
          >
            <Plus style={{ width: 14, height: 14 }} /> Add Device
          </button>
        </div>
      </div>

      {showInstallWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card border-glass p-5 space-y-4 max-h-[88vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Install Telemetry Agent</h2>
              <button
                type="button"
                onClick={resetInstallWizard}
                className="h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-surface-elevated/30 space-y-2">
              <label className="flex items-start gap-2 text-[12px] text-foreground">
                <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="mt-0.5" />
                I have permission to collect telemetry from this device and I understand this installs a local background agent.
              </label>
              <p className="text-[11px] text-muted-foreground">This is required for reliable hardware telemetry (CPU/GPU/temps/processes) from the target machine.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Device External ID (e.g. workstation-01)"
                value={installDeviceId}
                onChange={(e) => setInstallDeviceId(e.target.value)}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              />
              <select
                value={installOs}
                onChange={(e) => setInstallOs(e.target.value as "windows" | "linux" | "macos")}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              >
                <option value="windows">Windows</option>
                <option value="linux">Linux</option>
                <option value="macos">macOS</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onProvisionInstall}
                disabled={installing}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-60"
              >
                {installing ? "Generating..." : "Generate Install Commands"}
              </button>
              {installError && <p className="text-[12px] text-status-critical">{installError}</p>}
            </div>

            {installData?.ok && installData.selected_install && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-[12px] text-foreground">{installData.permissions_notice}</p>
                  <p className="text-[12px] text-muted-foreground">{installData.telemetry_notice}</p>
                  <p className="text-[11px] text-muted-foreground">Device ID: {installData.device_external_id}</p>
                  <p className="text-[11px] text-muted-foreground">Key name: {installData.api_key_name}</p>
                </div>

                {installData.selected_install.commands.map((cmd, idx) => (
                  <div key={`${cmd}-${idx}`} className="rounded-lg border border-border p-3 bg-surface-elevated/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Step {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => copyCommand(cmd, idx)}
                        className="h-7 px-2 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {copiedIdx === idx ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                        {copiedIdx === idx ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="text-[11px] overflow-auto whitespace-pre-wrap break-all text-foreground font-mono">{cmd}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={onAddSubmit} className="w-full max-w-xl rounded-xl bg-card border-glass p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add Device</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="h-8 px-3 rounded-lg border border-border text-[12px] text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] text-muted-foreground">Device details source</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailsSource("manual")}
                  className={`h-8 px-3 rounded-lg border text-[12px] ${
                    detailsSource === "manual" ? "border-primary text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsSource("system")}
                  className={`h-8 px-3 rounded-lg border text-[12px] ${
                    detailsSource === "system" ? "border-primary text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  System About
                </button>
                {detailsSource === "system" && (
                  <button
                    type="button"
                    onClick={fetchFromSystemAbout}
                    disabled={systemLoading}
                    className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] disabled:opacity-60"
                  >
                    {systemLoading ? "Fetching..." : "Fetch System About"}
                  </button>
                )}
              </div>
              {systemAbout && (
                <p className="text-[11px] text-muted-foreground">
                  Loaded from {systemAbout.hostname} ({systemAbout.os} {systemAbout.os_version})
                </p>
              )}
              {systemError && <p className="text-[11px] text-status-critical">{systemError}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Device Name"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
                required
              />
              <input
                placeholder="External ID (optional)"
                value={form.external_id}
                onChange={(e) => setForm((s) => ({ ...s, external_id: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              />
              <input
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm((s) => ({ ...s, location: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              />
              <input
                placeholder="IP Address"
                value={form.ip}
                onChange={(e) => setForm((s) => ({ ...s, ip: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              />
              <select
                value={form.type}
                onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              >
                {DEVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                value={form.connection_method}
                onChange={(e) => setForm((s) => ({ ...s, connection_method: e.target.value }))}
                className="h-10 rounded-lg bg-surface-elevated border border-border px-3 text-[13px]"
              >
                <option value="agent">agent</option>
                <option value="manual">manual</option>
              </select>
            </div>

            {addError && <p className="text-[12px] text-status-critical">{addError}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="h-9 px-4 rounded-lg border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-60"
              >
                {adding ? "Adding..." : "Create Device"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" style={{ width: 15, height: 15 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search devices..."
          className="w-full pl-10 pr-4 h-10 rounded-xl bg-card border-glass text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="rounded-xl bg-card border-glass overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/50">
              {["Name", "Location", "IP", "Status", "Health", "CPU", "Temp"].map((h) => (
                <th key={h} className="text-left px-5 py-3.5 text-[10px] text-muted-foreground/60 uppercase tracking-[0.1em] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.id}
                onClick={() => navigate(`/devices/${d.id}`)}
                className="group border-b border-border/30 last:border-0 hover:bg-surface-hover/40 cursor-pointer transition-all duration-200"
              >
                <td className="px-5 py-3.5 font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    {d.name}
                    <ArrowUpRight style={{ width: 12, height: 12 }} className="text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{d.location}</td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground/70">{d.ip}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-5 py-3.5 font-mono font-medium">{Math.round(d.healthScore)}</td>
                <td className="px-5 py-3.5 font-mono text-[12px]">{Math.round(d.metrics.cpuUtil)}%</td>
                <td className="px-5 py-3.5 font-mono text-[12px]">{Math.round(d.metrics.cpuTemp)}°C</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
