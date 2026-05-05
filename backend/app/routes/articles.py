from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, PricingRule
from app.schemas import (
    ArticleCreate, ArticleUpdate, ArticleWithWaterfall, ArticleOut, PricingRuleOut, WaterfallResult,
)
from app.pricing import compute_waterfall

router = APIRouter(tags=["articles"])


def _build_waterfall(article: Article, rule: PricingRule | None) -> ArticleWithWaterfall:
    art_out = ArticleOut.model_validate(article)
    if rule is None:
        return ArticleWithWaterfall(article=art_out)
    pr_out = PricingRuleOut.model_validate(rule)
    wf = compute_waterfall(
        float(article.mrp),
        rule.rm_type, float(rule.rm_value),
        rule.dm_type, rule.dm_base, float(rule.dm_value),
        rule.anchor_type, rule.anchor_base, float(rule.anchor_value),
    )
    return ArticleWithWaterfall(article=art_out, pricing_rule=pr_out, waterfall=WaterfallResult(**wf))


@router.get("/articles", response_model=list[ArticleWithWaterfall])
async def list_articles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Article).options(selectinload(Article.pricing_rule)).order_by(Article.sku)
    )
    articles = result.scalars().all()
    return [_build_waterfall(a, a.pricing_rule) for a in articles]


@router.post("/articles", response_model=ArticleWithWaterfall, status_code=201)
async def create_article(body: ArticleCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Article).where(Article.sku == body.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"An article with SKU '{body.sku}' already exists")
    article = Article(sku=body.sku, name=body.name, mrp=body.mrp)
    rule = PricingRule(article=article)
    db.add(article)
    db.add(rule)
    await db.commit()
    await db.refresh(article)
    await db.refresh(rule)
    return _build_waterfall(article, rule)


@router.get("/articles/{article_id}", response_model=ArticleWithWaterfall)
async def get_article(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Article).options(selectinload(Article.pricing_rule)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(404, "Article not found")
    return _build_waterfall(article, article.pricing_rule)


@router.put("/articles/{article_id}", response_model=ArticleWithWaterfall)
async def update_article(article_id: uuid.UUID, body: ArticleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Article).options(selectinload(Article.pricing_rule)).where(Article.id == article_id)
    )
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(404, "Article not found")
    if body.sku is not None:
        article.sku = body.sku
    if body.name is not None:
        article.name = body.name
    if body.mrp is not None:
        article.mrp = body.mrp
    await db.commit()
    await db.refresh(article)
    return _build_waterfall(article, article.pricing_rule)


@router.delete("/articles/{article_id}", status_code=204)
async def delete_article(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(404, "Article not found")
    await db.delete(article)
    await db.commit()
