def compute_health_score(telemetry: dict) -> dict:
    temp = max(0, 100 - max(telemetry.get("cpu_temp", 0), telemetry.get("gpu_temp", 0)))
    util = 100 - ((telemetry.get("cpu_util", 0) + telemetry.get("gpu_util", 0)) / 2)
    memory = 100 - telemetry.get("memory_util", 0)
    vibration = max(0, 100 - telemetry.get("vibration", 0) * 20)
    uptime = min(100, telemetry.get("uptime_hours", 0) / 24)

    score = (
        temp * 0.30
        + util * 0.25
        + memory * 0.20
        + vibration * 0.15
        + uptime * 0.10
    )

    return {
        "score": round(max(0, min(100, score)), 2),
        "sub_scores": {
            "temp": round(temp, 2),
            "util": round(util, 2),
            "memory": round(memory, 2),
            "vibration": round(vibration, 2),
            "uptime": round(uptime, 2),
        },
    }
