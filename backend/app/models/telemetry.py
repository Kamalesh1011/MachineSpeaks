from datetime import datetime
from sqlalchemy import DateTime, Integer, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    cpu_util: Mapped[float] = mapped_column(Float, default=0)
    gpu_util: Mapped[float] = mapped_column(Float, default=0)
    memory_util: Mapped[float] = mapped_column(Float, default=0)
    cpu_temp: Mapped[float] = mapped_column(Float, default=0)
    gpu_temp: Mapped[float] = mapped_column(Float, default=0)
    vibration: Mapped[float] = mapped_column(Float, default=0)
    fan_rpm: Mapped[float] = mapped_column(Float, default=0)
    power_watts: Mapped[float] = mapped_column(Float, default=0)
    disk_read_mbs: Mapped[float] = mapped_column(Float, default=0)
    disk_write_mbs: Mapped[float] = mapped_column(Float, default=0)
    net_up_mbs: Mapped[float] = mapped_column(Float, default=0)
    net_down_mbs: Mapped[float] = mapped_column(Float, default=0)
    uptime_hours: Mapped[float] = mapped_column(Float, default=0)

    processes: Mapped[list] = mapped_column(JSON, default=list)
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
