import { ingestBrowserTelemetry } from "@/lib/backend";

const DEVICE_ID_KEY = "mgai_browser_device_id";
const SESSION_START_MS = Date.now();
const HEARTBEAT_MS = 10000;

type NetInfo = {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
};

type PerfWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
};

let timer: number | null = null;

function makeId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `web-${rand}`;
}

function getOrCreateDeviceId() {
  const current = localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const created = makeId();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function browserDeviceName() {
  const platform = navigator.platform || "Browser";
  const lang = navigator.language || "unknown";
  return `Web Client (${platform}, ${lang})`;
}

function collectSnapshot() {
  const perf = performance as PerfWithMemory;
  const memory = perf.memory;
  const memoryUtil =
    memory && memory.jsHeapSizeLimit > 0
      ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      : 0;

  const navAny = navigator as Navigator & { connection?: NetInfo };
  const conn = navAny.connection;
  const downlinkMbps = conn?.downlink || 0;
  const netDownMBs = downlinkMbps / 8;

  return {
    device_external_id: getOrCreateDeviceId(),
    cpu_util: 0,
    gpu_util: 0,
    memory_util: +memoryUtil.toFixed(2),
    cpu_temp: 0,
    gpu_temp: 0,
    vibration: 0,
    fan_rpm: 0,
    power_watts: 0,
    disk_read_mbs: 0,
    disk_write_mbs: 0,
    net_up_mbs: 0,
    net_down_mbs: +netDownMBs.toFixed(3),
    uptime_hours: +((Date.now() - SESSION_START_MS) / 3600000).toFixed(4),
    processes: [],
    raw_payload: {
      source: "browser-heartbeat",
      device_name: browserDeviceName(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      language: navigator.language || "",
      languages: navigator.languages || [],
      platform: navigator.platform || "",
      user_agent: navigator.userAgent || "",
      hardware_concurrency: navigator.hardwareConcurrency || 0,
      device_memory_gb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
      online: navigator.onLine,
      connection: {
        downlink_mbps: conn?.downlink || 0,
        rtt_ms: conn?.rtt || 0,
        effective_type: conn?.effectiveType || "",
      },
      source_flags: {
        cpu_util_real: false,
        memory_util_real: Boolean(memory && memory.jsHeapSizeLimit > 0),
        gpu_util_real: false,
        cpu_temp_real: false,
        gpu_temp_real: false,
        power_real: false,
      },
    },
  };
}

async function sendOnce() {
  try {
    await ingestBrowserTelemetry(collectSnapshot());
  } catch (err) {
    console.debug("Browser telemetry heartbeat failed", err);
  }
}

export function startBrowserTelemetryHeartbeat() {
  if (typeof window === "undefined") return;
  if (timer !== null) return;

  void sendOnce();
  timer = window.setInterval(() => {
    void sendOnce();
  }, HEARTBEAT_MS);
}

export function stopBrowserTelemetryHeartbeat() {
  if (typeof window === "undefined") return;
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
}
