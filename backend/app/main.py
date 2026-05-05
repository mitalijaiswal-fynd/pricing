from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.database import engine, Base
from app.routes import articles, pricing_rules, schemes, distributors, bulk, auth, approvals


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with engine.begin() as conn:
        try:
            await conn.execute(text(
                "ALTER TABLE schemes ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'"
            ))
        except Exception:
            pass

    from app.seed_users import seed as seed_users
    try:
        await seed_users()
    except Exception:
        pass

    yield


app = FastAPI(title="Pricing Waterfall Prototype", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(approvals.router, prefix="/api/v1")
app.include_router(articles.router, prefix="/api/v1")
app.include_router(pricing_rules.router, prefix="/api/v1")
app.include_router(schemes.router, prefix="/api/v1")
app.include_router(distributors.router, prefix="/api/v1")
app.include_router(bulk.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
