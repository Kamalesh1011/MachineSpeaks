import type { Device, DeviceMetrics } from "@/data/simulatedData";

export interface BackendDevice {
  id: number;
  external_id: string;
  name: string;
  type: string;
  location: string;
  ip: string;
  connection_method: string;
  specs: Record<string, unknown>;
  thresholds: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SystemAbout {
  hostname: string;
  os: string;
  os_version: string;
  machine: string;
  processor: string;
  ip: string;
  cpu_cores: number;
  memory_gb: number | null;
  source: string;
}

export interface BackendTelemetry {
  id: number;
  device_id: number;
  ts: string;
  cpu_util: number;
  gpu_util: number;
  memory_util: number;
  cpu_temp: number;
  gpu_temp: number;
  vibration: number;
  fan_rpm: number;
  power_watts: number;
  disk_read_mbs: number;
  disk_write_mbs: number;
  net_up_mbs: number;
  net_down_mbs: number;
  uptime_hours: number;
  processes: Array<{ pid?: number; name?: string; cpu_percent?: number; memory_percent?: number }>;
}

export interface BackendAlert {
  id: number;
  device_id: number;
  severity: "critical" | "warning" | "info";
  metric: string;
  value: string;
  threshold: string;
  message: string;
  status: "active" | "acknowledged" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface BackendSettings {
  retention_days: number;
  default_thresholds: Record<string, unknown>;
}

export interface CreateDevicePayload {
  external_id: string;
  name: string;
  type: string;
  location?: string;
  ip?: string;
  connection_method?: string;
  specs?: Record<string, unknown>;
  thresholds?: Record<string, unknown>;
}

export interface BrowserTelemetryPayload {
  device_external_id: string;
  cpu_util: number;
  gpu_util: number;
  memory_util: number;
  cpu_temp: number;
  gpu_temp: number;
  vibration: number;
  fan_rpm: number;
  power_watts: number;
  disk_read_mbs: number;
  disk_write_mbs: number;
  net_up_mbs: number;
  net_down_mbs: number;
  uptime_hours: number;
  processes: Array<{ pid?: number; name?: string; cpu_percent?: number; memory_percent?: number }>;
  raw_payload: Record<string, unknown>;
}

export interface AgentProvisionInstall {
  script_url: string;
  commands: string[];
}

export interface AgentProvisionResponse {
  ok: boolean;
  detail?: string;
  api_key?: string;
  api_key_name?: string;
  server_url?: string;
  device_external_id?: string;
  selected_os?: "windows" | "linux" | "macos" | string;
  install?: Record<string, AgentProvisionInstall>;
  selected_install?: AgentProvisionInstall;
  permissions_notice?: string;
  telemetry_notice?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TOKEN_KEY = "mgai_access_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function hasAuthToken() {
  return Boolean(getToken());
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    clearAuthToken();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as T;
}

export async function login(username: string, password: string) {
  const data = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
}

export async function ensureDemoAuth() {
  if (getToken()) return;
  const auto = String(import.meta.env.VITE_AUTO_LOGIN || "false") === "true";
  if (!auto) {
    throw new Error("Not authenticated");
  }
  const username = import.meta.env.VITE_DEMO_USERNAME || "admin";
  const password = import.meta.env.VITE_DEMO_PASSWORD || "admin123";
  await login(username, password);
}

export async function fetchDevices() {
  return request<BackendDevice[]>("/devices");
}

export async function createDevice(payload: CreateDevicePayload) {
  return request<BackendDevice>("/devices", {
    method: "POST",
    body: JSON.stringify({
      connection_method: "agent",
      location: "",
      ip: "",
      specs: {},
      thresholds: {},
      ...payload,
    }),
  });
}

export async function fetchSystemAbout() {
  return request<SystemAbout>("/devices/system/about");
}

export async function fetchLatestTelemetry(deviceId: number) {
  return request<BackendTelemetry | null>(`/devices/${deviceId}/telemetry/latest`);
}

export async function fetchTelemetryHistory(deviceId: number, limit = 120) {
  return request<BackendTelemetry[]>(`/devices/${deviceId}/telemetry/history?limit=${limit}`);
}

export async function fetchTelemetryRecords(deviceId: number) {
  return request<BackendTelemetry>(`/devices/${deviceId}/telemetry/fetch`, {
    method: "POST",
  });
}

export async function fetchAlerts(status?: string) {
  return request<BackendAlert[]>(status ? `/alerts?status=${status}` : "/alerts");
}

export async function updateAlert(alertId: number, status: "active" | "acknowledged" | "resolved") {
  return request<BackendAlert>(`/alerts/${alertId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function fetchSettings() {
  return request<BackendSettings>("/settings");
}

export async function saveSettings(payload: BackendSettings) {
  return request<BackendSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchTimeseries(deviceId: number, rangeHours = 24) {
  return request<BackendTelemetry[]>(`/analytics/timeseries?device_id=${deviceId}&range_hours=${rangeHours}`);
}

export async function fetchAnomalies(deviceId: number, rangeHours = 24) {
  return request<Array<{ ts: string; metric: string; value: number; reason: string }>>(
    `/analytics/anomalies?device_id=${deviceId}&range_hours=${rangeHours}`
  );
}

export async function ingestBrowserTelemetry(payload: BrowserTelemetryPayload) {
  return request<{ ok: boolean; device_id: number; health: Record<string, unknown> }>("/telemetry/browser/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function provisionAgentInstall(payload: {
  device_external_id: string;
  os_name: "windows" | "linux" | "macos";
  consent_accepted: boolean;
}) {
  return request<AgentProvisionResponse>("/agent/provision", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function telemetryWsUrl(deviceId: number) {
  const wsBase = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  return `${wsBase}/ws/telemetry/${deviceId}`;
}

export function mapTelemetryToMetrics(t?: BackendTelemetry): DeviceMetrics {
  return {
    cpuUtil: t?.cpu_util ?? 0,
    memoryUtil: t?.memory_util ?? 0,
    memoryUsedGB: ((t?.memory_util ?? 0) / 100) * 64,
    memoryTotalGB: 64,
    gpuUtil: t?.gpu_util ?? 0,
    gpuMemory: 0,
    cpuTemp: t?.cpu_temp ?? 0,
    gpuTemp: t?.gpu_temp ?? 0,
    mbTemp: Math.max(0, (t?.cpu_temp ?? 0) - 10),
    fanSpeed: t?.fan_rpm ?? 0,
    powerWatts: t?.power_watts ?? 0,
    diskReadMBs: t?.disk_read_mbs ?? 0,
    diskWriteMBs: t?.disk_write_mbs ?? 0,
    netUpMBs: t?.net_up_mbs ?? 0,
    netDownMBs: t?.net_down_mbs ?? 0,
    vibration: t?.vibration ?? 0,
    uptimeHours: t?.uptime_hours ?? 0,
  };
}

export function healthScoreFromTelemetry(metrics: DeviceMetrics): number {
  const temp = Math.max(0, 100 - Math.max(metrics.cpuTemp, metrics.gpuTemp));
  const util = 100 - ((metrics.cpuUtil + metrics.gpuUtil) / 2);
  const memory = 100 - metrics.memoryUtil;
  const vibration = Math.max(0, 100 - metrics.vibration * 20);
  const uptime = Math.min(100, metrics.uptimeHours / 24);
  return Math.round(temp * 0.3 + util * 0.25 + memory * 0.2 + vibration * 0.15 + uptime * 0.1);
}

export function statusFromTelemetry(metrics: DeviceMetrics): Device["status"] {
  if (metrics.cpuTemp >= 90 || metrics.gpuTemp >= 92 || metrics.vibration >= 4 || metrics.memoryUtil >= 95) return "critical";
  if (metrics.cpuTemp >= 75 || metrics.gpuTemp >= 85 || metrics.vibration >= 2.5 || metrics.memoryUtil >= 85) return "warning";
  return "healthy";
}

export function mapBackendDeviceToUI(device: BackendDevice, telemetry?: BackendTelemetry | null): Device {
  const metrics = mapTelemetryToMetrics(telemetry);
  return {
    id: device.external_id,
    name: device.name,
    type: (device.type as Device["type"]) || "server",
    location: device.location || "Unknown",
    ip: device.ip || "-",
    status: statusFromTelemetry(metrics),
    healthScore: healthScoreFromTelemetry(metrics),
    lastSeen: telemetry ? new Date(telemetry.ts).toLocaleTimeString() : "N/A",
    metrics,
  };
}

export function historyToChartData(rows: BackendTelemetry[]) {
  return rows.map((r) => ({
    time: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    cpuTemp: Math.round(r.cpu_temp),
    gpuTemp: Math.round(r.gpu_temp),
    cpuUtil: Math.round(r.cpu_util),
    gpuUtil: Math.round(r.gpu_util),
    memoryUtil: Math.round(r.memory_util),
    powerWatts: Math.round(r.power_watts),
    vibration: +r.vibration.toFixed(2),
  }));
}
