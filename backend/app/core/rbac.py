from fastapi import HTTPException, status


ROLE_HIERARCHY = {
    "viewer": 1,
    "engineer": 2,
    "admin": 3,
}


def enforce_role(user_role: str, minimum_role: str) -> None:
    if ROLE_HIERARCHY.get(user_role, 0) < ROLE_HIERARCHY.get(minimum_role, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this action",
        )
