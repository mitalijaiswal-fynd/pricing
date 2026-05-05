from __future__ import annotations
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Scheme, SchemeSlab, SchemeArticle, SchemeSegment, SchemeDistributor,
    Distributor, DistributorSegment, Article,
)
from app.scheme_schemas import (
    SchemeCreate, SchemeUpdate, SchemeOut, SchemeArticleOut,
    SlabOut, DistributorSegmentOut, DistributorOut,
    DISCOUNT_TYPE_LABELS,
)


def _strip_tz(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


def _sanitize_to_code(name: str) -> str:
    code = name.upper().strip()
    code = re.sub(r"[^A-Z0-9]+", "-", code)
    code = code.strip("-")
    return code or "SCHEME"


async def _unique_code(base_code: str, db: AsyncSession) -> str:
    """Ensure code is unique by appending -2, -3, etc. if needed."""
    code = base_code
    suffix = 1
    while True:
        existing = await db.execute(select(sa_func.count()).where(Scheme.code == code))
        if existing.scalar() == 0:
            return code
        suffix += 1
        code = f"{base_code}-{suffix}"

router = APIRouter(tags=["schemes"])


def _scheme_load_options():
    return (
        selectinload(Scheme.slabs),
        selectinload(Scheme.articles).selectinload(SchemeArticle.article),
        selectinload(Scheme.eligible_segments).selectinload(SchemeSegment.segment),
        selectinload(Scheme.eligible_distributors).selectinload(SchemeDistributor.distributor).selectinload(Distributor.segment),
    )


def _to_out(scheme: Scheme) -> SchemeOut:
    slab_list = []
    for sl in scheme.slabs:
        slab_list.append(SlabOut(
            id=sl.id, min_quantity=sl.min_quantity,
            free_quantity=sl.free_quantity,
            discount_value=float(sl.discount_value) if sl.discount_value is not None else None,
            sort_order=sl.sort_order,
        ))

    art_list = []
    for sa in scheme.articles:
        art = sa.article
        art_list.append(SchemeArticleOut(
            id=sa.id, article_id=sa.article_id,
            article_sku=art.sku if art else None,
            article_name=art.name if art else None,
        ))

    seg_list = []
    for ss in scheme.eligible_segments:
        seg = ss.segment
        if seg:
            seg_list.append(DistributorSegmentOut.model_validate(seg))

    dist_list = []
    for sd in scheme.eligible_distributors:
        d = sd.distributor
        if d:
            out = DistributorOut.model_validate(d)
            out.segment_name = d.segment.name if d.segment else None
            dist_list.append(out)

    return SchemeOut(
        id=scheme.id, code=scheme.code, name=scheme.name, description=scheme.description,
        target_audience=scheme.target_audience,
        discount_type=scheme.discount_type,
        value_type=scheme.value_type,
        slabs=slab_list,
        start_at=scheme.start_at, has_end_date=scheme.has_end_date, end_at=scheme.end_at,
        is_active=scheme.is_active, eligibility_type=scheme.eligibility_type,
        articles=art_list, segments=seg_list, distributors=dist_list,
    )


def _validate_slabs(discount_type: str, slabs, value_type: str | None):
    for i, slab in enumerate(slabs):
        if discount_type == "BUY_X_GET_Y":
            if not slab.free_quantity:
                raise HTTPException(400, f"Slab {i+1}: free_quantity is required for Buy X Get Y")
        else:
            if slab.discount_value is None:
                raise HTTPException(400, f"Slab {i+1}: discount_value is required for Amount Off schemes")
            if value_type is None:
                raise HTTPException(400, "value_type (PERCENTAGE or FIXED) is required for Amount Off schemes")


@router.get("/schemes/types")
async def get_scheme_types():
    return {"types": list(DISCOUNT_TYPE_LABELS.keys()), "labels": DISCOUNT_TYPE_LABELS}


@router.get("/schemes", response_model=list[SchemeOut])
async def list_schemes(discount_type: str | None = None, target_audience: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Scheme).options(*_scheme_load_options()).order_by(Scheme.created_at.desc())
    if discount_type:
        q = q.where(Scheme.discount_type == discount_type)
    if target_audience:
        q = q.where(Scheme.target_audience == target_audience)
    result = await db.execute(q)
    return [_to_out(s) for s in result.scalars().unique().all()]


@router.post("/schemes", response_model=SchemeOut, status_code=201)
async def create_scheme(body: SchemeCreate, db: AsyncSession = Depends(get_db)):
    _validate_slabs(body.discount_type.value, body.slabs, body.value_type.value if body.value_type else None)

    if body.discount_type.value in ("BUY_X_GET_Y", "AMOUNT_OFF_PRODUCTS"):
        if not body.articles:
            raise HTTPException(400, "At least one article must be selected for this scheme type")

    code = await _unique_code(_sanitize_to_code(body.name), db)

    scheme = Scheme(
        code=code, name=body.name, description=body.description,
        target_audience=body.target_audience.value,
        discount_type=body.discount_type.value,
        value_type=body.value_type.value if body.value_type else None,
        start_at=_strip_tz(body.start_at), has_end_date=body.has_end_date,
        end_at=_strip_tz(body.end_at) if body.has_end_date else None,
        is_active=body.is_active,
        eligibility_type=body.eligibility_type.value,
    )
    db.add(scheme)
    await db.flush()

    for i, slab in enumerate(body.slabs):
        db.add(SchemeSlab(
            scheme_id=scheme.id, min_quantity=slab.min_quantity,
            free_quantity=slab.free_quantity, discount_value=slab.discount_value,
            sort_order=i,
        ))

    if body.articles:
        for a in body.articles:
            db.add(SchemeArticle(scheme_id=scheme.id, article_id=a.article_id))

    if body.eligibility_type.value == "SEGMENT" and body.segment_ids:
        for seg_id in body.segment_ids:
            db.add(SchemeSegment(scheme_id=scheme.id, segment_id=seg_id))
    elif body.eligibility_type.value == "SPECIFIC" and body.distributor_ids:
        for dist_id in body.distributor_ids:
            db.add(SchemeDistributor(scheme_id=scheme.id, distributor_id=dist_id))

    await db.commit()
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme.id))
    return _to_out(result.scalar_one())


@router.get("/schemes/{scheme_id}", response_model=SchemeOut)
async def get_scheme(scheme_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme_id))
    scheme = result.scalar_one_or_none()
    if not scheme:
        raise HTTPException(404, "Scheme not found")
    return _to_out(scheme)


@router.put("/schemes/{scheme_id}", response_model=SchemeOut)
async def update_scheme(scheme_id: uuid.UUID, body: SchemeUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme_id))
    scheme = result.scalar_one_or_none()
    if not scheme:
        raise HTTPException(404, "Scheme not found")

    for field in ("description", "has_end_date", "is_active"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(scheme, field, val)

    if body.target_audience is not None:
        scheme.target_audience = body.target_audience.value

    if body.start_at is not None:
        scheme.start_at = _strip_tz(body.start_at)
    if body.end_at is not None:
        scheme.end_at = _strip_tz(body.end_at)

    if body.value_type is not None:
        scheme.value_type = body.value_type.value
    if body.eligibility_type is not None:
        scheme.eligibility_type = body.eligibility_type.value

    if not scheme.has_end_date:
        scheme.end_at = None

    if body.slabs is not None:
        vt = body.value_type.value if body.value_type else scheme.value_type
        _validate_slabs(scheme.discount_type, body.slabs, vt)
        for sl in list(scheme.slabs):
            await db.delete(sl)
        await db.flush()
        for i, slab in enumerate(body.slabs):
            db.add(SchemeSlab(
                scheme_id=scheme.id, min_quantity=slab.min_quantity,
                free_quantity=slab.free_quantity, discount_value=slab.discount_value,
                sort_order=i,
            ))

    if body.articles is not None:
        for sa in list(scheme.articles):
            await db.delete(sa)
        await db.flush()
        for a in body.articles:
            db.add(SchemeArticle(scheme_id=scheme.id, article_id=a.article_id))

    if body.segment_ids is not None:
        for ss in list(scheme.eligible_segments):
            await db.delete(ss)
        await db.flush()
        for seg_id in body.segment_ids:
            db.add(SchemeSegment(scheme_id=scheme.id, segment_id=seg_id))

    if body.distributor_ids is not None:
        for sd in list(scheme.eligible_distributors):
            await db.delete(sd)
        await db.flush()
        for dist_id in body.distributor_ids:
            db.add(SchemeDistributor(scheme_id=scheme.id, distributor_id=dist_id))

    await db.commit()
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme.id))
    return _to_out(result.scalar_one())


@router.delete("/schemes/{scheme_id}", status_code=204)
async def delete_scheme(scheme_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scheme).where(Scheme.id == scheme_id))
    scheme = result.scalar_one_or_none()
    if not scheme:
        raise HTTPException(404, "Scheme not found")
    await db.delete(scheme)
    await db.commit()


@router.patch("/schemes/{scheme_id}/toggle", response_model=SchemeOut)
async def toggle_scheme(scheme_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme_id))
    scheme = result.scalar_one_or_none()
    if not scheme:
        raise HTTPException(404, "Scheme not found")
    scheme.is_active = not scheme.is_active
    await db.commit()
    result = await db.execute(select(Scheme).options(*_scheme_load_options()).where(Scheme.id == scheme.id))
    return _to_out(result.scalar_one())
