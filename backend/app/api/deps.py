from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import get_settings
from app.core.rbac import enforce_role
from app.models.user import User
from app.models.api_key import APIKey
from app.core.security import verify_password


settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = db.query(User).filter(User.username == username, User.is_active.is_(True)).first()
    if not user:
        raise credentials_exception
    return user


def require_role(min_role: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        enforce_role(user.role, min_role)
        return user

    return dependency


def validate_api_key(raw_key: str, db: Session) -> bool:
    record = db.query(APIKey).filter(APIKey.is_active.is_(True)).all()
    for key_row in record:
        if verify_password(raw_key, key_row.key_hash):
            return True
    return False
