"""Seed the database with sample articles and pricing rules."""
import asyncio
from sqlalchemy import select
from app.database import engine, Base, async_session
from app.models import Article, PricingRule

SAMPLES = [
    {
        "sku": "SKU-001", "name": "Parle-G Gold 1kg", "mrp": 100,
        "rm_type": "PERCENT", "rm_value": 10,
        "dm_type": "PERCENT", "dm_base": "TRADE_PRICE", "dm_value": 5,
        "anchor_type": "ABSOLUTE", "anchor_base": "MRP", "anchor_value": 2,
    },
    {
        "sku": "SKU-002", "name": "Tata Salt 1kg", "mrp": 28,
        "rm_type": "PERCENT", "rm_value": 8,
        "dm_type": "ABSOLUTE", "dm_base": "MRP", "dm_value": 1.5,
        "anchor_type": "PERCENT", "anchor_base": "TRADE_PRICE", "anchor_value": 2,
    },
    {
        "sku": "SKU-003", "name": "Surf Excel 2kg", "mrp": 450,
        "rm_type": "ABSOLUTE", "rm_value": 40,
        "dm_type": "PERCENT", "dm_base": "MRP", "dm_value": 4,
        "anchor_type": "PERCENT", "anchor_base": "MRP", "anchor_value": 2,
    },
    {
        "sku": "SKU-004", "name": "Amul Butter 500g", "mrp": 275,
        "rm_type": "PERCENT", "rm_value": 5,
        "dm_type": "PERCENT", "dm_base": "TRADE_PRICE", "dm_value": 3,
        "anchor_type": "ABSOLUTE", "anchor_base": "MRP", "anchor_value": 5,
    },
    {
        "sku": "SKU-005", "name": "Maggi Noodles 12pk", "mrp": 168,
        "rm_type": "PERCENT", "rm_value": 12,
        "dm_type": "PERCENT", "dm_base": "MRP", "dm_value": 5,
        "anchor_type": "PERCENT", "anchor_base": "TRADE_PRICE", "anchor_value": 3,
    },
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        existing = (
            await session.execute(select(Article.id).where(Article.sku == "SKU-001").limit(1))
        ).scalar_one_or_none()
        if existing:
            print("Articles already seeded. Skipping.")
            return

        for s in SAMPLES:
            article = Article(sku=s["sku"], name=s["name"], mrp=s["mrp"])
            session.add(article)
            await session.flush()
            rule = PricingRule(
                article_id=article.id,
                rm_type=s["rm_type"], rm_value=s["rm_value"],
                dm_type=s["dm_type"], dm_base=s["dm_base"], dm_value=s["dm_value"],
                anchor_type=s["anchor_type"], anchor_base=s["anchor_base"], anchor_value=s["anchor_value"],
            )
            session.add(rule)
        await session.commit()
    print(f"Seeded {len(SAMPLES)} articles with pricing rules.")


if __name__ == "__main__":
    asyncio.run(seed())
