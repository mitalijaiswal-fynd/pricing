import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_REPO_ROOT / ".env")
load_dotenv()


def _normalize_database_url(url: str) -> str:
    """Render/Supabase/Heroku use postgresql://; SQLAlchemy async needs asyncpg."""
    if not url:
        return url
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if u.startswith("postgresql://") and not u.startswith("postgresql+asyncpg://"):
        u = u.replace("postgresql://", "postgresql+asyncpg://", 1)
    return u


def _connect_args(url: str) -> dict:
    """Supabase and most hosted Postgres require TLS; local dev usually does not."""
    ssl_mode = os.getenv("DATABASE_SSL", "auto").lower()
    if ssl_mode in ("0", "false", "no", "off"):
        return {}
    if ssl_mode in ("1", "true", "yes", "require"):
        return {"ssl": True}
    for_check = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    try:
        host = (urlparse(for_check).hostname or "").lower()
        if host in ("localhost", "127.0.0.1", "::1"):
            return {}
    except Exception:
        pass
    return {"ssl": True}


def _default_database_url() -> str:
    return "postgresql+asyncpg://mitalijaiswal@localhost:5432/pricing_prototype"


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", _default_database_url()))

_engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}
_args = _connect_args(DATABASE_URL)
if _args:
    _engine_kwargs["connect_args"] = _args

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
