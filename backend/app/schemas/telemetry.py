from datetime import datetime
from pydantic import BaseModel, Field


class TelemetryIn(BaseModel):
    device_external_id: str
    cpu_util: float = 0
    gpu_util: float = 0
    memory_util: float = 0
    cpu_temp: float = 0
    gpu_temp: float = 0
    vibration: float = 0
    fan_rpm: float = 0
    power_watts: float = 0
    disk_read_mbs: float = 0
    disk_write_mbs: float = 0
    net_up_mbs: float = 0
    net_down_mbs: float = 0
    uptime_hours: float = 0
    processes: list = Field(default_factory=list)
    raw_payload: dict = Field(default_factory=dict)


class TelemetryOut(BaseModel):
    id: int
    device_id: int
    ts: datetime
    cpu_util: float
    gpu_util: float
    memory_util: float
    cpu_temp: float
    gpu_temp: float
    vibration: float
    fan_rpm: float
    power_watts: float
    disk_read_mbs: float
    disk_write_mbs: float
    net_up_mbs: float
    net_down_mbs: float
    uptime_hours: float
    processes: list

    class Config:
        from_attributes = True
