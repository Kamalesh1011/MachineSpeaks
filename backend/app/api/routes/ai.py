from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.device import Device
from app.models.telemetry import Telemetry
from app.schemas.ai import ChatRequest
from app.services.ai import claude_chat


router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat")
async def ai_chat(payload: ChatRequest, db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    context = {}
    if payload.device_external_id:
        device = db.query(Device).filter(Device.external_id == payload.device_external_id).first()
        if device:
            latest = (
                db.query(Telemetry)
                .filter(Telemetry.device_id == device.id)
                .order_by(Telemetry.ts.desc())
                .first()
            )
            context = {
                "device": device.name,
                "external_id": device.external_id,
                "telemetry": {
                    "cpu_util": latest.cpu_util if latest else None,
                    "gpu_util": latest.gpu_util if latest else None,
                    "memory_util": latest.memory_util if latest else None,
                    "cpu_temp": latest.cpu_temp if latest else None,
                    "gpu_temp": latest.gpu_temp if latest else None,
                    "vibration": latest.vibration if latest else None,
                },
            }

    text = await claude_chat(payload.message, context=context)

    async def streamer():
        for chunk in text.split(" "):
            yield chunk + " "

    return StreamingResponse(streamer(), media_type="text/plain")
