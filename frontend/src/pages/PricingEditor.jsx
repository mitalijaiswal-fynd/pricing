import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getArticle, updateArticle, updatePricingFull, simulate } from '../api';
import MarginCard from '../components/MarginCard';
import { toast } from '../components/Toast';

function fmt(v) {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Price summary row ── all colours from DMS palette ── */
function SummaryRow({ label, value, isPrice, bold, bg, textColor, deduction }) {
  if (deduction) {
    return (
      <tr style={{ borderBottom: '1px solid var(--c-grey-40)' }}>
        <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--c-text-sub)', fontWeight: 400 }}>
          {label}
        </td>
        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 13, color: 'var(--c-error)', fontWeight: 600 }}>
          − {fmt(value)}
        </td>
      </tr>
    );
  }
  return (
    <tr style={{ borderBottom: '1px solid var(--c-grey-40)', background: bg || 'transparent' }}>
      <td style={{ padding: '11px 14px', fontWeight: bold ? 700 : 600, fontSize: 14, color: textColor || 'var(--c-text)' }}>
        {label}
      </td>
      <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: textColor || 'var(--c-text)' }}>
        {fmt(value)}
      </td>
    </tr>
  );
}

export default function PricingEditor() {
  const { id } = useParams();
  const [data, setData]         = useState(null);
  const [mrpInput, setMrpInput] = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [preview, setPreview]   = useState(null);

  const [rm,     setRm]     = useState({ type: 'PERCENT', value: 0 });
  const [dm,     setDm]     = useState({ type: 'PERCENT', base: 'MRP', value: 0 });
  const [anchor, setAnchor] = useState({ type: 'PERCENT', base: 'MRP', value: 0 });

  const load = useCallback(async () => {
    const d = await getArticle(id);
    setData(d);
    setMrpInput(d.article.mrp);
    setPreview(d.waterfall);
    if (d.pricing_rule) {
      setRm({ type: d.pricing_rule.rm_type, value: d.pricing_rule.rm_value });
      setDm({ type: d.pricing_rule.dm_type, base: d.pricing_rule.dm_base, value: d.pricing_rule.dm_value });
      setAnchor({ type: d.pricing_rule.anchor_type, base: d.pricing_rule.anchor_base, value: d.pricing_rule.anchor_value });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runPreview = useCallback(async () => {
    try {
      const wf = await simulate({
        mrp: parseFloat(mrpInput) || 0,
        rm_type: rm.type, rm_value: parseFloat(rm.value) || 0,
        dm_type: dm.type, dm_base: dm.base || 'MRP', dm_value: parseFloat(dm.value) || 0,
        anchor_type: anchor.type, anchor_base: anchor.base || 'MRP', anchor_value: parseFloat(anchor.value) || 0,
      });
      setPreview(wf);
    } catch { /* ignore */ }
  }, [mrpInput, rm, dm, anchor]);

  useEffect(() => {
    const t = setTimeout(() => runPreview(), 300);
    return () => clearTimeout(t);
  }, [runPreview]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await updateArticle(id, { mrp: parseFloat(mrpInput) });
      const d = await updatePricingFull(id, {
        rm_type: rm.type, rm_value: parseFloat(rm.value) || 0,
        dm_type: dm.type, dm_base: dm.base || 'MRP', dm_value: parseFloat(dm.value) || 0,
        anchor_type: anchor.type, anchor_base: anchor.base || 'MRP', anchor_value: parseFloat(anchor.value) || 0,
      });
      setData(d);
      setPreview(d.waterfall);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.success('Pricing saved successfully');
    } catch {
      toast.error('Failed to save pricing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
        Loading article…
      </div>
    );
  }

  return (
    <div>
      {/* ── Back link ── */}
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 15, fontWeight: 600,
          color: 'var(--c-primary-mid)', textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Articles
      </Link>

      {/* ── Article info card ── */}
      <div className="dms-card" style={{ padding: '18px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          {/* SKU */}
          <div style={{ paddingRight: 24, borderRight: '1px solid var(--c-grey-40)', marginRight: 24, minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>SKU</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>
              {data.article.sku}
            </div>
          </div>
          {/* Product Name */}
          <div style={{ flex: 1, paddingRight: 24, borderRight: '1px solid var(--c-grey-40)', marginRight: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Product Name</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>
              {data.article.name}
            </div>
          </div>
          {/* MRP */}
          <div style={{ minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>MRP (₹)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={mrpInput}
              onChange={(e) => setMrpInput(e.target.value)}
              className="dms-input"
              style={{ width: 130, fontWeight: 700, fontSize: 15 }}
            />
          </div>
        </div>
      </div>

      {/* ── Margin cards + price summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>

        {/* Left — margin cards */}
        <div>
          {/* 3 cards — align-items: stretch ensures equal height */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16, alignItems: 'stretch', marginBottom: 24,
          }}>
            <MarginCard
              title="Retailer Margin"
              type={rm.type} value={rm.value}
              onChange={(patch) => setRm((p) => ({ ...p, ...patch }))}
            />
            <MarginCard
              title="Distributor Margin"
              type={dm.type} base={dm.base} value={dm.value}
              showBase
              onChange={(patch) => setDm((p) => ({ ...p, ...patch }))}
            />
            <MarginCard
              title="SS / Anchor Margin"
              type={anchor.type} base={anchor.base} value={anchor.value}
              showBase
              onChange={(patch) => setAnchor((p) => ({ ...p, ...patch }))}
            />
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="dms-btn-primary"
              onClick={saveAll}
              disabled={saving}
              style={{ padding: '10px 36px' }}
            >
              {saving ? 'Saving…' : 'Save All Changes'}
            </button>
            {saved && (
              <span style={{
                fontSize: 13, color: 'var(--c-success)',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Saved!
              </span>
            )}
          </div>
        </div>

        {/* Right — price summary (DMS blue palette only) */}
        {preview && (
          <div className="dms-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 80 }}>
            {/* Summary header */}
            <div style={{
              padding: '13px 14px',
              background: 'var(--c-primary-bg)',
              borderBottom: '1px solid var(--c-grey-40)',
              fontSize: 11, fontWeight: 700,
              color: 'var(--c-primary-deep)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Price Summary (Live Preview)
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {/* MRP */}
                <SummaryRow label="MRP"
                  value={preview.mrp}
                  bold textColor="var(--c-text)" />

                <SummaryRow label="Less: Retailer Margin"
                  value={preview.rm_amount} deduction />

                {/* PTR — DMS primary blue */}
                <SummaryRow label="PTR"
                  value={preview.ptr}
                  textColor="var(--c-primary)"
                  bg="var(--c-primary-light)" />

                <SummaryRow label="Less: Distributor Margin"
                  value={preview.dm_amount} deduction />

                {/* PTD — DMS mid blue */}
                <SummaryRow label="PTD"
                  value={preview.ptd}
                  textColor="var(--c-primary-mid)"
                  bg="var(--c-primary-bg)" />

                <SummaryRow label="Less: SS / Anchor Margin"
                  value={preview.anchor_amount} deduction />

                {/* SS Price — DMS deep blue */}
                <SummaryRow label="SS Price"
                  value={preview.ss_price}
                  textColor="var(--c-primary-deep)"
                  bg="#dce4f8" />
              </tbody>
            </table>

            {/* Margin % breakdown */}
            <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--c-grey-40)' }}>
              {[
                { label: 'RM % of MRP',  value: preview.rm_pct_of_mrp,     color: 'var(--c-primary)'      },
                { label: 'DM % of MRP',  value: preview.dm_pct_of_mrp,     color: 'var(--c-primary-mid)'  },
                { label: 'SS % of MRP',  value: preview.anchor_pct_of_mrp, color: 'var(--c-primary-deep)' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-sub)', fontWeight: 400 }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
