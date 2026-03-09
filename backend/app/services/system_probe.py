from __future__ import annotations

import json
import os
import platform
import socket
import subprocess
import time
from typing import Any


try:
    import psutil  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    psutil = None

try:
    import pynvml  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    pynvml = None


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _primary_ip() -> str:
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        return str(sock.getsockname()[0])
    except Exception:
        return ""
    finally:
        if sock:
            sock.close()


def get_system_about() -> dict[str, Any]:
    memory_gb = None
    if psutil:
        try:
            memory_gb = round(float(psutil.virtual_memory().total) / (1024**3), 2)
        except Exception:
            memory_gb = None

    return {
        "hostname": socket.gethostname(),
        "os": platform.system(),
        "os_version": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "ip": _primary_ip(),
        "cpu_cores": os.cpu_count() or 0,
        "memory_gb": memory_gb,
        "source": "system-about",
    }


def _cpu_util() -> float:
    if psutil:
        try:
            return float(psutil.cpu_percent(interval=0.2))
        except Exception:
            pass

    if hasattr(os, "getloadavg"):
        try:
            load_1m = os.getloadavg()[0]
            cores = max(os.cpu_count() or 1, 1)
            return float(_clamp((load_1m / cores) * 100.0, 0.0, 100.0))
        except Exception:
            pass

    return 0.0


def _memory_util() -> float:
    if psutil:
        try:
            return float(psutil.virtual_memory().percent)
        except Exception:
            pass
    return 0.0


def _cpu_temp() -> float:
    if psutil and hasattr(psutil, "sensors_temperatures"):
        try:
            data = psutil.sensors_temperatures(fahrenheit=False) or {}
            for entries in data.values():
                for entry in entries:
                    current = getattr(entry, "current", None)
                    if isinstance(current, (int, float)) and current > 0:
                        return float(current)
        except Exception:
            pass

    return 0.0


def _fan_rpm() -> float:
    if psutil and hasattr(psutil, "sensors_fans"):
        try:
            fans = psutil.sensors_fans() or {}
            for entries in fans.values():
                for entry in entries:
                    current = getattr(entry, "current", None)
                    if isinstance(current, (int, float)) and current >= 0:
                        return float(current)
        except Exception:
            pass
    return 0.0


def _gpu_metrics_from_nvml() -> tuple[float, float, float, float]:
    if not pynvml:
        return (0.0, 0.0, 0.0, 0.0)

    try:
        pynvml.nvmlInit()
        count = int(pynvml.nvmlDeviceGetCount())
        if count <= 0:
            return (0.0, 0.0, 0.0, 0.0)

        # Use first GPU for now; can be extended for multi-GPU aggregation.
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = float(pynvml.nvmlDeviceGetUtilizationRates(handle).gpu)
        temp = float(pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU))
        fan = 0.0
        try:
            fan = float(pynvml.nvmlDeviceGetFanSpeed(handle))
        except Exception:
            fan = 0.0
        power_watts = 0.0
        try:
            # NVML power usage is mW.
            power_watts = float(pynvml.nvmlDeviceGetPowerUsage(handle)) / 1000.0
        except Exception:
            power_watts = 0.0
        return (util, temp, fan, power_watts)
    except Exception:
        return (0.0, 0.0, 0.0, 0.0)
    finally:
        try:
            pynvml.nvmlShutdown()
        except Exception:
            pass


def _gpu_util_from_windows_counter() -> float:
    if platform.system().lower() != "windows":
        return 0.0

    cmd = (
        "Get-Counter '\\GPU Engine(*)\\Utilization Percentage' "
        "| Select-Object -ExpandProperty CounterSamples "
        "| Select-Object -Property CookedValue "
        "| ConvertTo-Json -Compress"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return 0.0

        parsed = json.loads(proc.stdout)
        if isinstance(parsed, dict):
            parsed = [parsed]
        values = []
        for row in parsed:
            try:
                values.append(float(row.get("CookedValue", 0.0)))
            except Exception:
                continue
        if not values:
            return 0.0
        # "Real" counter data: take the highest active engine utilization.
        return float(_clamp(max(values), 0.0, 100.0))
    except Exception:
        return 0.0


def _io_rates(sample_seconds: float = 0.3) -> tuple[float, float, float, float]:
    if not psutil:
        return (0.0, 0.0, 0.0, 0.0)

    try:
        disk_before = psutil.disk_io_counters()
        net_before = psutil.net_io_counters()
        start = time.time()
        time.sleep(sample_seconds)
        elapsed = max(time.time() - start, 0.01)
        disk_after = psutil.disk_io_counters()
        net_after = psutil.net_io_counters()
        if not disk_before or not disk_after or not net_before or not net_after:
            return (0.0, 0.0, 0.0, 0.0)

        to_mbs = 1.0 / (1024 * 1024)
        disk_read_mbs = ((disk_after.read_bytes - disk_before.read_bytes) * to_mbs) / elapsed
        disk_write_mbs = ((disk_after.write_bytes - disk_before.write_bytes) * to_mbs) / elapsed
        net_up_mbs = ((net_after.bytes_sent - net_before.bytes_sent) * to_mbs) / elapsed
        net_down_mbs = ((net_after.bytes_recv - net_before.bytes_recv) * to_mbs) / elapsed
        return (
            float(max(0.0, disk_read_mbs)),
            float(max(0.0, disk_write_mbs)),
            float(max(0.0, net_up_mbs)),
            float(max(0.0, net_down_mbs)),
        )
    except Exception:
        return (0.0, 0.0, 0.0, 0.0)


def _uptime_hours() -> float:
    if psutil:
        try:
            return float((time.time() - psutil.boot_time()) / 3600.0)
        except Exception:
            pass
    return 0.0


def _top_processes(limit: int = 10) -> list[dict[str, float | int | str]]:
    if not psutil:
        return []

    rows: list[dict[str, float | int | str]] = []
    try:
        for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            info = proc.info
            rows.append(
                {
                    "pid": int(info.get("pid") or 0),
                    "name": str(info.get("name") or ""),
                    "cpu_percent": float(info.get("cpu_percent") or 0.0),
                    "memory_percent": float(info.get("memory_percent") or 0.0),
                }
            )
    except Exception:
        return []

    rows.sort(key=lambda item: (float(item["cpu_percent"]), float(item["memory_percent"])), reverse=True)
    return rows[:limit]


def collect_telemetry_snapshot(device_type: str = "") -> dict[str, Any]:
    cpu_util = round(_cpu_util(), 2)
    memory_util = round(_memory_util(), 2)
    cpu_temp = round(_cpu_temp(), 2)

    gpu_util_nvml, gpu_temp_nvml, gpu_fan_nvml, gpu_power_nvml = _gpu_metrics_from_nvml()
    gpu_util = round(gpu_util_nvml if gpu_util_nvml > 0 else _gpu_util_from_windows_counter(), 2)
    gpu_temp = round(gpu_temp_nvml, 2)

    fan_rpm = round(_fan_rpm(), 2)
    if fan_rpm <= 0 and gpu_fan_nvml > 0:
        # Use GPU fan percentage when system fan RPM is unavailable.
        fan_rpm = round(gpu_fan_nvml, 2)

    disk_read_mbs, disk_write_mbs, net_up_mbs, net_down_mbs = _io_rates()
    uptime_hours = round(_uptime_hours(), 2)
    vibration = 0.0
    power_watts = round(gpu_power_nvml, 2)

    source_flags = {
        "cpu_util_real": cpu_util > 0,
        "memory_util_real": memory_util > 0,
        "cpu_temp_real": cpu_temp > 0,
        "gpu_util_real": gpu_util > 0,
        "gpu_temp_real": gpu_temp > 0,
        "fan_real": fan_rpm > 0,
        "power_real": power_watts > 0,
        "vibration_real": False,
    }

    return {
        "cpu_util": cpu_util,
        "gpu_util": gpu_util,
        "memory_util": memory_util,
        "cpu_temp": cpu_temp,
        "gpu_temp": gpu_temp,
        "vibration": vibration,
        "fan_rpm": fan_rpm,
        "power_watts": power_watts,
        "disk_read_mbs": round(disk_read_mbs, 3),
        "disk_write_mbs": round(disk_write_mbs, 3),
        "net_up_mbs": round(net_up_mbs, 3),
        "net_down_mbs": round(net_down_mbs, 3),
        "uptime_hours": uptime_hours,
        "processes": _top_processes(),
        "raw_payload": {
            "source": "system-realtime",
            "device_type": device_type,
            "source_flags": source_flags,
        },
    }
