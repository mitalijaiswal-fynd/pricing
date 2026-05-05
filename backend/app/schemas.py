from __future__ import annotations
import uuid
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


class MarginType(str, Enum):
    PERCENT = "PERCENT"
    ABSOLUTE = "ABSOLUTE"


class MarginBase(str, Enum):
    MRP = "MRP"
    TRADE_PRICE = "TRADE_PRICE"


# ---------- Article ----------

class ArticleCreate(BaseModel):
    sku: str
    name: str
    mrp: float = Field(gt=0)


class ArticleUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    mrp: Optional[float] = Field(default=None, gt=0)


class ArticleOut(BaseModel):
    id: uuid.UUID
    sku: str
    name: str
    mrp: float

    model_config = {"from_attributes": True}


# ---------- Pricing Rule ----------

class PricingRuleOut(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    rm_type: MarginType
    rm_value: float
    dm_type: MarginType
    dm_base: MarginBase
    dm_value: float
    anchor_type: MarginType
    anchor_base: MarginBase
    anchor_value: float

    model_config = {"from_attributes": True}


class PricingRuleUpdate(BaseModel):
    rm_type: Optional[MarginType] = None
    rm_value: Optional[float] = None
    dm_type: Optional[MarginType] = None
    dm_base: Optional[MarginBase] = None
    dm_value: Optional[float] = None
    anchor_type: Optional[MarginType] = None
    anchor_base: Optional[MarginBase] = None
    anchor_value: Optional[float] = None


class RMUpdate(BaseModel):
    type: MarginType = MarginType.PERCENT
    value: float = Field(ge=0)


class DMUpdate(BaseModel):
    type: MarginType = MarginType.PERCENT
    base: MarginBase = MarginBase.MRP
    value: float = Field(ge=0)


class AnchorUpdate(BaseModel):
    type: MarginType = MarginType.PERCENT
    base: MarginBase = MarginBase.MRP
    value: float = Field(ge=0)


# ---------- Waterfall ----------

class WaterfallResult(BaseModel):
    mrp: float
    rm_amount: float
    ptr: float
    dm_amount: float
    ptd: float
    anchor_amount: float
    ss_price: float
    rm_pct_of_mrp: float
    dm_pct_of_mrp: float
    anchor_pct_of_mrp: float


class ArticleWithWaterfall(BaseModel):
    article: ArticleOut
    pricing_rule: Optional[PricingRuleOut] = None
    waterfall: Optional[WaterfallResult] = None


class SimulateRequest(BaseModel):
    mrp: float = Field(gt=0)
    rm_type: MarginType = MarginType.PERCENT
    rm_value: float = Field(ge=0, default=0)
    dm_type: MarginType = MarginType.PERCENT
    dm_base: MarginBase = MarginBase.MRP
    dm_value: float = Field(ge=0, default=0)
    anchor_type: MarginType = MarginType.PERCENT
    anchor_base: MarginBase = MarginBase.MRP
    anchor_value: float = Field(ge=0, default=0)


# ---------- Scoped Pricing Rules ----------

class ScopedPricingRuleCreate(BaseModel):
    scope_level: str = "NATIONAL"
    scope_value: str = "All"
    customer_group: str = "All"
    mrp: float = Field(ge=0, default=0)
    rm1: float = Field(ge=0, default=0)
    rm2: float = Field(ge=0, default=0)
    absolute_ptr: Optional[float] = None
    dm1: float = Field(ge=0, default=0)
    dm2: float = Field(ge=0, default=0)
    absolute_ptd: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None


class ScopedPricingRuleUpdate(BaseModel):
    scope_level: Optional[str] = None
    scope_value: Optional[str] = None
    customer_group: Optional[str] = None
    mrp: Optional[float] = None
    rm1: Optional[float] = None
    rm2: Optional[float] = None
    absolute_ptr: Optional[float] = None
    dm1: Optional[float] = None
    dm2: Optional[float] = None
    absolute_ptd: Optional[float] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None


class ScopedPricingRuleOut(BaseModel):
    id: uuid.UUID
    article_id: uuid.UUID
    scope_level: str
    scope_value: str
    customer_group: str
    mrp: float
    priority: int
    rm1: float
    rm2: float
    absolute_ptr: Optional[float]
    dm1: float
    dm2: float
    absolute_ptd: Optional[float]
    valid_from: Optional[str]
    valid_to: Optional[str]

    model_config = {"from_attributes": True}


class ScopedPricingRuleBulkSave(BaseModel):
    rules: list[ScopedPricingRuleCreate]
