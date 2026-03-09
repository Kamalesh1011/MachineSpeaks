from app.schemas.telemetry import TelemetryIn


def evaluate_thresholds(payload: TelemetryIn, thresholds: dict) -> list[dict]:
    alerts: list[dict] = []

    def check(metric_name: str, value: float):
        config = thresholds.get(metric_name, {})
        warn = config.get("warning")
        crit = config.get("critical")
        if crit is not None and value >= crit:
            alerts.append(
                {
                    "severity": "critical",
                    "metric": metric_name,
                    "value": f"{value}",
                    "threshold": str(crit),
                    "message": f"{metric_name} crossed critical threshold",
                }
            )
        elif warn is not None and value >= warn:
            alerts.append(
                {
                    "severity": "warning",
                    "metric": metric_name,
                    "value": f"{value}",
                    "threshold": str(warn),
                    "message": f"{metric_name} crossed warning threshold",
                }
            )

    check("cpu_temp", payload.cpu_temp)
    check("gpu_temp", payload.gpu_temp)
    check("memory_util", payload.memory_util)
    check("vibration", payload.vibration)
    check("cpu_util", payload.cpu_util)
    check("gpu_util", payload.gpu_util)

    return alerts
