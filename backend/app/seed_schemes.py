"""Seed sample schemes with slab-based discount tiers."""
import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import engine, Base, async_session
from app.models import (
    Article, Distributor, DistributorSegment,
    Scheme, SchemeSlab, SchemeArticle, SchemeSegment, SchemeDistributor,
)


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        articles = {a.sku: a for a in (await session.execute(select(Article).order_by(Article.sku))).scalars().all()}
        if not articles:
            print("No articles found. Run `python -m app.seed` first.")
            return

        segments = {s.name: s for s in (await session.execute(select(DistributorSegment))).scalars().all()}
        dists = (await session.execute(select(Distributor).limit(5))).scalars().all()

        existing = (await session.execute(select(Scheme))).scalars().all()
        if existing:
            print("Schemes already seeded. Skipping.")
            return

        # 1. Parle-G Buy X Get Y with tiered slabs — All distributors
        s1 = Scheme(
            code="PARLE-G-TIERED-BOGO",
            name="Parle-G Tiered BOGO",
            description="Buy more Parle-G, get more free",
            target_audience="DISTRIBUTOR",
            discount_type="BUY_X_GET_Y",
            start_at=datetime(2026, 5, 1),
            has_end_date=False,
            eligibility_type="ALL",
        )
        session.add(s1)
        await session.flush()
        for i, (buy, free) in enumerate([(3, 1), (6, 3), (10, 5)]):
            session.add(SchemeSlab(scheme_id=s1.id, min_quantity=buy, free_quantity=free, sort_order=i))
        session.add(SchemeArticle(scheme_id=s1.id, article_id=articles["SKU-001"].id))

        # 2. Amul Butter % Off tiers — Platinum & Gold segments
        s2 = Scheme(
            code="AMUL-BUTTER-VOLUME-DISCOUNT",
            name="Amul Butter Volume Discount",
            description="Higher quantity = higher discount %",
            target_audience="DISTRIBUTOR",
            discount_type="AMOUNT_OFF_PRODUCTS",
            value_type="PERCENTAGE",
            start_at=datetime(2026, 5, 1, 9, 0),
            has_end_date=True,
            end_at=datetime(2026, 6, 30, 23, 59),
            eligibility_type="SEGMENT",
        )
        session.add(s2)
        await session.flush()
        for i, (qty, disc) in enumerate([(5, 5), (10, 10), (20, 15), (50, 20)]):
            session.add(SchemeSlab(scheme_id=s2.id, min_quantity=qty, discount_value=disc, sort_order=i))
        session.add(SchemeArticle(scheme_id=s2.id, article_id=articles["SKU-004"].id))
        if "Platinum" in segments:
            session.add(SchemeSegment(scheme_id=s2.id, segment_id=segments["Platinum"].id))
        if "Gold" in segments:
            session.add(SchemeSegment(scheme_id=s2.id, segment_id=segments["Gold"].id))

        # 3. Order value tiers — fixed amount off — specific distributors
        s3 = Scheme(
            code="ORDER-VALUE-DISCOUNT",
            name="Order Value Discount",
            description="Flat amount off based on order size",
            target_audience="RETAILER",
            discount_type="AMOUNT_OFF_ORDER",
            value_type="FIXED",
            start_at=datetime(2026, 5, 15, 0, 0),
            has_end_date=True,
            end_at=datetime(2026, 7, 15, 23, 59),
            eligibility_type="SPECIFIC",
        )
        session.add(s3)
        await session.flush()
        for i, (qty, disc) in enumerate([(10, 50), (25, 150), (50, 350)]):
            session.add(SchemeSlab(scheme_id=s3.id, min_quantity=qty, discount_value=disc, sort_order=i))
        for d in dists[:3]:
            session.add(SchemeDistributor(scheme_id=s3.id, distributor_id=d.id))

        # 4. Maggi BOGO — single slab
        s4 = Scheme(
            code="MAGGI-BUY-5-GET-2",
            name="Maggi Buy 5 Get 2",
            description="Buy 5 packs of Maggi, get 2 free",
            target_audience="RETAILER",
            discount_type="BUY_X_GET_Y",
            start_at=datetime(2026, 6, 1),
            has_end_date=False,
            eligibility_type="ALL",
        )
        session.add(s4)
        await session.flush()
        session.add(SchemeSlab(scheme_id=s4.id, min_quantity=5, free_quantity=2, sort_order=0))
        session.add(SchemeArticle(scheme_id=s4.id, article_id=articles["SKU-005"].id))

        # 5. All products % Off — Silver segment — tiered
        s5 = Scheme(
            code="SILVER-TIER-VOLUME-DISCOUNT",
            name="Silver Tier Volume Discount",
            description="Percentage off for Silver-tier distributors based on qty",
            target_audience="DISTRIBUTOR",
            discount_type="AMOUNT_OFF_PRODUCTS",
            value_type="PERCENTAGE",
            start_at=datetime(2026, 5, 1),
            has_end_date=False,
            eligibility_type="SEGMENT",
        )
        session.add(s5)
        await session.flush()
        for i, (qty, disc) in enumerate([(1, 3), (10, 5), (25, 8)]):
            session.add(SchemeSlab(scheme_id=s5.id, min_quantity=qty, discount_value=disc, sort_order=i))
        for a in articles.values():
            session.add(SchemeArticle(scheme_id=s5.id, article_id=a.id))
        if "Silver" in segments:
            session.add(SchemeSegment(scheme_id=s5.id, segment_id=segments["Silver"].id))

        await session.commit()
    print("Seeded 5 sample schemes with slab-based tiers.")


if __name__ == "__main__":
    asyncio.run(seed())
