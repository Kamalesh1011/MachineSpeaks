from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_role, validate_api_key
from app.core.config import get_settings
from app.core.database import get_db
from app.models.alert import Alert
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.schemas.telemetry import TelemetryIn
from app.services.alerts import evaluate_thresholds
from app.services.health import compute_health_score
from app.services.notifications import notify_alert
from app.services.websocket_manager import ws_manager


router = APIRouter(prefix="/telemetry", tags=["telemetry"])
settings = get_settings()


def _browser_device_name(payload: TelemetryIn) -> str:
    raw = payload.raw_payload or {}
    name = str(raw.get("device_name") or "").strip()
    if name:
        return name
    return payload.device_external_id


def _browser_device_specs(payload: TelemetryIn, request: Request) -> dict:
    raw = payload.raw_payload or {}
    return {
        **raw,
        "source": "browser-heartbeat",
        "user_agent": request.headers.get("user-agent", ""),
        "accept_language": request.headers.get("accept-language", ""),
    }


@router.post("/ingest")
async def ingest_telemetry(
    payload: TelemetryIn,
    request: Request,
    x_api_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    if settings.ENFORCE_HTTPS_INGEST:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if str(proto).lower() != "https":
            raise HTTPException(status_code=400, detail="HTTPS is required for telemetry ingest")

    if not validate_api_key(x_api_key, db):
        raise HTTPException(status_code=401, detail="Invalid API key")

    device = db.query(Device).filter(Device.external_id == payload.device_external_id).first()
    if not device:
        device = Device(
            external_id=payload.device_external_id,
            name=payload.device_external_id,
            type="auto-discovered",
            location="unknown",
            ip=payload.raw_payload.get("ip", ""),
            connection_method="agent",
            specs=payload.raw_payload,
            thresholds={},
        )
        db.add(device)
        db.flush()

    row = Telemetry(
        device_id=device.id,
        ts=datetime.utcnow(),
        cpu_util=payload.cpu_util,
        gpu_util=payload.gpu_util,
        memory_util=payload.memory_util,
        cpu_temp=payload.cpu_temp,
        gpu_temp=payload.gpu_temp,
        vibration=payload.vibration,
        fan_rpm=payload.fan_rpm,
        power_watts=payload.power_watts,
        disk_read_mbs=payload.disk_read_mbs,
        disk_write_mbs=payload.disk_write_mbs,
        net_up_mbs=payload.net_up_mbs,
        net_down_mbs=payload.net_down_mbs,
        uptime_hours=payload.uptime_hours,
        processes=payload.processes,
        raw_payload=payload.raw_payload,
    )
    db.add(row)

    thresholds = device.thresholds or {}
    generated = evaluate_thresholds(payload, thresholds)
    for item in generated:
        alert = Alert(
            device_id=device.id,
            severity=item["severity"],
            metric=item["metric"],
            value=item["value"],
            threshold=item["threshold"],
            message=item["message"],
            status="active",
        )
        db.add(alert)
        await notify_alert(item)

    db.commit()
    db.refresh(row)

    health = compute_health_score(payload.model_dump())
    broadcast_payload = {
        "device_id": device.id,
        "telemetry": {
            "ts": row.ts.isoformat(),
            "cpu_util": row.cpu_util,
            "gpu_util": row.gpu_util,
            "memory_util": row.memory_util,
            "cpu_temp": row.cpu_temp,
            "gpu_temp": row.gpu_temp,
            "vibration": row.vibration,
            "fan_rpm": row.fan_rpm,
            "power_watts": row.power_watts,
            "disk_read_mbs": row.disk_read_mbs,
            "disk_write_mbs": row.disk_write_mbs,
            "net_up_mbs": row.net_up_mbs,
            "net_down_mbs": row.net_down_mbs,
            "uptime_hours": row.uptime_hours,
            "processes": row.processes,
        },
        "health": health,
    }
    await ws_manager.broadcast_to_device(device.id, broadcast_payload)

    return {"ok": True, "device_id": device.id, "health": health, "alerts_created": len(generated)}


@router.post("/browser/ingest")
async def ingest_browser_telemetry(
    payload: TelemetryIn,
    request: Request,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    device = db.query(Device).filter(Device.external_id == payload.device_external_id).first()
    specs = _browser_device_specs(payload, request)
    ip_addr = request.client.host if request.client else ""

    if not device:
        device = Device(
            external_id=payload.device_external_id,
            name=_browser_device_name(payload),
            type="web-client",
            location=str(specs.get("timezone") or "web"),
            ip=ip_addr,
            connection_method="browser",
            specs=specs,
            thresholds={},
        )
        db.add(device)
        db.flush()
    else:
        device.name = _browser_device_name(payload)
        device.location = str(specs.get("timezone") or device.location or "web")
        if ip_addr:
            device.ip = ip_addr
        device.connection_method = "browser"
        device.specs = {**(device.specs or {}), **specs}

    row = Telemetry(
        device_id=device.id,
        ts=datetime.utcnow(),
        cpu_util=payload.cpu_util,
        gpu_util=payload.gpu_util,
        memory_util=payload.memory_util,
        cpu_temp=payload.cpu_temp,
        gpu_temp=payload.gpu_temp,
        vibration=payload.vibration,
        fan_rpm=payload.fan_rpm,
        power_watts=payload.power_watts,
        disk_read_mbs=payload.disk_read_mbs,
        disk_write_mbs=payload.disk_write_mbs,
        net_up_mbs=payload.net_up_mbs,
        net_down_mbs=payload.net_down_mbs,
        uptime_hours=payload.uptime_hours,
        processes=payload.processes,
        raw_payload=payload.raw_payload,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    health = compute_health_score(payload.model_dump())
    await ws_manager.broadcast_to_device(
        device.id,
        {
            "device_id": device.id,
            "telemetry": {
                "ts": row.ts.isoformat(),
                "cpu_util": row.cpu_util,
                "gpu_util": row.gpu_util,
                "memory_util": row.memory_util,
                "cpu_temp": row.cpu_temp,
                "gpu_temp": row.gpu_temp,
                "vibration": row.vibration,
                "fan_rpm": row.fan_rpm,
                "power_watts": row.power_watts,
                "disk_read_mbs": row.disk_read_mbs,
                "disk_write_mbs": row.disk_write_mbs,
                "net_up_mbs": row.net_up_mbs,
                "net_down_mbs": row.net_down_mbs,
                "uptime_hours": row.uptime_hours,
                "processes": row.processes,
            },
            "health": health,
        },
    )

    return {"ok": True, "device_id": device.id, "health": health}


@router.get("/export/csv")
def export_csv(
    device_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_role("viewer")),
):
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id)
        .order_by(Telemetry.ts.asc())
        .all()
    )

    def generate():
        header = "ts,cpu_util,gpu_util,memory_util,cpu_temp,gpu_temp,vibration,power_watts\n"
        yield header
        for r in rows:
            yield f"{r.ts.isoformat()},{r.cpu_util},{r.gpu_util},{r.memory_util},{r.cpu_temp},{r.gpu_temp},{r.vibration},{r.power_watts}\n"

    return StreamingResponse(generate(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=telemetry.csv"})
