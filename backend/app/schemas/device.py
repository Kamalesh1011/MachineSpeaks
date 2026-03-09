from datetime import datetime
from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    external_id: str
    name: str
    type: str
    location: str = ""
    ip: str = ""
    connection_method: str = "agent"
    specs: dict = Field(default_factory=dict)
    thresholds: dict = Field(default_factory=dict)


class DeviceOut(BaseModel):
    id: int
    external_id: str
    name: str
    type: str
    location: str
    ip: str
    connection_method: str
    specs: dict
    thresholds: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
