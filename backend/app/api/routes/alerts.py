from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertUpdate


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def list_alerts(status: str | None = None, db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    return query.order_by(Alert.created_at.desc()).all()


@router.get("/{alert_id}")
def get_alert(alert_id: int, db: Session = Depends(get_db), _: object = Depends(require_role("viewer"))):
    row = db.query(Alert).filter(Alert.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row


@router.put("/{alert_id}")
def update_alert(alert_id: int, payload: AlertUpdate, db: Session = Depends(get_db), _: object = Depends(require_role("engineer"))):
    row = db.query(Alert).filter(Alert.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    if payload.status not in {"active", "acknowledged", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    row.status = payload.status
    db.commit()
    db.refresh(row)
    return row
