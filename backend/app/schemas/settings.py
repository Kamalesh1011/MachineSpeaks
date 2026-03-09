from pydantic import BaseModel, Field


class SettingsUpdate(BaseModel):
    retention_days: int = 90
    default_thresholds: dict = Field(default_factory=dict)


class SettingsOut(BaseModel):
    retention_days: int
    default_thresholds: dict


class APIKeyCreate(BaseModel):
    name: str


class APIKeyOut(BaseModel):
    id: int
    name: str
    is_active: bool
