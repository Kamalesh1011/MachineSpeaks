from pydantic import BaseModel


class ChatRequest(BaseModel):
    device_external_id: str | None = None
    message: str


class InsightItem(BaseModel):
    severity: str
    title: str
    explanation: str
    recommendation: str
