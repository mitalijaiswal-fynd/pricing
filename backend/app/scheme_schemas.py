from __future__ import annotations
import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class DiscountType(str, Enum):
    BUY_X_GET_Y = "BUY_X_GET_Y"
    AMOUNT_OFF_PRODUCTS = "AMOUNT_OFF_PRODUCTS"
    AMOUNT_OFF_ORDER = "AMOUNT_OFF_ORDER"


class ValueType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"


class TargetAudience(str, Enum):
    DISTRIBUTOR = "DISTRIBUTOR"
    RETAILER = "RETAILER"


class EligibilityType(str, Enum):
    ALL = "ALL"
    SEGMENT = "SEGMENT"
    SPECIFIC = "SPECIFIC"


DISCOUNT_TYPE_LABELS = {
    "BUY_X_GET_Y": "Buy X Get Y Free",
    "AMOUNT_OFF_PRODUCTS": "Amount Off Products",
    "AMOUNT_OFF_ORDER": "Amount Off Order",
}


# --- Distributor ---

class DistributorSegmentOut(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


class DistributorOut(BaseModel):
    id: uuid.UUID
    name: str
    code: str
    city: Optional[str] = None
    state: Optional[str] = None
    region: Optional[str] = None
    segment_id: Optional[uuid.UUID] = None
    segment_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    model_config = {"from_attributes": True}


# --- Scheme Article ---

class SchemeArticleCreate(BaseModel):
    article_id: uuid.UUID


class SchemeArticleOut(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    article_sku: Optional[str] = None
    article_name: Optional[str] = None
    model_config = {"from_attributes": True}


# --- Slabs ---

class SlabCreate(BaseModel):
    min_quantity: int = Field(..., ge=1)
    free_quantity: Optional[int] = Field(None, ge=1)
    discount_value: Optional[float] = Field(None, ge=0)


class SlabOut(BaseModel):
    id: uuid.UUID
    min_quantity: int
    free_quantity: Optional[int] = None
    discount_value: Optional[float] = None
    sort_order: int
    model_config = {"from_attributes": True}


# --- Scheme ---

class SchemeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_audience: TargetAudience = TargetAudience.DISTRIBUTOR
    discount_type: DiscountType

    value_type: Optional[ValueType] = None

    slabs: list[SlabCreate] = Field(..., min_length=1, max_length=10)

    start_at: datetime
    has_end_date: bool = False
    end_at: Optional[datetime] = None

    is_active: bool = True

    eligibility_type: EligibilityType = EligibilityType.ALL
    articles: Optional[list[SchemeArticleCreate]] = None
    segment_ids: Optional[list[uuid.UUID]] = None
    distributor_ids: Optional[list[uuid.UUID]] = None

    @field_validator("slabs")
    @classmethod
    def slabs_sorted_unique(cls, v: list[SlabCreate]) -> list[SlabCreate]:
        qtys = [s.min_quantity for s in v]
        if len(set(qtys)) != len(qtys):
            raise ValueError("Each slab must have a unique min_quantity")
        return sorted(v, key=lambda s: s.min_quantity)


class SchemeUpdate(BaseModel):
    description: Optional[str] = None
    target_audience: Optional[TargetAudience] = None

    value_type: Optional[ValueType] = None

    slabs: Optional[list[SlabCreate]] = Field(None, max_length=10)

    start_at: Optional[datetime] = None
    has_end_date: Optional[bool] = None
    end_at: Optional[datetime] = None

    is_active: Optional[bool] = None

    eligibility_type: Optional[EligibilityType] = None
    articles: Optional[list[SchemeArticleCreate]] = None
    segment_ids: Optional[list[uuid.UUID]] = None
    distributor_ids: Optional[list[uuid.UUID]] = None

    @field_validator("slabs")
    @classmethod
    def slabs_sorted_unique(cls, v: list[SlabCreate] | None) -> list[SlabCreate] | None:
        if v is None:
            return v
        if len(v) < 1:
            raise ValueError("At least one slab is required")
        qtys = [s.min_quantity for s in v]
        if len(set(qtys)) != len(qtys):
            raise ValueError("Each slab must have a unique min_quantity")
        return sorted(v, key=lambda s: s.min_quantity)


class SchemeOut(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    target_audience: str
    discount_type: str

    value_type: Optional[str] = None

    slabs: list[SlabOut] = []

    start_at: datetime
    has_end_date: bool
    end_at: Optional[datetime] = None

    is_active: bool
    eligibility_type: str

    articles: list[SchemeArticleOut] = []
    segments: list[DistributorSegmentOut] = []
    distributors: list[DistributorOut] = []

    model_config = {"from_attributes": True}
