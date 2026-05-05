from decimal import Decimal, ROUND_HALF_UP

TWO_PLACES = Decimal("0.01")


def _to_dec(v) -> Decimal:
    return Decimal(str(v))


def compute_waterfall(
    mrp, rm_type, rm_value, dm_type, dm_base, dm_value, anchor_type, anchor_base, anchor_value
) -> dict:
    mrp_d = _to_dec(mrp)
    rm_val = _to_dec(rm_value)
    dm_val = _to_dec(dm_value)
    anc_val = _to_dec(anchor_value)

    if rm_type == "ABSOLUTE":
        rm_amount = rm_val
    else:
        rm_amount = (mrp_d * rm_val / 100).quantize(TWO_PLACES, ROUND_HALF_UP)

    ptr = mrp_d - rm_amount

    if dm_type == "ABSOLUTE":
        dm_amount = dm_val
    else:
        dm_ref = mrp_d if dm_base == "MRP" else ptr
        dm_amount = (dm_ref * dm_val / 100).quantize(TWO_PLACES, ROUND_HALF_UP)

    ptd = ptr - dm_amount

    if anchor_type == "ABSOLUTE":
        anchor_amount = anc_val
    else:
        anchor_ref = mrp_d if anchor_base == "MRP" else ptr
        anchor_amount = (anchor_ref * anc_val / 100).quantize(TWO_PLACES, ROUND_HALF_UP)

    ss_price = ptd - anchor_amount

    zero = Decimal("0")
    return {
        "mrp": float(mrp_d),
        "rm_amount": float(rm_amount),
        "ptr": float(ptr),
        "dm_amount": float(dm_amount),
        "ptd": float(ptd),
        "anchor_amount": float(anchor_amount),
        "ss_price": float(ss_price),
        "rm_pct_of_mrp": float((rm_amount / mrp_d * 100).quantize(TWO_PLACES, ROUND_HALF_UP)) if mrp_d != zero else 0,
        "dm_pct_of_mrp": float((dm_amount / mrp_d * 100).quantize(TWO_PLACES, ROUND_HALF_UP)) if mrp_d != zero else 0,
        "anchor_pct_of_mrp": float((anchor_amount / mrp_d * 100).quantize(TWO_PLACES, ROUND_HALF_UP)) if mrp_d != zero else 0,
    }
