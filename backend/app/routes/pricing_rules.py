import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, PricingRule
from app.schemas import (
    PricingRuleUpdate, RMUpdate, DMUpdate, AnchorUpdate,
    ArticleWithWaterfall, ArticleOut, PricingRuleOut, WaterfallResult,
    SimulateRequest,
)
from app.pricing import compute_waterfall

router = APIRouter(tags=["pricing"])


async def _get_article_with_rule(article_id: uuid.UUID, db: AsyncSession) -> tuple[Article, PricingRule]:
    result = await db.execute(
        select(Article).options(selectinload(Article.pricing_rule)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(404, "Article not found")
    rule = article.pricing_rule
    if not rule:
        rule = PricingRule(article_id=article.id)
        db.add(rule)
        await db.flush()
    return article, rule


def _response(article: Article, rule: PricingRule) -> ArticleWithWaterfall:
    wf = compute_waterfall(
        float(article.mrp),
        rule.rm_type, float(rule.rm_value),
        rule.dm_type, rule.dm_base, float(rule.dm_value),
        rule.anchor_type, rule.anchor_base, float(rule.anchor_value),
    )
    return ArticleWithWaterfall(
        article=ArticleOut.model_validate(article),
        pricing_rule=PricingRuleOut.model_validate(rule),
        waterfall=WaterfallResult(**wf),
    )


@router.get("/articles/{article_id}/pricing", response_model=ArticleWithWaterfall)
async def get_pricing(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    article, rule = await _get_article_with_rule(article_id, db)
    return _response(article, rule)


@router.put("/articles/{article_id}/pricing", response_model=ArticleWithWaterfall)
async def update_pricing_full(article_id: uuid.UUID, body: PricingRuleUpdate, db: AsyncSession = Depends(get_db)):
    article, rule = await _get_article_with_rule(article_id, db)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, val if not hasattr(val, "value") else val.value)
    await db.commit()
    await db.refresh(rule)
    return _response(article, rule)


@router.patch("/articles/{article_id}/pricing/rm", response_model=ArticleWithWaterfall)
async def update_rm(article_id: uuid.UUID, body: RMUpdate, db: AsyncSession = Depends(get_db)):
    article, rule = await _get_article_with_rule(article_id, db)
    rule.rm_type = body.type.value
    rule.rm_value = body.value
    await db.commit()
    await db.refresh(rule)
    return _response(article, rule)


@router.patch("/articles/{article_id}/pricing/dm", response_model=ArticleWithWaterfall)
async def update_dm(article_id: uuid.UUID, body: DMUpdate, db: AsyncSession = Depends(get_db)):
    article, rule = await _get_article_with_rule(article_id, db)
    rule.dm_type = body.type.value
    rule.dm_base = body.base.value
    rule.dm_value = body.value
    await db.commit()
    await db.refresh(rule)
    return _response(article, rule)


@router.patch("/articles/{article_id}/pricing/anchor", response_model=ArticleWithWaterfall)
async def update_anchor(article_id: uuid.UUID, body: AnchorUpdate, db: AsyncSession = Depends(get_db)):
    article, rule = await _get_article_with_rule(article_id, db)
    rule.anchor_type = body.type.value
    rule.anchor_base = body.base.value
    rule.anchor_value = body.value
    await db.commit()
    await db.refresh(rule)
    return _response(article, rule)


@router.post("/pricing/simulate", response_model=WaterfallResult)
async def simulate(body: SimulateRequest):
    wf = compute_waterfall(
        body.mrp,
        body.rm_type.value, body.rm_value,
        body.dm_type.value, body.dm_base.value, body.dm_value,
        body.anchor_type.value, body.anchor_base.value, body.anchor_value,
    )
    return WaterfallResult(**wf)
