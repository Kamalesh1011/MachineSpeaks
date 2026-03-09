from datetime import datetime
from pydantic import BaseModel


class AlertOut(BaseModel):
    id: int
    device_id: int
    severity: str
    metric: str
    value: str
    threshold: str
    message: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    status: str
