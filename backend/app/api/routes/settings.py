from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.settings import AppSetting
from app.schemas.settings import SettingsUpdate


router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings_payload(db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    row = db.query(AppSetting).first()
    if not row:
        row = AppSetting(retention_days=90, default_thresholds={})
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.put("")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    row = db.query(AppSetting).first()
    if not row:
        row = AppSetting(retention_days=payload.retention_days, default_thresholds=payload.default_thresholds)
        db.add(row)
    else:
        row.retention_days = payload.retention_days
        row.default_thresholds = payload.default_thresholds
    db.commit()
    db.refresh(row)
    return row
