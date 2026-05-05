import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase


def _normalize_database_url(url: str) -> str:
    """Render/Heroku provide postgresql:// URLs; SQLAlchemy async uses asyncpg."""
    if not url:
        return url
    u = url.strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://") :]
    if u.startswith("postgresql://") and not u.startswith("postgresql+asyncpg://"):
        u = u.replace("postgresql://", "postgresql+asyncpg://", 1)
    return u


DATABASE_URL = _normalize_database_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://mitalijaiswal@localhost:5432/pricing_prototype",
    )
)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
