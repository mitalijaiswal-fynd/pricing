import os
import ssl as ssl_module
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


def _hostname(url: str) -> str:
    for_check = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    try:
        return (urlparse(for_check).hostname or "").lower()
    except Exception:
        return ""


def _ssl_context_no_verify() -> ssl_module.SSLContext:
    """TLS encrypted channel without verifying server cert (needed for Render Postgres + asyncpg)."""
    ctx = ssl_module.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl_module.CERT_NONE
    return ctx


def _connect_args(url: str) -> dict:
    """TLS for remote Postgres.

    Render Postgres + asyncpg + ssl=True hits SSLCertVerificationError (self-signed / non-public CA).
    Render injects RENDER=true on web services — use relaxed SSL for DB connections unless overridden.
    """
    ssl_mode = os.getenv("DATABASE_SSL", "auto").lower()
    if ssl_mode in ("0", "false", "no", "off"):
        return {}

    host = _hostname(url)
    if host in ("localhost", "127.0.0.1", "::1"):
        return {}

    strict_verify = os.getenv("DATABASE_SSL_VERIFY", "").lower() in ("1", "true", "yes")

    # Primary fix: on Render's platform, Postgres TLS does not verify with default ssl=True / asyncpg.
    if os.getenv("RENDER") == "true" and not strict_verify:
        return {"ssl": _ssl_context_no_verify()}

    # Fallback if hostname parsing works (passwords with @ can break urlparse)
    if not strict_verify and host and (
        "postgres.render.com" in host
        or (host.endswith(".render.com") and ("dpg-" in host or "postgres" in host))
    ):
        return {"ssl": _ssl_context_no_verify()}

    if "render.com" in url.lower() and not strict_verify:
        return {"ssl": _ssl_context_no_verify()}

    if os.getenv("DATABASE_SSL_NO_VERIFY", "").lower() in ("1", "true", "yes"):
        return {"ssl": _ssl_context_no_verify()}

    if ssl_mode in ("1", "true", "yes", "require"):
        return {"ssl": True}

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
