from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.telemetry import Telemetry
from app.services.analytics import detect_anomalies


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/timeseries")
def timeseries(
    device_id: int,
    range_hours: int = 24,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    end = datetime.utcnow()
    start = end - timedelta(hours=range_hours)
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id, Telemetry.ts >= start, Telemetry.ts <= end)
        .order_by(Telemetry.ts.asc())
        .all()
    )
    return rows


@router.get("/compare")
def compare_devices(
    device_ids: str,
    range_hours: int = 24,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    ids = [int(x.strip()) for x in device_ids.split(",") if x.strip().isdigit()]
    end = datetime.utcnow()
    start = end - timedelta(hours=range_hours)

    result = {}
    for device_id in ids:
        rows = (
            db.query(Telemetry)
            .filter(Telemetry.device_id == device_id, Telemetry.ts >= start, Telemetry.ts <= end)
            .order_by(Telemetry.ts.asc())
            .all()
        )
        result[str(device_id)] = rows
    return result


@router.get("/anomalies")
def anomalies(
    device_id: int,
    range_hours: int = 24,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    end = datetime.utcnow()
    start = end - timedelta(hours=range_hours)
    return detect_anomalies(db, device_id, start, end)
