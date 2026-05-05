import uuid
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User

router = APIRouter(tags=["auth"])


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.role, User.display_name))
    users = result.scalars().all()
    return [
        {"id": str(u.id), "username": u.username, "display_name": u.display_name, "role": u.role}
        for u in users
    ]


@router.post("/auth/login")
async def login(body: dict, db: AsyncSession = Depends(get_db)):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id is required")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return {"id": str(user.id), "username": user.username, "display_name": user.display_name, "role": user.role}


@router.get("/auth/me")
async def get_current_user(x_user_id: str = Header(None), db: AsyncSession = Depends(get_db)):
    if not x_user_id:
        raise HTTPException(401, "Not authenticated")
    result = await db.execute(select(User).where(User.id == uuid.UUID(x_user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Invalid user")
    return {"id": str(user.id), "username": user.username, "display_name": user.display_name, "role": user.role}


async def get_current_user_dep(x_user_id: str = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    """Dependency for routes that need the current user."""
    if not x_user_id:
        raise HTTPException(401, "Not authenticated — X-User-Id header required")
    try:
        uid = uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(401, "Invalid X-User-Id")
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User not found")
    return user
