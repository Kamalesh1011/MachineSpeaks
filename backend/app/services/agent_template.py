AGENT_TEMPLATE = r'''#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import socket
import time
import platform
from datetime import datetime, timezone
from pathlib import Path

import psutil
import requests

try:
    import pynvml
    pynvml.nvmlInit()
    GPU_ENABLED = True
except Exception:
    GPU_ENABLED = False

CONFIG_PATH = os.environ.get("GUARDIAN_AGENT_CONFIG", "guardian-agent-config.json")
DEFAULT_INTERVAL = 2
DEFAULT_QUEUE_MAX = 10000


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_config(path: str = CONFIG_PATH) -> dict:
    if not os.path.exists(path):
        raise SystemExit(f"Missing config file: {path}. Run with --setup first.")
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    cfg.setdefault("interval_seconds", DEFAULT_INTERVAL)
    cfg.setdefault("request_timeout", 10)
    cfg.setdefault("verify_tls", True)
    cfg.setdefault("ca_cert_path", "")
    cfg.setdefault("queue_db_path", "guardian-agent-queue.db")
    cfg.setdefault("max_queue_items", DEFAULT_QUEUE_MAX)
    cfg.setdefault("device_external_id", socket.gethostname().lower().replace(" ", "-"))
    return cfg


def save_config(cfg: dict, path: str = CONFIG_PATH) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
    print(f"Config saved to {path}")


def setup_wizard(path: str = CONFIG_PATH) -> None:
    print("Machine Guardian Agent Setup")
    print("----------------------------")
    server_url = input("Server URL (e.g. https://jetson.local:8000): ").strip() or "http://localhost:8000"
    api_key = input("API key: ").strip()
    device_external_id = input("Device external id (blank = hostname): ").strip() or socket.gethostname().lower().replace(" ", "-")
    interval = input("Sampling interval seconds [2]: ").strip() or "2"
    verify_tls_raw = input("Verify TLS certificate? [Y/n]: ").strip().lower()
    verify_tls = verify_tls_raw not in {"n", "no", "0", "false"}
    ca_cert = ""
    if verify_tls:
        ca_cert = input("Custom CA certificate path (optional): ").strip()

    cfg = {
        "server_url": server_url,
        "api_key": api_key,
        "device_external_id": device_external_id,
        "interval_seconds": max(1, int(interval)),
        "request_timeout": 10,
        "verify_tls": verify_tls,
        "ca_cert_path": ca_cert,
        "queue_db_path": "guardian-agent-queue.db",
        "max_queue_items": DEFAULT_QUEUE_MAX,
    }

    save_config(cfg, path)
    print("Setup complete.")


def read_gpu() -> dict:
    if not GPU_ENABLED:
        return {"gpu_util": 0, "gpu_temp": 0}
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        return {"gpu_util": float(util.gpu), "gpu_temp": float(temp)}
    except Exception:
        return {"gpu_util": 0, "gpu_temp": 0}


def top_processes(limit: int = 5) -> list:
    procs = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
        try:
            info = p.info
            procs.append({
                "pid": info.get("pid"),
                "name": info.get("name"),
                "cpu_percent": info.get("cpu_percent", 0),
                "memory_percent": info.get("memory_percent", 0),
            })
        except Exception:
            pass
    procs.sort(key=lambda x: x.get("cpu_percent", 0), reverse=True)
    return procs[:limit]


def collect(device_external_id: str) -> dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_io_counters()
    net = psutil.net_io_counters()
    temps = psutil.sensors_temperatures() if hasattr(psutil, "sensors_temperatures") else {}

    cpu_temp = 0
    for _, entries in temps.items():
        if entries:
            cpu_temp = getattr(entries[0], "current", 0) or 0
            break

    payload = {
        "device_external_id": device_external_id,
        "cpu_util": psutil.cpu_percent(interval=0.4),
        "memory_util": vm.percent,
        "cpu_temp": float(cpu_temp),
        "vibration": 0,
        "fan_rpm": 0,
        "power_watts": 0,
        "disk_read_mbs": (disk.read_bytes / 1024 / 1024) if disk else 0,
        "disk_write_mbs": (disk.write_bytes / 1024 / 1024) if disk else 0,
        "net_up_mbs": (net.bytes_sent / 1024 / 1024) if net else 0,
        "net_down_mbs": (net.bytes_recv / 1024 / 1024) if net else 0,
        "uptime_hours": (time.time() - psutil.boot_time()) / 3600,
        "processes": top_processes(),
        "raw_payload": {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "ts": utc_now_iso(),
        },
    }
    payload.update(read_gpu())
    return payload


def queue_connect(queue_db_path: str) -> sqlite3.Connection:
    db_path = Path(queue_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_ts REAL NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()
    return conn


def queue_count(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT COUNT(1) FROM queue").fetchone()
    return int(row[0] if row else 0)


def enqueue_payload(conn: sqlite3.Connection, payload: dict, max_items: int) -> None:
    if queue_count(conn) >= max_items:
        conn.execute("DELETE FROM queue WHERE id IN (SELECT id FROM queue ORDER BY id ASC LIMIT 1)")
    conn.execute(
        "INSERT INTO queue (payload, created_at, retry_count, next_retry_ts) VALUES (?, ?, 0, 0)",
        (json.dumps(payload), utc_now_iso()),
    )
    conn.commit()


def dequeue_batch(conn: sqlite3.Connection, limit: int = 50) -> list:
    now_ts = time.time()
    rows = conn.execute(
        "SELECT id, payload, retry_count FROM queue WHERE next_retry_ts <= ? ORDER BY id ASC LIMIT ?",
        (now_ts, limit),
    ).fetchall()
    out = []
    for row in rows:
        out.append({"id": row[0], "payload": json.loads(row[1]), "retry_count": row[2]})
    return out


def mark_sent(conn: sqlite3.Connection, item_id: int) -> None:
    conn.execute("DELETE FROM queue WHERE id = ?", (item_id,))
    conn.commit()


def mark_retry(conn: sqlite3.Connection, item_id: int, retry_count: int) -> None:
    next_retry_seconds = min(300, 2 ** min(retry_count + 1, 8))
    conn.execute(
        "UPDATE queue SET retry_count = ?, next_retry_ts = ? WHERE id = ?",
        (retry_count + 1, time.time() + next_retry_seconds, item_id),
    )
    conn.commit()


def request_verify_option(cfg: dict):
    if not cfg.get("verify_tls", True):
        return False
    ca = cfg.get("ca_cert_path", "").strip()
    return ca if ca else True


def send_payload(cfg: dict, payload: dict) -> bool:
    url = cfg["server_url"].rstrip("/") + "/api/v1/telemetry/ingest"
    headers = {"X-API-Key": cfg["api_key"]}
    try:
        resp = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=float(cfg.get("request_timeout", 10)),
            verify=request_verify_option(cfg),
        )
        return resp.status_code < 300
    except Exception:
        return False


def check_permissions() -> None:
    print("Running telemetry capability check...")
    print(f"- CPU telemetry: ok ({psutil.cpu_percent(interval=0.1)}%)")
    print(f"- Memory telemetry: ok ({psutil.virtual_memory().percent}%)")
    if GPU_ENABLED:
        print("- GPU telemetry: available")
    else:
        print("- GPU telemetry: unavailable (install pynvml/NVIDIA driver for GPU metrics)")


def flush_queue(conn: sqlite3.Connection, cfg: dict) -> int:
    sent = 0
    for item in dequeue_batch(conn, limit=50):
        ok = send_payload(cfg, item["payload"])
        if ok:
            mark_sent(conn, item["id"])
            sent += 1
        else:
            mark_retry(conn, item["id"], item["retry_count"])
            break
    return sent


def run_agent() -> None:
    cfg = load_config()
    conn = queue_connect(cfg.get("queue_db_path", "guardian-agent-queue.db"))
    device_external_id = cfg.get("device_external_id") or socket.gethostname().lower().replace(" ", "-")
    interval = max(1, int(cfg.get("interval_seconds", DEFAULT_INTERVAL)))

    print("Machine Guardian Agent started")
    print(f"- device_external_id: {device_external_id}")
    print(f"- server_url: {cfg.get('server_url')}")

    while True:
        payload = collect(device_external_id)
        if not send_payload(cfg, payload):
            enqueue_payload(conn, payload, int(cfg.get("max_queue_items", DEFAULT_QUEUE_MAX)))
            print(f"Send failed. queued={queue_count(conn)}")
        flushed = flush_queue(conn, cfg)
        if flushed:
            print(f"Flushed queued telemetry: {flushed}")
        time.sleep(interval)


def parse_args():
    parser = argparse.ArgumentParser(description="Machine Guardian telemetry agent")
    parser.add_argument("--setup", action="store_true", help="Run setup wizard and save config")
    parser.add_argument("--check", action="store_true", help="Check telemetry permissions/capabilities")
    parser.add_argument("--config", default=CONFIG_PATH, help="Path to config file")
    return parser.parse_args()


def main():
    args = parse_args()
    global CONFIG_PATH
    CONFIG_PATH = args.config

    if args.setup:
        setup_wizard(CONFIG_PATH)
        return
    if args.check:
        check_permissions()
        return

    run_agent()


if __name__ == "__main__":
    main()
'''

WINDOWS_INSTALL_SCRIPT = r'''param(
  [Parameter(Mandatory = $true)][string]$ServerUrl,
  [Parameter(Mandatory = $true)][string]$ApiKey,
  [string]$DeviceId = "",
  [string]$InstallDir = "$env:ProgramData\MachineGuardianAgent",
  [string]$PythonExe = "py"
)

$ErrorActionPreference = "Stop"
$serviceName = "MachineGuardianAgent"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$agentPath = Join-Path $InstallDir "guardian-agent.py"
$configPath = Join-Path $InstallDir "guardian-agent-config.json"

Invoke-WebRequest -Uri "$ServerUrl/agent/download" -OutFile $agentPath

if (-not $DeviceId) {
  $DeviceId = $env:COMPUTERNAME.ToLower()
}

$config = @{
  server_url = $ServerUrl
  api_key = $ApiKey
  device_external_id = $DeviceId
  interval_seconds = 2
  verify_tls = $true
  ca_cert_path = ""
  queue_db_path = (Join-Path $InstallDir "queue.db")
  max_queue_items = 10000
}

$config | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding UTF8

$pythonPath = (& $PythonExe -c "import sys; print(sys.executable)").Trim()
if (-not $pythonPath) {
  throw "Python 3 not found. Install Python 3.10+ and retry."
}

$binPath = "`"$pythonPath`" `"$agentPath`" --config `"$configPath`""

if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $serviceName | Out-Null
  Start-Sleep -Seconds 2
}

sc.exe create $serviceName binPath= $binPath start= auto DisplayName= "Machine Guardian Agent" | Out-Null
sc.exe description $serviceName "Collects telemetry and sends to Machine Guardian backend." | Out-Null
Start-Service -Name $serviceName
Write-Host "Agent installed and service started: $serviceName"
'''

LINUX_INSTALL_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root: sudo bash install-agent.sh"
  exit 1
fi

SERVER_URL="${1:-http://localhost:8000}"
API_KEY="${2:-}"
DEVICE_ID="${3:-$(hostname | tr '[:upper:]' '[:lower:]')}"
INSTALL_DIR="/opt/machine-guardian-agent"
SERVICE_FILE="/etc/systemd/system/machine-guardian-agent.service"

if [ -z "$API_KEY" ]; then
  echo "Usage: sudo bash install-agent.sh <SERVER_URL> <API_KEY> [DEVICE_ID]"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
curl -fsSL "$SERVER_URL/agent/download" -o "$INSTALL_DIR/guardian-agent.py"

cat > "$INSTALL_DIR/guardian-agent-config.json" <<JSON
{
  "server_url": "$SERVER_URL",
  "api_key": "$API_KEY",
  "device_external_id": "$DEVICE_ID",
  "interval_seconds": 2,
  "verify_tls": true,
  "ca_cert_path": "",
  "queue_db_path": "$INSTALL_DIR/queue.db",
  "max_queue_items": 10000
}
JSON

python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install psutil requests pynvml

cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=Machine Guardian Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/.venv/bin/python $INSTALL_DIR/guardian-agent.py --config $INSTALL_DIR/guardian-agent-config.json
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable machine-guardian-agent
systemctl restart machine-guardian-agent
systemctl status machine-guardian-agent --no-pager
'''

MACOS_INSTALL_SCRIPT = r'''#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${1:-http://localhost:8000}"
API_KEY="${2:-}"
DEVICE_ID="${3:-$(scutil --get ComputerName | tr '[:upper:]' '[:lower:]')}"
INSTALL_DIR="/usr/local/machine-guardian-agent"
PLIST="$HOME/Library/LaunchAgents/com.machineguardian.agent.plist"

if [ -z "$API_KEY" ]; then
  echo "Usage: bash install-agent-macos.sh <SERVER_URL> <API_KEY> [DEVICE_ID]"
  exit 1
fi

mkdir -p "$INSTALL_DIR"
curl -fsSL "$SERVER_URL/agent/download" -o "$INSTALL_DIR/guardian-agent.py"

cat > "$INSTALL_DIR/guardian-agent-config.json" <<JSON
{
  "server_url": "$SERVER_URL",
  "api_key": "$API_KEY",
  "device_external_id": "$DEVICE_ID",
  "interval_seconds": 2,
  "verify_tls": true,
  "ca_cert_path": "",
  "queue_db_path": "$INSTALL_DIR/queue.db",
  "max_queue_items": 10000
}
JSON

python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install psutil requests pynvml

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.machineguardian.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/.venv/bin/python</string>
    <string>$INSTALL_DIR/guardian-agent.py</string>
    <string>--config</string>
    <string>$INSTALL_DIR/guardian-agent-config.json</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>$INSTALL_DIR</string>
  <key>StandardOutPath</key><string>$INSTALL_DIR/agent.out.log</string>
  <key>StandardErrorPath</key><string>$INSTALL_DIR/agent.err.log</string>
</dict>
</plist>
PLIST

launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"
echo "Agent installed via launchd: com.machineguardian.agent"
'''
