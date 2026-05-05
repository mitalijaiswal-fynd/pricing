import uuid
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, Integer, Boolean, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from app.database import Base

SCOPE_PRIORITY = {
    'CUSTOMER':    1,
    'STATE_DPG':   2,
    'NATIONAL_DPG': 3,
    'NATIONAL':    4,
}


# --- Users & Roles ---

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)  # data_entry | coordinator | finance
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# --- Approval Workflow (Maker-Checker FSM) ---

class ApprovalRequest(Base):
    """
    FSM states:
      DRAFT → PENDING_COORDINATOR → PENDING_FINANCE → APPROVED
                    ↓                      ↓
                 REJECTED              REJECTED
                    ↓
              (resubmit → PENDING_COORDINATOR)
    """
    __tablename__ = "approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # What is being approved: "scheme" or "pricing"
    entity_type: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")

    # Snapshot of the payload at time of submission
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    submitted_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    coordinator_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    coordinator_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    coordinator_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    finance_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    finance_action_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finance_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    submitter: Mapped[Optional["User"]] = relationship(foreign_keys=[submitted_by])
    coordinator: Mapped[Optional["User"]] = relationship(foreign_keys=[coordinator_id])
    finance_user: Mapped[Optional["User"]] = relationship(foreign_keys=[finance_id])
    history: Mapped[List["ApprovalHistory"]] = relationship(back_populates="request", order_by="ApprovalHistory.created_at")
    comments: Mapped[List["ApprovalComment"]] = relationship(back_populates="request", order_by="ApprovalComment.created_at")


class ApprovalHistory(Base):
    __tablename__ = "approval_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(30), nullable=False)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # submit | approve | reject | resubmit
    acted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    request: Mapped["ApprovalRequest"] = relationship(back_populates="history")
    actor: Mapped["User"] = relationship()


class ApprovalComment(Base):
    __tablename__ = "approval_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    request: Mapped["ApprovalRequest"] = relationship(back_populates="comments")
    user: Mapped["User"] = relationship()


class BulkUpload(Base):
    __tablename__ = "bulk_uploads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PROCESSING")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, default="System User")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mrp: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    pricing_rule: Mapped["PricingRule"] = relationship(back_populates="article", uselist=False, cascade="all, delete-orphan")
    scoped_pricing_rules: Mapped[List["ScopedPricingRule"]] = relationship(
        back_populates="article", cascade="all, delete-orphan", order_by="ScopedPricingRule.priority"
    )


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), unique=True, nullable=False)

    rm_type: Mapped[str] = mapped_column(String(10), nullable=False, default="PERCENT")
    rm_value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)

    dm_type: Mapped[str] = mapped_column(String(10), nullable=False, default="PERCENT")
    dm_base: Mapped[str] = mapped_column(String(15), nullable=False, default="MRP")
    dm_value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)

    anchor_type: Mapped[str] = mapped_column(String(10), nullable=False, default="PERCENT")
    anchor_base: Mapped[str] = mapped_column(String(15), nullable=False, default="MRP")
    anchor_value: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    article: Mapped["Article"] = relationship(back_populates="pricing_rule")


class ScopedPricingRule(Base):
    """Multi-row pricing rules per article with serviceability scope & priority."""
    __tablename__ = "scoped_pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    article_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False
    )
    # CUSTOMER | STATE_DPG | NATIONAL_DPG | NATIONAL
    scope_level: Mapped[str] = mapped_column(String(20), nullable=False, default="NATIONAL")
    scope_value: Mapped[str] = mapped_column(String(100), nullable=False, default="All")
    customer_group: Mapped[str] = mapped_column(String(100), nullable=False, default="All")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    mrp: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    rm1: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    rm2: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    absolute_ptr: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)

    dm1: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    dm2: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    absolute_ptd: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)

    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    article: Mapped["Article"] = relationship(back_populates="scoped_pricing_rules")


# --- Distributors ---

class DistributorSegment(Base):
    __tablename__ = "distributor_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    distributors: Mapped[List["Distributor"]] = relationship(back_populates="segment")


class Distributor(Base):
    __tablename__ = "distributors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    segment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("distributor_segments.id"), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    segment: Mapped[Optional["DistributorSegment"]] = relationship(back_populates="distributors")


# --- Schemes (redesigned) ---

class Scheme(Base):
    __tablename__ = "schemes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # DISTRIBUTOR | RETAILER
    target_audience: Mapped[str] = mapped_column(String(20), nullable=False, default="DISTRIBUTOR")

    # BUY_X_GET_Y | AMOUNT_OFF_PRODUCTS | AMOUNT_OFF_ORDER
    discount_type: Mapped[str] = mapped_column(String(30), nullable=False)

    # For AMOUNT_OFF_*: PERCENTAGE or FIXED (applies to all slabs)
    value_type: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)

    # Timing
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    has_end_date: Mapped[bool] = mapped_column(Boolean, default=False)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Eligibility: ALL | SEGMENT | SPECIFIC
    eligibility_type: Mapped[str] = mapped_column(String(20), nullable=False, default="ALL")

    # Approval FSM: DRAFT | PENDING_COORDINATOR | PENDING_FINANCE | APPROVED | REJECTED
    approval_status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT")

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    slabs: Mapped[List["SchemeSlab"]] = relationship(
        back_populates="scheme", cascade="all, delete-orphan",
        order_by="SchemeSlab.sort_order",
    )
    articles: Mapped[List["SchemeArticle"]] = relationship(back_populates="scheme", cascade="all, delete-orphan")
    eligible_segments: Mapped[List["SchemeSegment"]] = relationship(back_populates="scheme", cascade="all, delete-orphan")
    eligible_distributors: Mapped[List["SchemeDistributor"]] = relationship(back_populates="scheme", cascade="all, delete-orphan")


class SchemeSlab(Base):
    __tablename__ = "scheme_slabs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False)
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    free_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    discount_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    scheme: Mapped["Scheme"] = relationship(back_populates="slabs")


class SchemeArticle(Base):
    __tablename__ = "scheme_articles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False)
    article_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)

    scheme: Mapped["Scheme"] = relationship(back_populates="articles")
    article: Mapped["Article"] = relationship()


class SchemeSegment(Base):
    __tablename__ = "scheme_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False)
    segment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("distributor_segments.id", ondelete="CASCADE"), nullable=False)

    scheme: Mapped["Scheme"] = relationship(back_populates="eligible_segments")
    segment: Mapped["DistributorSegment"] = relationship()


class SchemeDistributor(Base):
    __tablename__ = "scheme_distributors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scheme_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False)
    distributor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("distributors.id", ondelete="CASCADE"), nullable=False)

    scheme: Mapped["Scheme"] = relationship(back_populates="eligible_distributors")
    distributor: Mapped["Distributor"] = relationship()
