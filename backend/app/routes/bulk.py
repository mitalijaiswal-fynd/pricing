from __future__ import annotations
import io
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openpyxl import Workbook, load_workbook

from app.database import get_db
from app.models import Article, PricingRule, BulkUpload

router = APIRouter(prefix="/bulk", tags=["bulk"])

TEMPLATE_HEADERS = [
    "sku", "mrp",
    "rm_type", "rm_value",
    "dm_type", "dm_base", "dm_value",
    "anchor_type", "anchor_base", "anchor_value",
]

VALID_TYPES = {"PERCENT", "ABSOLUTE"}
VALID_BASES = {"MRP", "TRADE_PRICE"}


@router.get("/template")
async def download_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "Pricing Template"

    for col, header in enumerate(TEMPLATE_HEADERS, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = cell.font.copy(bold=True)

    ws.append(["SKU-EXAMPLE", 100, "PERCENT", 10, "PERCENT", "MRP", 5, "PERCENT", "MRP", 3])

    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=pricing_bulk_template.xlsx"},
    )


def _parse_row(row_values: list, row_num: int) -> tuple[dict | None, str | None]:
    """Parse and validate a single row. Returns (data_dict, error_string)."""
    if len(row_values) < 2:
        return None, "Insufficient columns (need at least sku, mrp)"

    sku = str(row_values[0] or "").strip()
    mrp_raw = row_values[1]

    if not sku:
        return None, "SKU is empty"

    try:
        mrp = float(mrp_raw)
        if mrp <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return None, f"Invalid MRP value: {mrp_raw}"

    def get(idx, default):
        if idx < len(row_values) and row_values[idx] is not None and str(row_values[idx]).strip():
            return str(row_values[idx]).strip()
        return default

    rm_type = get(2, "PERCENT").upper()
    rm_value_raw = row_values[3] if len(row_values) > 3 and row_values[3] is not None else 0
    dm_type = get(4, "PERCENT").upper()
    dm_base = get(5, "MRP").upper()
    dm_value_raw = row_values[6] if len(row_values) > 6 and row_values[6] is not None else 0
    anchor_type = get(7, "PERCENT").upper()
    anchor_base = get(8, "MRP").upper()
    anchor_value_raw = row_values[9] if len(row_values) > 9 and row_values[9] is not None else 0

    if rm_type not in VALID_TYPES:
        return None, f"Invalid rm_type '{rm_type}'. Must be PERCENT or ABSOLUTE"
    if dm_type not in VALID_TYPES:
        return None, f"Invalid dm_type '{dm_type}'. Must be PERCENT or ABSOLUTE"
    if anchor_type not in VALID_TYPES:
        return None, f"Invalid anchor_type '{anchor_type}'. Must be PERCENT or ABSOLUTE"
    if dm_base not in VALID_BASES:
        return None, f"Invalid dm_base '{dm_base}'. Must be MRP or TRADE_PRICE"
    if anchor_base not in VALID_BASES:
        return None, f"Invalid anchor_base '{anchor_base}'. Must be MRP or TRADE_PRICE"

    try:
        rm_value = float(rm_value_raw)
    except (TypeError, ValueError):
        return None, f"Invalid rm_value: {rm_value_raw}"
    try:
        dm_value = float(dm_value_raw)
    except (TypeError, ValueError):
        return None, f"Invalid dm_value: {dm_value_raw}"
    try:
        anchor_value = float(anchor_value_raw)
    except (TypeError, ValueError):
        return None, f"Invalid anchor_value: {anchor_value_raw}"

    return {
        "sku": sku, "mrp": mrp,
        "rm_type": rm_type, "rm_value": rm_value,
        "dm_type": dm_type, "dm_base": dm_base, "dm_value": dm_value,
        "anchor_type": anchor_type, "anchor_base": anchor_base, "anchor_value": anchor_value,
    }, None


@router.post("/upload")
async def upload_pricing(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Only .xlsx or .xls files are accepted")

    contents = await file.read()
    try:
        wb = load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    except Exception:
        raise HTTPException(400, "Could not parse Excel file")

    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    rows = [r for r in rows if any(c is not None for c in r)]

    upload = BulkUpload(filename=file.filename, status="PROCESSING", total_rows=len(rows))
    db.add(upload)
    await db.flush()

    if not rows:
        upload.status = "FAILED"
        upload.failed_count = 0
        upload.error_details = {"errors": [{"row": 0, "error": "File has no data rows"}]}
        upload.completed_at = datetime.utcnow()
        await db.commit()
        return _upload_out(upload)

    errors = []
    success = 0

    for i, row in enumerate(rows):
        row_num = i + 2
        data, err = _parse_row(list(row), row_num)
        if err:
            errors.append({"row": row_num, "sku": str(row[0] or ""), "error": err})
            continue

        result = await db.execute(select(Article).where(Article.sku == data["sku"]))
        article = result.scalar_one_or_none()

        if not article:
            errors.append({"row": row_num, "sku": data["sku"], "error": "SKU not found — create the article first"})
            continue

        article.mrp = data["mrp"]

        result = await db.execute(select(PricingRule).where(PricingRule.article_id == article.id))
        rule = result.scalar_one_or_none()

        if rule:
            rule.rm_type = data["rm_type"]
            rule.rm_value = data["rm_value"]
            rule.dm_type = data["dm_type"]
            rule.dm_base = data["dm_base"]
            rule.dm_value = data["dm_value"]
            rule.anchor_type = data["anchor_type"]
            rule.anchor_base = data["anchor_base"]
            rule.anchor_value = data["anchor_value"]
        else:
            db.add(PricingRule(
                article_id=article.id,
                rm_type=data["rm_type"], rm_value=data["rm_value"],
                dm_type=data["dm_type"], dm_base=data["dm_base"], dm_value=data["dm_value"],
                anchor_type=data["anchor_type"], anchor_base=data["anchor_base"], anchor_value=data["anchor_value"],
            ))

        success += 1

    upload.success_count = success
    upload.failed_count = len(errors)
    upload.error_details = {"errors": errors} if errors else None
    upload.completed_at = datetime.utcnow()

    if len(errors) == 0:
        upload.status = "SUCCESS"
    elif success > 0:
        upload.status = "PARTIAL"
    else:
        upload.status = "FAILED"

    await db.commit()
    return _upload_out(upload)


@router.get("/uploads")
async def list_uploads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BulkUpload).order_by(BulkUpload.created_at.desc()).limit(50))
    return [_upload_out(u) for u in result.scalars().all()]


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BulkUpload).where(BulkUpload.id == upload_id))
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return _upload_out(upload)


def _upload_out(u: BulkUpload) -> dict:
    return {
        "id": str(u.id),
        "filename": u.filename,
        "status": u.status,
        "total_rows": u.total_rows,
        "success_count": u.success_count,
        "failed_count": u.failed_count,
        "error_details": u.error_details,
        "created_by": u.created_by or "System User",
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "completed_at": u.completed_at.isoformat() if u.completed_at else None,
    }
