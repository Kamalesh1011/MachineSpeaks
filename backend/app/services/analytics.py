from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.telemetry import Telemetry


def detect_anomalies(db: Session, device_id: int, start: datetime, end: datetime) -> list[dict]:
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id, Telemetry.ts >= start, Telemetry.ts <= end)
        .order_by(Telemetry.ts.asc())
        .all()
    )

    if not rows:
        return []

    avg = sum(r.cpu_temp for r in rows) / len(rows)
    threshold = avg + 12
    markers = []
    for row in rows:
        if row.cpu_temp > threshold:
            markers.append({"ts": row.ts.isoformat(), "metric": "cpu_temp", "value": row.cpu_temp, "reason": "spike"})
    return markers
