import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models import (
    ApprovalRequest, ApprovalHistory, ApprovalComment,
    User, Scheme, Article, PricingRule,
)
from app.routes.auth import get_current_user_dep

router = APIRouter(tags=["approvals"])

# ── FSM transition table ──────────────────────────────────────
TRANSITIONS = {
    ("DRAFT", "submit"):                ("data_entry",   "PENDING_COORDINATOR"),
    ("PENDING_COORDINATOR", "approve"):  ("coordinator",  "PENDING_FINANCE"),
    ("PENDING_COORDINATOR", "reject"):   ("coordinator",  "REJECTED"),
    ("PENDING_FINANCE", "approve"):      ("finance",      "APPROVED"),
    ("PENDING_FINANCE", "reject"):       ("finance",      "REJECTED"),
    ("REJECTED", "resubmit"):            ("data_entry",   "PENDING_COORDINATOR"),
}


def _load_options():
    return (
        selectinload(ApprovalRequest.submitter),
        selectinload(ApprovalRequest.coordinator),
        selectinload(ApprovalRequest.finance_user),
        selectinload(ApprovalRequest.history).selectinload(ApprovalHistory.actor),
        selectinload(ApprovalRequest.comments).selectinload(ApprovalComment.user),
    )


def _to_dict(r: ApprovalRequest) -> dict:
    return {
        "id": str(r.id),
        "entity_type": r.entity_type,
        "entity_id": str(r.entity_id),
        "status": r.status,
        "payload": r.payload,
        "submitted_by": {
            "id": str(r.submitter.id),
            "display_name": r.submitter.display_name,
            "role": r.submitter.role,
        } if r.submitter else None,
        "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
        "coordinator": {
            "id": str(r.coordinator.id),
            "display_name": r.coordinator.display_name,
        } if r.coordinator else None,
        "coordinator_action_at": r.coordinator_action_at.isoformat() if r.coordinator_action_at else None,
        "coordinator_remarks": r.coordinator_remarks,
        "finance": {
            "id": str(r.finance_user.id),
            "display_name": r.finance_user.display_name,
        } if r.finance_user else None,
        "finance_action_at": r.finance_action_at.isoformat() if r.finance_action_at else None,
        "finance_remarks": r.finance_remarks,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "history": [
            {
                "id": str(h.id),
                "from_status": h.from_status,
                "to_status": h.to_status,
                "action": h.action,
                "actor": {
                    "id": str(h.actor.id),
                    "display_name": h.actor.display_name,
                    "role": h.actor.role,
                } if h.actor else None,
                "remarks": h.remarks,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in (r.history or [])
        ],
        "comments": [
            {
                "id": str(c.id),
                "user": {
                    "id": str(c.user.id),
                    "display_name": c.user.display_name,
                    "role": c.user.role,
                } if c.user else None,
                "message": c.message,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in (r.comments or [])
        ],
    }


# ── List ──────────────────────────────────────────────────────
@router.get("/approvals")
async def list_approvals(
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ApprovalRequest).options(*_load_options()).order_by(ApprovalRequest.updated_at.desc())
    if status:
        q = q.where(ApprovalRequest.status == status)
    if entity_type:
        q = q.where(ApprovalRequest.entity_type == entity_type)
    if entity_id:
        q = q.where(ApprovalRequest.entity_id == uuid.UUID(entity_id))
    result = await db.execute(q)
    return [_to_dict(r) for r in result.scalars().unique().all()]


# ── Counts ────────────────────────────────────────────────────
@router.get("/approvals/counts")
async def approval_counts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApprovalRequest.status, sa_func.count()).group_by(ApprovalRequest.status)
    )
    return {row[0]: row[1] for row in result.all()}


# ── Get single ────────────────────────────────────────────────
@router.get("/approvals/{request_id}")
async def get_approval(request_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ApprovalRequest).options(*_load_options()).where(ApprovalRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Approval request not found")
    return _to_dict(req)


# ── Create ────────────────────────────────────────────────────
class CreateApprovalBody(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    payload: Optional[dict] = None


@router.post("/approvals", status_code=201)
async def create_approval(
    body: CreateApprovalBody,
    user: User = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "data_entry":
        raise HTTPException(403, "Only data_entry users can create approval requests")

    existing = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.entity_type == body.entity_type,
            ApprovalRequest.entity_id == body.entity_id,
            ApprovalRequest.status.notin_(["APPROVED", "REJECTED"]),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "An active approval request already exists for this entity")

    req = ApprovalRequest(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        status="PENDING_COORDINATOR",
        payload=body.payload,
        submitted_by=user.id,
        submitted_at=datetime.utcnow(),
    )
    db.add(req)
    await db.flush()

    db.add(ApprovalHistory(
        request_id=req.id,
        from_status="DRAFT",
        to_status="PENDING_COORDINATOR",
        action="submit",
        acted_by=user.id,
    ))

    if body.entity_type == "scheme":
        scheme_result = await db.execute(select(Scheme).where(Scheme.id == body.entity_id))
        scheme = scheme_result.scalar_one_or_none()
        if scheme:
            scheme.approval_status = "PENDING_COORDINATOR"

    await db.commit()

    result = await db.execute(
        select(ApprovalRequest).options(*_load_options()).where(ApprovalRequest.id == req.id)
    )
    return _to_dict(result.scalar_one())


# ── Action (approve / reject / resubmit) ─────────────────────
class ActionBody(BaseModel):
    action: str
    remarks: Optional[str] = None
    payload: Optional[dict] = None


@router.post("/approvals/{request_id}/action")
async def perform_action(
    request_id: uuid.UUID,
    body: ActionBody,
    user: User = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApprovalRequest).options(*_load_options()).where(ApprovalRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Approval request not found")

    key = (req.status, body.action)
    if key not in TRANSITIONS:
        raise HTTPException(
            400,
            f"Invalid action '{body.action}' for status '{req.status}'. "
            f"Allowed: {[a for (s, a) in TRANSITIONS if s == req.status]}",
        )

    required_role, next_status = TRANSITIONS[key]
    if user.role != required_role:
        raise HTTPException(403, f"Action '{body.action}' requires role '{required_role}', you are '{user.role}'")

    old_status = req.status
    req.status = next_status

    now = datetime.utcnow()
    if body.action in ("approve", "reject") and user.role == "coordinator":
        req.coordinator_id = user.id
        req.coordinator_action_at = now
        req.coordinator_remarks = body.remarks
    elif body.action in ("approve", "reject") and user.role == "finance":
        req.finance_id = user.id
        req.finance_action_at = now
        req.finance_remarks = body.remarks
    elif body.action == "resubmit":
        req.submitted_at = now
        if body.payload:
            req.payload = body.payload
        req.coordinator_id = None
        req.coordinator_action_at = None
        req.coordinator_remarks = None
        req.finance_id = None
        req.finance_action_at = None
        req.finance_remarks = None

    if body.remarks:
        db.add(ApprovalComment(
            request_id=req.id,
            user_id=user.id,
            message=body.remarks,
        ))

    db.add(ApprovalHistory(
        request_id=req.id,
        from_status=old_status,
        to_status=next_status,
        action=body.action,
        acted_by=user.id,
        remarks=body.remarks,
    ))

    # Sync entity-level status
    if req.entity_type == "scheme":
        scheme_result = await db.execute(select(Scheme).where(Scheme.id == req.entity_id))
        scheme = scheme_result.scalar_one_or_none()
        if scheme:
            scheme.approval_status = next_status
            if next_status == "APPROVED":
                scheme.is_active = True

    if req.entity_type == "pricing" and next_status == "APPROVED":
        await _apply_pricing_payload(req.entity_id, req.payload, db)

    await db.commit()

    result = await db.execute(
        select(ApprovalRequest).options(*_load_options()).where(ApprovalRequest.id == req.id)
    )
    return _to_dict(result.scalar_one())


# ── Add a comment ─────────────────────────────────────────────
class CommentBody(BaseModel):
    message: str


@router.post("/approvals/{request_id}/comments")
async def add_comment(
    request_id: uuid.UUID,
    body: CommentBody,
    user: User = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Approval request not found")

    comment = ApprovalComment(
        request_id=req.id,
        user_id=user.id,
        message=body.message,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    result = await db.execute(
        select(ApprovalComment)
        .options(selectinload(ApprovalComment.user))
        .where(ApprovalComment.id == comment.id)
    )
    c = result.scalar_one()
    return {
        "id": str(c.id),
        "user": {
            "id": str(c.user.id),
            "display_name": c.user.display_name,
            "role": c.user.role,
        },
        "message": c.message,
        "created_at": c.created_at.isoformat(),
    }


# ── Helper: apply pricing payload when finance approves ───────
async def _apply_pricing_payload(article_id: uuid.UUID, payload: dict | None, db: AsyncSession):
    if not payload:
        return
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        return

    if "mrp" in payload:
        article.mrp = payload["mrp"]

    result = await db.execute(select(PricingRule).where(PricingRule.article_id == article_id))
    rule = result.scalar_one_or_none()
    if not rule:
        rule = PricingRule(article_id=article_id)
        db.add(rule)
        await db.flush()

    field_map = {
        "rm_type": "rm_type", "rm_value": "rm_value",
        "dm_type": "dm_type", "dm_base": "dm_base", "dm_value": "dm_value",
        "anchor_type": "anchor_type", "anchor_base": "anchor_base", "anchor_value": "anchor_value",
    }
    for payload_key, model_field in field_map.items():
        if payload_key in payload:
            setattr(rule, model_field, payload[payload_key])
