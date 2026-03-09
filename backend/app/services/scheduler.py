from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.models.insight import Insight
from app.services.ai import generate_auto_insight
from app.services.system_probe import collect_telemetry_snapshot, get_system_about


scheduler = AsyncIOScheduler()


async def collect_for_local_devices() -> None:
    db: Session = SessionLocal()
    try:
        rows = db.query(Device).all()
        system_hostname = (get_system_about().get("hostname") or "").lower()
        for device in rows:
            specs = device.specs or {}
            source = str(specs.get("source") or "").lower()
            is_local_source = source == "system-about"
            is_manual = str(device.connection_method or "").lower() == "manual"
            is_hostname_device = str(device.external_id or "").lower() == system_hostname
            if not (is_local_source or is_manual or is_hostname_device):
                continue

            snapshot = collect_telemetry_snapshot(device.type or "")
            db.add(
                Telemetry(
                    device_id=device.id,
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
                        "source": "scheduler-auto-fetch",
                        "system_about": get_system_about(),
                        **(snapshot.get("raw_payload") or {}),
                    },
                )
            )
        db.commit()
    finally:
        db.close()


async def generate_for_all_devices() -> None:
    db: Session = SessionLocal()
    try:
        devices = db.query(Device).all()
        for device in devices:
            latest = (
                db.query(Telemetry)
                .filter(Telemetry.device_id == device.id)
                .order_by(Telemetry.ts.desc())
                .first()
            )
            if not latest:
                continue

            telemetry_dict = {
                "cpu_util": latest.cpu_util,
                "gpu_util": latest.gpu_util,
                "memory_util": latest.memory_util,
                "cpu_temp": latest.cpu_temp,
                "gpu_temp": latest.gpu_temp,
                "vibration": latest.vibration,
                "power_watts": latest.power_watts,
            }
            insights = await generate_auto_insight(device.name, telemetry_dict)
            for item in insights:
                db.add(
                    Insight(
                        device_id=device.id,
                        severity=item.get("severity", "info"),
                        title=item.get("title", "Insight"),
                        explanation=item.get("explanation", ""),
                        recommendation=item.get("recommendation", ""),
                    )
                )
        db.commit()
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return

    # Automatic telemetry collection for local/manual devices.
    scheduler.add_job(collect_for_local_devices, "interval", seconds=8, id="auto_collect_local_telemetry")
    # AsyncIOScheduler can run coroutine jobs directly.
    scheduler.add_job(generate_for_all_devices, "interval", seconds=30, id="auto_insights")
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
