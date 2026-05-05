from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Distributor, DistributorSegment
from app.scheme_schemas import DistributorOut, DistributorSegmentOut

router = APIRouter(tags=["distributors"])


@router.get("/distributors", response_model=list[DistributorOut])
async def list_distributors(
    search: str | None = None,
    segment_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Distributor).options(selectinload(Distributor.segment)).order_by(Distributor.name)
    if search:
        q = q.where(Distributor.name.ilike(f"%{search}%") | Distributor.code.ilike(f"%{search}%") | Distributor.city.ilike(f"%{search}%"))
    if segment_id:
        q = q.where(Distributor.segment_id == segment_id)
    result = await db.execute(q)
    out = []
    for d in result.scalars().all():
        item = DistributorOut.model_validate(d)
        item.segment_name = d.segment.name if d.segment else None
        out.append(item)
    return out


@router.get("/distributors/{dist_id}", response_model=DistributorOut)
async def get_distributor(dist_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Distributor).options(selectinload(Distributor.segment)).where(Distributor.id == dist_id))
    d = result.scalar_one_or_none()
    if not d:
        from fastapi import HTTPException
        raise HTTPException(404, "Distributor not found")
    out = DistributorOut.model_validate(d)
    out.segment_name = d.segment.name if d.segment else None
    return out


@router.get("/distributor-segments", response_model=list[DistributorSegmentOut])
async def list_segments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DistributorSegment).order_by(DistributorSegment.name))
    return [DistributorSegmentOut.model_validate(s) for s in result.scalars().all()]
