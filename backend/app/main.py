from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import articles, pricing_rules, schemes, distributors, bulk


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Pricing Waterfall Prototype", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles.router, prefix="/api/v1")
app.include_router(pricing_rules.router, prefix="/api/v1")
app.include_router(schemes.router, prefix="/api/v1")
app.include_router(distributors.router, prefix="/api/v1")
app.include_router(bulk.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
