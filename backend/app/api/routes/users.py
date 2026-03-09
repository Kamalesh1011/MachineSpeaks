import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User
from app.models.api_key import APIKey
from app.schemas.auth import UserCreate, UserOut


router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    if db.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first():
        raise HTTPException(status_code=400, detail="User already exists")
    row = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{user_id}/deactivate")
def deactivate_user(user_id: int, db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/api-keys")
def create_api_key(name: str, db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    plain = "mg_" + secrets.token_urlsafe(24)
    row = APIKey(name=name, key_hash=hash_password(plain), is_active=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "name": row.name, "api_key": plain}


@router.get("/api-keys")
def list_api_keys(db: Session = Depends(get_db), _: object = Depends(require_role("admin"))):
    keys = db.query(APIKey).order_by(APIKey.created_at.desc()).all()
    return [{"id": k.id, "name": k.name, "is_active": k.is_active, "created_at": k.created_at} for k in keys]
