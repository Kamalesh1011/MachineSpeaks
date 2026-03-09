from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.insight import Insight
from app.schemas.device import DeviceCreate, DeviceOut
from app.services.system_probe import collect_telemetry_snapshot, get_system_about


router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    return db.query(Device).order_by(Device.created_at.desc()).all()


@router.post("", response_model=DeviceOut)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), _: object = Depends(require_role("engineer"))):
    existing = db.query(Device).filter(Device.external_id == payload.external_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Device already exists")

    row = Device(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/system/about")
def system_about(_: object = Depends(require_role("engineer"))):
    return get_system_about()


@router.get("/{device_id}/telemetry/latest")
def latest_telemetry(device_id: int, db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    row = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id)
        .order_by(Telemetry.ts.desc())
        .first()
    )
    if not row:
        # No telemetry yet is a normal state for newly added devices.
        return None
    return row


@router.get("/{device_id}/telemetry/history")
def telemetry_history(
    device_id: int,
    from_ts: str | None = None,
    to_ts: str | None = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    query = db.query(Telemetry).filter(Telemetry.device_id == device_id)
    if from_ts:
        query = query.filter(Telemetry.ts >= from_ts)
    if to_ts:
        query = query.filter(Telemetry.ts <= to_ts)
    rows = query.order_by(Telemetry.ts.desc()).limit(limit).all()
    return list(reversed(rows))


@router.post("/{device_id}/telemetry/fetch")
def fetch_telemetry_records(device_id: int, db: Session = Depends(get_db), _: object = Depends(require_role("engineer"))):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    snapshot = collect_telemetry_snapshot(device.type or "")
    row = Telemetry(
        device_id=device.id,
        ts=datetime.utcnow(),
        cpu_util=snapshot["cpu_util"],
        gpu_util=snapshot["gpu_util"],
        memory_util=snapshot["memory_util"],
        cpu_temp=snapshot["cpu_temp"],
        gpu_temp=snapshot["gpu_temp"],
        vibration=snapshot["vibration"],
        fan_rpm=snapshot["fan_rpm"],
        power_watts=snapshot["power_watts"],
        disk_read_mbs=snapshot["disk_read_mbs"],
        disk_write_mbs=snapshot["disk_write_mbs"],
        net_up_mbs=snapshot["net_up_mbs"],
        net_down_mbs=snapshot["net_down_mbs"],
        uptime_hours=snapshot["uptime_hours"],
        processes=snapshot["processes"],
        raw_payload={
            "source": "manual-fetch",
            "system_about": get_system_about(),
            **(snapshot.get("raw_payload") or {}),
        },
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{device_id}/insights/generate")
async def generate_insights(device_id: int, db: Session = Depends(get_db), _: object = Depends(require_role("engineer"))):
    from app.services.ai import generate_auto_insight

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    latest = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id)
        .order_by(Telemetry.ts.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No telemetry found for this device")

    telemetry_dict = {
        "cpu_util": latest.cpu_util,
        "gpu_util": latest.gpu_util,
        "memory_util": latest.memory_util,
        "cpu_temp": latest.cpu_temp,
        "gpu_temp": latest.gpu_temp,
        "vibration": latest.vibration,
        "power_watts": latest.power_watts,
    }

    items = await generate_auto_insight(device.name, telemetry_dict)
    created = []
    for item in items:
        row = Insight(
            device_id=device.id,
            severity=item.get("severity", "info"),
            title=item.get("title", "AI Insight"),
            explanation=item.get("explanation", ""),
            recommendation=item.get("recommendation", ""),
        )
        db.add(row)
        created.append(row)

    db.commit()
    return {"count": len(created), "items": items}
