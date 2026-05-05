import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getArticle, updateArticle, updatePricingFull, simulate, createApproval, getApprovals, addApprovalComment, performApprovalAction } from '../api';
import MarginCard from '../components/MarginCard';
import { toast } from '../components/Toast';
import { useAuth } from '../AuthContext';

function fmt(v) {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_STYLE = {
  DRAFT:                { label: 'Draft',               color: '#64748b', bg: '#f1f5f9', icon: 'draft' },
  PENDING_COORDINATOR:  { label: 'Pending Coordinator',  color: '#d97706', bg: '#fffbeb', icon: 'hourglass_top' },
  PENDING_FINANCE:      { label: 'Pending Finance',      color: '#7c3aed', bg: '#f5f3ff', icon: 'hourglass_bottom' },
  APPROVED:             { label: 'Approved',              color: '#059669', bg: '#ecfdf5', icon: 'check_circle' },
  REJECTED:             { label: 'Rejected',              color: '#dc2626', bg: '#fef2f2', icon: 'cancel' },
};

const ROLE_COLORS = {
  data_entry:  '#2563eb',
  coordinator: '#7c3aed',
  finance:     '#059669',
};

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

function SummaryRow({ label, value, isPrice, bold, bg, textColor, deduction }) {
  if (deduction) {
    return (
      <tr style={{ borderBottom: '1px solid var(--c-grey-40)' }}>
        <td style={{ padding: '8px 14px', fontSize: 13, color: 'var(--c-text-sub)', fontWeight: 400 }}>{label}</td>
        <td style={{ padding: '8px 14px', textAlign: 'right', fontSize: 13, color: 'var(--c-error)', fontWeight: 600 }}>- {fmt(value)}</td>
      </tr>
    );
  }
  return (
    <tr style={{ borderBottom: '1px solid var(--c-grey-40)', background: bg || 'transparent' }}>
      <td style={{ padding: '11px 14px', fontWeight: bold ? 700 : 600, fontSize: 14, color: textColor || 'var(--c-text)' }}>{label}</td>
      <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: textColor || 'var(--c-text)' }}>{fmt(value)}</td>
    </tr>
  );
}

export default function PricingEditor() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [mrpInput, setMrpInput] = useState('');
  const [saving, setSaving]     = useState(false);
  const [preview, setPreview]   = useState(null);

  const [rm,     setRm]     = useState({ type: 'PERCENT', value: 0 });
  const [dm,     setDm]     = useState({ type: 'PERCENT', base: 'MRP', value: 0 });
  const [anchor, setAnchor] = useState({ type: 'PERCENT', base: 'MRP', value: 0 });

  const [approvalReq, setApprovalReq] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

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

  const loadApproval = useCallback(async () => {
    try {
      const list = await getApprovals({ entity_type: 'pricing', entity_id: id });
      const active = list.find(r => !['APPROVED'].includes(r.status));
      setApprovalReq(active || list[0] || null);
    } catch { setApprovalReq(null); }
  }, [id]);

  useEffect(() => { load(); loadApproval(); }, [load, loadApproval]);

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

  const buildPayload = () => ({
    mrp: parseFloat(mrpInput) || 0,
    rm_type: rm.type, rm_value: parseFloat(rm.value) || 0,
    dm_type: dm.type, dm_base: dm.base || 'MRP', dm_value: parseFloat(dm.value) || 0,
    anchor_type: anchor.type, anchor_base: anchor.base || 'MRP', anchor_value: parseFloat(anchor.value) || 0,
    article_sku: data?.article?.sku,
    article_name: data?.article?.name,
  });

  const submitForApproval = async () => {
    setSaving(true);
    try {
      await createApproval({
        entity_type: 'pricing',
        entity_id: id,
        payload: buildPayload(),
      });
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
      await performApprovalAction(approvalReq.id, {
        action: 'resubmit',
        payload: buildPayload(),
      });
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

  const canSubmit = user?.role === 'data_entry';
  const hasPendingApproval = approvalReq && !['APPROVED', 'REJECTED'].includes(approvalReq.status);
  const isRejected = approvalReq?.status === 'REJECTED';

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
        Loading article...
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 15, fontWeight: 600,
          color: 'var(--c-primary-mid)', textDecoration: 'none',
          marginBottom: 20,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Articles
      </Link>

      {/* Article info card */}
      <div className="dms-card" style={{ padding: '18px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ paddingRight: 24, borderRight: '1px solid var(--c-grey-40)', marginRight: 24, minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>SKU</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>{data.article.sku}</div>
          </div>
          <div style={{ flex: 1, paddingRight: 24, borderRight: '1px solid var(--c-grey-40)', marginRight: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Product Name</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text)' }}>{data.article.name}</div>
          </div>
          <div style={{ minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>MRP (Rs)</label>
            <input
              type="number" min="0.01" step="0.01"
              value={mrpInput}
              onChange={(e) => setMrpInput(e.target.value)}
              disabled={hasPendingApproval}
              className="dms-input"
              style={{ width: 130, fontWeight: 700, fontSize: 15 }}
            />
          </div>
          {approvalReq && (
            <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center' }}>
              <ApprovalBadge status={approvalReq.status} />
            </div>
          )}
        </div>
      </div>

      {/* Margin cards + price summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16, alignItems: 'stretch', marginBottom: 24,
          }}>
            <MarginCard
              title="Retailer Margin"
              type={rm.type} value={rm.value}
              onChange={(patch) => setRm((p) => ({ ...p, ...patch }))}
              disabled={hasPendingApproval}
            />
            <MarginCard
              title="Distributor Margin"
              type={dm.type} base={dm.base} value={dm.value}
              showBase
              onChange={(patch) => setDm((p) => ({ ...p, ...patch }))}
              disabled={hasPendingApproval}
            />
            <MarginCard
              title="SS / Anchor Margin"
              type={anchor.type} base={anchor.base} value={anchor.value}
              showBase
              onChange={(patch) => setAnchor((p) => ({ ...p, ...patch }))}
              disabled={hasPendingApproval}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            {canSubmit && !hasPendingApproval && !isRejected && (
              <button className="dms-btn-primary" onClick={submitForApproval} disabled={saving} style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                {saving ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
            {canSubmit && isRejected && (
              <button className="dms-btn-primary" onClick={resubmit} disabled={saving} style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
                {saving ? 'Resubmitting...' : 'Resubmit with Changes'}
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

          {/* Comments thread */}
          {approvalReq && (
            <div className="dms-card" style={{ padding: 0, overflow: 'hidden' }}>
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

              {/* Add comment input */}
              <div style={{
                borderTop: '1px solid var(--c-grey-40)',
                padding: '10px 16px',
                display: 'flex', gap: 8,
              }}>
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
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
                    fontSize: 12, fontWeight: 600, cursor: newComment.trim() ? 'pointer' : 'not-allowed',
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

        {/* Right - price summary */}
        {preview && (
          <div className="dms-card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 80 }}>
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
                <SummaryRow label="MRP" value={preview.mrp} bold textColor="var(--c-text)" />
                <SummaryRow label="Less: Retailer Margin" value={preview.rm_amount} deduction />
                <SummaryRow label="PTR" value={preview.ptr} textColor="var(--c-primary)" bg="var(--c-primary-light)" />
                <SummaryRow label="Less: Distributor Margin" value={preview.dm_amount} deduction />
                <SummaryRow label="PTD" value={preview.ptd} textColor="var(--c-primary-mid)" bg="var(--c-primary-bg)" />
                <SummaryRow label="Less: SS / Anchor Margin" value={preview.anchor_amount} deduction />
                <SummaryRow label="SS Price" value={preview.ss_price} textColor="var(--c-primary-deep)" bg="#dce4f8" />
              </tbody>
            </table>

            <div style={{ padding: '12px 14px 16px', borderTop: '1px solid var(--c-grey-40)' }}>
              {[
                { label: 'RM % of MRP',  value: preview.rm_pct_of_mrp,     color: 'var(--c-primary)' },
                { label: 'DM % of MRP',  value: preview.dm_pct_of_mrp,     color: 'var(--c-primary-mid)' },
                { label: 'SS % of MRP',  value: preview.anchor_pct_of_mrp, color: 'var(--c-primary-deep)' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-sub)', fontWeight: 400 }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: row.color }}>{row.value}%</span>
                </div>
              ))}
            </div>

            {/* Proposed vs Current comparison when there's a pending request */}
            {approvalReq && approvalReq.payload && approvalReq.status !== 'APPROVED' && (
              <div style={{ borderTop: '1px solid var(--c-grey-40)', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Proposed Changes
                </div>
                {[
                  { label: 'MRP', value: approvalReq.payload.mrp },
                  { label: 'RM', value: `${approvalReq.payload.rm_type} ${approvalReq.payload.rm_value}` },
                  { label: 'DM', value: `${approvalReq.payload.dm_type} on ${approvalReq.payload.dm_base} ${approvalReq.payload.dm_value}` },
                  { label: 'Anchor', value: `${approvalReq.payload.anchor_type} on ${approvalReq.payload.anchor_base} ${approvalReq.payload.anchor_value}` },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{r.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
