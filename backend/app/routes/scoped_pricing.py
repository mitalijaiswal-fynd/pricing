from __future__ import annotations
import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Article, ScopedPricingRule, SCOPE_PRIORITY
from app.schemas import ScopedPricingRuleOut, ScopedPricingRuleCreate, ScopedPricingRuleUpdate, ScopedPricingRuleBulkSave

router = APIRouter(tags=["scoped-pricing"])


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return date.fromisoformat(s) if fmt == "%Y-%m-%d" else date.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _to_out(r: ScopedPricingRule) -> ScopedPricingRuleOut:
    return ScopedPricingRuleOut(
        id=r.id,
        article_id=r.article_id,
        scope_level=r.scope_level,
        scope_value=r.scope_value,
        customer_group=r.customer_group,
        mrp=float(r.mrp),
        priority=r.priority,
        rm1=float(r.rm1),
        rm2=float(r.rm2),
        absolute_ptr=float(r.absolute_ptr) if r.absolute_ptr is not None else None,
        dm1=float(r.dm1),
        dm2=float(r.dm2),
        absolute_ptd=float(r.absolute_ptd) if r.absolute_ptd is not None else None,
        valid_from=r.valid_from.strftime("%d.%m.%Y") if r.valid_from else None,
        valid_to=r.valid_to.strftime("%d.%m.%Y") if r.valid_to else None,
    )


@router.get("/articles/{article_id}/scoped-pricing", response_model=list[ScopedPricingRuleOut])
async def list_scoped_rules(article_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ScopedPricingRule)
        .where(ScopedPricingRule.article_id == article_id)
        .order_by(ScopedPricingRule.priority)
    )
    return [_to_out(r) for r in res.scalars().all()]


@router.post("/articles/{article_id}/scoped-pricing", response_model=ScopedPricingRuleOut, status_code=201)
async def create_scoped_rule(article_id: uuid.UUID, body: ScopedPricingRuleCreate, db: AsyncSession = Depends(get_db)):
    art = await db.get(Article, article_id)
    if not art:
        raise HTTPException(404, "Article not found")
    rule = ScopedPricingRule(
        article_id=article_id,
        scope_level=body.scope_level.upper(),
        scope_value=body.scope_value,
        customer_group=body.customer_group,
        mrp=body.mrp,
        priority=SCOPE_PRIORITY.get(body.scope_level.upper(), 4),
        rm1=body.rm1, rm2=body.rm2,
        absolute_ptr=body.absolute_ptr,
        dm1=body.dm1, dm2=body.dm2,
        absolute_ptd=body.absolute_ptd,
        valid_from=_parse_date(body.valid_from),
        valid_to=_parse_date(body.valid_to),
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return _to_out(rule)


@router.put("/articles/{article_id}/scoped-pricing/{rule_id}", response_model=ScopedPricingRuleOut)
async def update_scoped_rule(
    article_id: uuid.UUID, rule_id: uuid.UUID,
    body: ScopedPricingRuleUpdate, db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(ScopedPricingRule).where(
            ScopedPricingRule.id == rule_id,
            ScopedPricingRule.article_id == article_id,
        )
    )
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "scope_level" and v:
            rule.scope_level = v.upper()
            rule.priority = SCOPE_PRIORITY.get(v.upper(), 4)
        elif k in ("valid_from", "valid_to"):
            setattr(rule, k, _parse_date(v))
        else:
            setattr(rule, k, v)
    await db.commit()
    await db.refresh(rule)
    return _to_out(rule)


@router.delete("/articles/{article_id}/scoped-pricing/{rule_id}", status_code=204)
async def delete_scoped_rule(article_id: uuid.UUID, rule_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(ScopedPricingRule).where(
            ScopedPricingRule.id == rule_id,
            ScopedPricingRule.article_id == article_id,
        )
    )
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()


@router.put("/articles/{article_id}/scoped-pricing", response_model=list[ScopedPricingRuleOut])
async def bulk_save_scoped_rules(
    article_id: uuid.UUID, body: ScopedPricingRuleBulkSave, db: AsyncSession = Depends(get_db)
):
    """Replace all scoped pricing rules for an article in one call."""
    art = await db.get(Article, article_id)
    if not art:
        raise HTTPException(404, "Article not found")
    await db.execute(delete(ScopedPricingRule).where(ScopedPricingRule.article_id == article_id))
    new_rules = []
    for b in body.rules:
        rule = ScopedPricingRule(
            article_id=article_id,
            scope_level=b.scope_level.upper(),
            scope_value=b.scope_value,
            customer_group=b.customer_group,
            mrp=b.mrp,
            priority=SCOPE_PRIORITY.get(b.scope_level.upper(), 4),
            rm1=b.rm1, rm2=b.rm2,
            absolute_ptr=b.absolute_ptr,
            dm1=b.dm1, dm2=b.dm2,
            absolute_ptd=b.absolute_ptd,
            valid_from=_parse_date(b.valid_from),
            valid_to=_parse_date(b.valid_to),
        )
        db.add(rule)
        new_rules.append(rule)
    await db.commit()
    for r in new_rules:
        await db.refresh(r)
    return [_to_out(r) for r in sorted(new_rules, key=lambda x: x.priority)]
