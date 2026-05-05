import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getArticle, getScopedPricing, saveScopedPricing,
  createApproval, getApprovals, addApprovalComment, performApprovalAction,
} from '../api';
import { toast } from '../components/Toast';
import { useAuth } from '../AuthContext';

/* ─── Scope / Priority constants ─── */
const SCOPE_OPTIONS = [
  { value: 'CUSTOMER',     label: 'Customer',     priority: 1 },
  { value: 'STATE_DPG',    label: 'State-DPG',    priority: 2 },
  { value: 'NATIONAL_DPG', label: 'National-DPG', priority: 3 },
  { value: 'NATIONAL',     label: 'National',     priority: 4 },
];

const SCOPE_STYLE = {
  CUSTOMER:     { bg: '#fee2e2', color: '#b91c1c' },
  STATE_DPG:    { bg: '#fef3c7', color: '#92400e' },
  NATIONAL_DPG: { bg: '#d1fae5', color: '#065f46' },
  NATIONAL:     { bg: 'var(--c-primary-bg)', color: 'var(--c-primary-mid)' },
};

const PRI_STYLE = [
  '',
  { bg: '#b91c1c' },
  { bg: '#d97706' },
  { bg: '#059669' },
  { bg: 'var(--c-primary)' },
];

/* ─── Approval status styles (Sushant) ─── */
const STATUS_STYLE = {
  DRAFT:               { label: 'Draft',               color: '#64748b', bg: '#f1f5f9', icon: 'draft' },
  PENDING_COORDINATOR: { label: 'Pending Coordinator',  color: '#d97706', bg: '#fffbeb', icon: 'hourglass_top' },
  PENDING_FINANCE:     { label: 'Pending Finance',      color: '#7c3aed', bg: '#f5f3ff', icon: 'hourglass_bottom' },
  APPROVED:            { label: 'Approved',              color: '#059669', bg: '#ecfdf5', icon: 'check_circle' },
  REJECTED:            { label: 'Rejected',              color: '#dc2626', bg: '#fef2f2', icon: 'cancel' },
};

const ROLE_COLORS = {
  data_entry:  '#2563eb',
  coordinator: '#7c3aed',
  finance:     '#059669',
};

/* ─── Helpers ─── */
function fmt2(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcPTR(mrp, row) {
  if (row.absolute_ptr != null && row.absolute_ptr !== '') return Number(row.absolute_ptr);
  return mrp - Number(row.rm1 || 0) - Number(row.rm2 || 0);
}
function calcPTD(mrp, row) {
  const ptr = calcPTR(mrp, row);
  if (row.absolute_ptd != null && row.absolute_ptd !== '') return Number(row.absolute_ptd);
  return ptr - Number(row.dm1 || 0) - Number(row.dm2 || 0);
}

/* ── Approval badge (Sushant) ── */
function ApprovalBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600,
      color: s.color, background: s.bg,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{s.icon}</span>
      {s.label}
    </span>
  );
}

/* ── Scope chip ── */
function ScopeChip({ scope }) {
  const st = SCOPE_STYLE[scope] || SCOPE_STYLE.NATIONAL;
  const lbl = SCOPE_OPTIONS.find(o => o.value === scope)?.label || scope;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px',
      borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: st.bg, color: st.color, whiteSpace: 'nowrap',
    }}>{lbl}</span>
  );
}

/* ── Priority badge ── */
function PriBadge({ pri }) {
  const st = PRI_STYLE[pri] || PRI_STYLE[4];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: 6,
      fontSize: 11, fontWeight: 800,
      background: st.bg, color: '#fff', flexShrink: 0,
    }}>{pri}</span>
  );
}

/* ── Inline table input ── */
function TdInput({ value, onChange, type = 'number', style = {} }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      style={{
        border: '1.5px solid var(--c-grey-40)', borderRadius: 6,
        padding: '5px 8px', fontSize: 13, fontWeight: 600,
        width: '100%', fontFamily: 'inherit', color: 'var(--c-text)',
        textAlign: type === 'number' ? 'right' : 'left',
        MozAppearance: 'textfield',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = 'var(--c-primary)'; e.target.style.background = '#f5f7ff'; }}
      onBlur={e => { e.target.style.borderColor = 'var(--c-grey-40)'; e.target.style.background = ''; }}
    />
  );
}

/* ─── Pricing Rules Tab ─── */
function PricingRulesTab({ rows, setRows, defaultMrp, saving, onSave, disabled }) {
  const addRow = () => setRows(prev => [
    ...prev,
    { _key: Date.now(), scope_level: 'NATIONAL', scope_value: 'All', customer_group: 'All', mrp: defaultMrp, rm1: 0, rm2: 0, absolute_ptr: null, dm1: 0, dm2: 0, absolute_ptd: null, valid_from: '', valid_to: '' },
  ]);

  const update = (key, field, val) =>
    setRows(prev => prev.map(r => {
      if (r._key !== key && r.id !== key) return r;
      const updated = { ...r, [field]: val };
      if (field === 'scope_level') {
        updated.priority = SCOPE_OPTIONS.find(o => o.value === val)?.priority || 4;
      }
      return updated;
    }));

  const remove = (key) => setRows(prev => prev.filter(r => r._key !== key && r.id !== key));

  /* Summary: show highest-priority (lowest priority number) rule */
  const summaryRow = rows.length > 0
    ? [...rows].sort((a, b) => {
        const pa = SCOPE_OPTIONS.find(o => o.value === a.scope_level)?.priority ?? 4;
        const pb = SCOPE_OPTIONS.find(o => o.value === b.scope_level)?.priority ?? 4;
        return pa - pb;
      })[0]
    : null;
  const summaryMrp = summaryRow ? (parseFloat(summaryRow.mrp) || 0) : 0;
  const ptr   = summaryRow ? calcPTR(summaryMrp, summaryRow) : summaryMrp;
  const ptd   = summaryRow ? calcPTD(summaryMrp, summaryRow) : summaryMrp;
  const rm    = summaryRow ? (Number(summaryRow.rm1 || 0) + Number(summaryRow.rm2 || 0)) : 0;
  const dm    = summaryRow ? (Number(summaryRow.dm1 || 0) + Number(summaryRow.dm2 || 0)) : 0;
  const rmPct = summaryMrp ? Math.round(rm / summaryMrp * 100) : 0;
  const dmPct = summaryMrp ? Math.round(dm / summaryMrp * 100) : 0;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {/* Table */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dms-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Pricing Rules
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text-sub)', marginTop: 3 }}>
                Define MRP → PTR → PTD at each serviceability level
              </div>
            </div>
            {!disabled && (
              <button
                type="button" onClick={addRow}
                style={{
                  background: 'var(--c-primary-bg)', color: 'var(--c-primary)',
                  border: '1.5px solid var(--c-primary-light)', borderRadius: 8,
                  padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >＋ Add Rule</button>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
            {SCOPE_OPTIONS.map(o => {
              const st = SCOPE_STYLE[o.value];
              return (
                <div key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--c-text-sub)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color, display: 'inline-block' }} />
                  {o.label} (P{o.priority})
                </div>
              );
            })}
          </div>

          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text-sub)', fontSize: 13 }}>
              No pricing rules yet.{' '}
              {!disabled && (
                <button type="button" onClick={addRow} style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  Add the first rule
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <colgroup>
                  <col style={{ width: 40 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 100 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 68 }} />
                  <col style={{ width: 68 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 68 }} />
                  <col style={{ width: 68 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 36 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#f8f9fc', borderBottom: '1.5px solid var(--c-grey-40)' }}>
                    {['Pri.','Scope Level','Scope Value','Customer Group','MRP','RM1','RM2','PTR','DM1','DM2','PTD','Valid From','Valid To',''].map((h, i) => (
                      <th key={i} style={{ padding: '9px 10px', fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i >= 4 && i <= 10 ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const key = row.id || row._key;
                    const pri = SCOPE_OPTIONS.find(o => o.value === row.scope_level)?.priority || 4;
                    const rowMrp = parseFloat(row.mrp) || 0;
                    const rptr = calcPTR(rowMrp, row);
                    const rptd = calcPTD(rowMrp, row);
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #f0f0f4' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td style={{ padding: '9px 10px' }}><PriBadge pri={pri} /></td>
                        <td style={{ padding: '9px 10px' }}>
                          <select
                            value={row.scope_level}
                            onChange={e => update(key, 'scope_level', e.target.value)}
                            disabled={disabled}
                            style={{ border: '1.5px solid var(--c-grey-40)', borderRadius: 6, padding: '5px 6px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', color: 'var(--c-text)', background: '#fff', width: '100%' }}
                          >
                            {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <TdInput type="text" value={row.scope_value} onChange={v => update(key, 'scope_value', v)} style={disabled ? { opacity: 0.6 } : {}} />
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <TdInput type="text" value={row.customer_group ?? 'All'} onChange={v => update(key, 'customer_group', v)} style={disabled ? { opacity: 0.6 } : {}} />
                        </td>
                        <td style={{ padding: '9px 10px' }}><TdInput value={row.mrp ?? 0} onChange={v => update(key, 'mrp', v)} style={disabled ? { opacity: 0.6 } : {}} /></td>
                        <td style={{ padding: '9px 10px' }}><TdInput value={row.rm1} onChange={v => update(key, 'rm1', v)} style={disabled ? { opacity: 0.6 } : {}} /></td>
                        <td style={{ padding: '9px 10px' }}><TdInput value={row.rm2} onChange={v => update(key, 'rm2', v)} style={disabled ? { opacity: 0.6 } : {}} /></td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--c-primary)' }}>₹{rptr.toFixed(0)}</td>
                        <td style={{ padding: '9px 10px' }}><TdInput value={row.dm1} onChange={v => update(key, 'dm1', v)} style={disabled ? { opacity: 0.6 } : {}} /></td>
                        <td style={{ padding: '9px 10px' }}><TdInput value={row.dm2} onChange={v => update(key, 'dm2', v)} style={disabled ? { opacity: 0.6 } : {}} /></td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--c-primary-mid)' }}>₹{rptd.toFixed(0)}</td>
                        <td style={{ padding: '9px 10px' }}><TdInput type="text" value={row.valid_from || ''} onChange={v => update(key, 'valid_from', v)} style={{ fontSize: 11, width: '100%', ...(disabled ? { opacity: 0.6 } : {}) }} /></td>
                        <td style={{ padding: '9px 10px' }}><TdInput type="text" value={row.valid_to || ''} onChange={v => update(key, 'valid_to', v)} style={{ fontSize: 11, width: '100%', ...(disabled ? { opacity: 0.6 } : {}) }} /></td>
                        <td style={{ padding: '9px 10px' }}>
                          {!disabled && (
                            <button type="button" onClick={() => remove(key)}
                              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 15, padding: '3px 5px', borderRadius: 5 }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!disabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <button className="dms-btn-primary" onClick={onSave} disabled={saving} style={{ padding: '10px 32px' }}>
                {saving ? 'Saving…' : 'Save All Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Panel */}
      {summaryRow && (
        <div style={{ minWidth: 220, flexShrink: 0, position: 'sticky', top: 20 }}>
          <div style={{ background: 'var(--c-primary-bg)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-primary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
              Price Summary
            </div>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <PriBadge pri={SCOPE_OPTIONS.find(o => o.value === summaryRow.scope_level)?.priority ?? 4} />
              <ScopeChip scope={summaryRow.scope_level} />
              <span style={{ fontSize: 10, color: '#888' }}>highest priority</span>
            </div>
            {[
              { label: 'MRP',       value: `₹ ${fmt2(summaryMrp)}`, bold: true, color: 'var(--c-text)', bg: 'rgba(255,255,255,0.6)' },
              { label: 'Less: RM1', value: `– ${fmt2(summaryRow.rm1 || 0)}`, color: 'var(--c-error)' },
              { label: 'Less: RM2', value: `– ${fmt2(summaryRow.rm2 || 0)}`, color: 'var(--c-error)' },
              { label: 'PTR',       value: `₹ ${fmt2(ptr)}`, bold: true, color: 'var(--c-primary)', bg: 'rgba(255,255,255,0.6)', border: true },
              { label: 'Less: DM1', value: `– ${fmt2(summaryRow.dm1 || 0)}`, color: 'var(--c-error)' },
              { label: 'Less: DM2', value: `– ${fmt2(summaryRow.dm2 || 0)}`, color: 'var(--c-error)' },
              { label: 'PTD',       value: `₹ ${fmt2(ptd)}`, bold: true, color: 'var(--c-primary-mid)', bg: 'rgba(255,255,255,0.6)', border: true },
            ].map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: r.bg ? '7px 10px' : '5px 0',
                margin: r.bg ? '4px -10px' : 0,
                background: r.bg || 'transparent',
                borderRadius: r.bg ? 8 : 0,
                borderTop: r.border ? '1px solid var(--c-primary-light)' : 'none',
                marginTop: r.border ? 4 : 0,
                paddingTop: r.border ? 8 : undefined,
              }}>
                <span style={{ fontSize: 12, color: r.bold ? 'var(--c-text)' : 'var(--c-text-sub)', fontWeight: r.bold ? 700 : 500 }}>{r.label}</span>
                <span style={{ fontSize: r.bold ? 14 : 12, fontWeight: r.bold ? 800 : 600, color: r.color }}>{r.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--c-primary-light)', marginTop: 10, paddingTop: 10 }}>
              {[
                { label: 'RM % of MRP',  value: `${rmPct}%`,        color: 'var(--c-primary)' },
                { label: 'DM % of MRP',  value: `${dmPct}%`,        color: 'var(--c-primary-mid)' },
                { label: 'Total margin', value: `${rmPct + dmPct}%`, color: 'var(--c-text-sub)' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--c-text-sub)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */
export default function PricingEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData]               = useState(null);
  const [rows, setRows]               = useState([]);
  const [saving, setSaving]           = useState(false);
  const [approvalReq, setApprovalReq] = useState(null);
  const [newComment, setNewComment]   = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    const [d, scopedRules] = await Promise.all([getArticle(id), getScopedPricing(id)]);
    setData(d);
    setRows(scopedRules.map(r => ({ ...r, _key: r.id })));
  }, [id]);

  const loadApproval = useCallback(async () => {
    try {
      const list = await getApprovals({ entity_type: 'pricing', entity_id: id });
      const active = list.find(r => !['APPROVED'].includes(r.status));
      setApprovalReq(active || list[0] || null);
    } catch { setApprovalReq(null); }
  }, [id]);

  useEffect(() => { load(); loadApproval(); }, [load, loadApproval]);

  const saveAll = async () => {
    setSaving(true);
    try {
      const saved = await saveScopedPricing(id, rows.map(r => ({
        scope_level:    r.scope_level,
        scope_value:    r.scope_value,
        customer_group: r.customer_group ?? 'All',
        mrp:            Number(r.mrp || 0),
        rm1:            Number(r.rm1 || 0),
        rm2:            Number(r.rm2 || 0),
        absolute_ptr:   r.absolute_ptr !== '' ? r.absolute_ptr : null,
        dm1:            Number(r.dm1 || 0),
        dm2:            Number(r.dm2 || 0),
        absolute_ptd:   r.absolute_ptd !== '' ? r.absolute_ptd : null,
        valid_from:     r.valid_from || null,
        valid_to:       r.valid_to || null,
      })));
      setRows(saved.map(r => ({ ...r, _key: r.id })));
      toast.success('Pricing rules saved successfully');
    } catch {
      toast.error('Failed to save pricing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const buildPayload = () => ({
    article_sku:  data?.article?.sku,
    article_name: data?.article?.name,
    rules: rows.map(r => ({
      scope_level: r.scope_level, scope_value: r.scope_value,
      customer_group: r.customer_group, mrp: r.mrp,
      rm1: r.rm1, rm2: r.rm2, dm1: r.dm1, dm2: r.dm2,
      valid_from: r.valid_from, valid_to: r.valid_to,
    })),
  });

  const submitForApproval = async () => {
    setSaving(true);
    try {
      await createApproval({ entity_type: 'pricing', entity_id: id, payload: buildPayload() });
      toast.success('Pricing change submitted for approval');
      loadApproval();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const resubmit = async () => {
    if (!approvalReq) return;
    setSaving(true);
    try {
      await performApprovalAction(approvalReq.id, { action: 'resubmit', payload: buildPayload() });
      toast.success('Resubmitted with updated pricing');
      loadApproval();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to resubmit');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !approvalReq) return;
    setSendingComment(true);
    try {
      await addApprovalComment(approvalReq.id, newComment.trim());
      setNewComment('');
      loadApproval();
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const canSubmit        = user?.role === 'data_entry';
  const hasPendingApproval = approvalReq && !['APPROVED', 'REJECTED'].includes(approvalReq.status);
  const isRejected       = approvalReq?.status === 'REJECTED';

  if (!data) {
    return <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>Loading article…</div>;
  }

  const defaultMrp = parseFloat(data?.article?.mrp) || 0;

  return (
    <div>
      {/* ── Back link ── */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: 'var(--c-primary-mid)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Articles
      </Link>

      {/* ── Article info card ── */}
      <div className="dms-card" style={{ padding: '18px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ paddingRight: 24, borderRight: '1px solid var(--c-grey-40)', marginRight: 24, minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>SKU</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>{data.article.sku}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Product Name</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>{data.article.name}</div>
          </div>
          {approvalReq && (
            <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center' }}>
              <ApprovalBadge status={approvalReq.status} />
            </div>
          )}
        </div>
      </div>

      {/* ── Priority info note ── */}
      <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', display: 'flex', gap: 8, marginBottom: 16 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7.5 5v4M7.5 10.2v.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span>
          <strong>Priority rules:</strong> Customer (P1) overrides State-DPG (P2), which overrides National-DPG (P3), which overrides National fallback (P4). Only the highest-priority matching rule is applied during ordering.
        </span>
      </div>

      {/* ── Pricing Rules Table ── */}
      <PricingRulesTab
        rows={rows}
        setRows={setRows}
        defaultMrp={defaultMrp}
        saving={saving}
        onSave={saveAll}
        disabled={hasPendingApproval}
      />

      {/* ── Approval actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        {canSubmit && !hasPendingApproval && !isRejected && (
          <button
            className="dms-btn-primary"
            onClick={submitForApproval}
            disabled={saving}
            style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
            {saving ? 'Submitting…' : 'Submit for Approval'}
          </button>
        )}
        {canSubmit && isRejected && (
          <button
            className="dms-btn-primary"
            onClick={resubmit}
            disabled={saving}
            style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            {saving ? 'Resubmitting…' : 'Resubmit with Changes'}
          </button>
        )}
        {hasPendingApproval && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            background: '#fffbeb', border: '1px solid #fde68a',
            color: '#92400e', fontSize: 13, fontWeight: 500,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
            Pricing changes are pending approval. Editing is locked.
          </div>
        )}
      </div>

      {/* ── Comments thread (Sushant) ── */}
      {approvalReq && (
        <div className="dms-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div style={{
            padding: '12px 16px',
            background: '#f8fafc', borderBottom: '1px solid var(--c-grey-40)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#475569' }}>forum</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              Comments ({approvalReq.comments?.length || 0})
            </span>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 16px' }}>
            {(!approvalReq.comments || approvalReq.comments.length === 0) && (
              <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
                No comments yet. Approvers can leave feedback here.
              </div>
            )}
            {(approvalReq.comments || []).map(c => (
              <div key={c.id} style={{ marginBottom: 12, display: 'flex', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: ROLE_COLORS[c.user?.role] || '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 2,
                }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    {c.user?.display_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.user?.display_name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: ROLE_COLORS[c.user?.role] || '#64748b',
                      background: (ROLE_COLORS[c.user?.role] || '#64748b') + '15',
                      padding: '1px 6px', borderRadius: 6,
                    }}>
                      {c.user?.role?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>
                    {c.message}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--c-grey-40)', padding: '10px 16px', display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment..."
              className="dms-input"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || sendingComment}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 14px', borderRadius: 6,
                border: 'none', background: '#2563eb', color: '#fff',
                fontSize: 12, fontWeight: 600,
                cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                opacity: newComment.trim() ? 1 : 0.5,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
