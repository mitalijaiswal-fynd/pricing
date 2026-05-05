import { useState, useEffect } from 'react';
import { getApprovals, performApprovalAction, addApprovalComment } from '../api';
import { useAuth } from '../AuthContext';
import { toast } from '../components/Toast';

const STATUS_STYLE = {
  DRAFT:                { label: 'Draft',               color: '#64748b', bg: '#f1f5f9' },
  PENDING_COORDINATOR:  { label: 'Pending Coordinator',  color: '#d97706', bg: '#fffbeb' },
  PENDING_FINANCE:      { label: 'Pending Finance',      color: '#7c3aed', bg: '#f5f3ff' },
  APPROVED:             { label: 'Approved',              color: '#059669', bg: '#ecfdf5' },
  REJECTED:             { label: 'Rejected',              color: '#dc2626', bg: '#fef2f2' },
};

const ROLE_COLORS = {
  data_entry:  '#2563eb',
  coordinator: '#7c3aed',
  finance:     '#059669',
};

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600,
      color: s.color, background: s.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  );
}

function EntityInfo({ req }) {
  const p = req.payload || {};
  if (req.entity_type === 'pricing') {
    return (
      <div>
        <div style={{ fontWeight: 600, color: '#1e293b' }}>Pricing Change</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {p.article_sku || req.entity_id.slice(0, 8)} {p.article_name ? `- ${p.article_name}` : ''}
        </div>
      </div>
    );
  }
  if (req.entity_type === 'scheme') {
    return (
      <div>
        <div style={{ fontWeight: 600, color: '#1e293b' }}>Scheme</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {p.name || p.code || req.entity_id.slice(0, 8)}
          {p.discount_type ? ` (${p.discount_type.replace(/_/g, ' ')})` : ''}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontWeight: 600, color: '#1e293b' }}>{req.entity_type}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{req.entity_id.slice(0, 8)}...</div>
    </div>
  );
}

export default function ApprovalQueue() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [detailModal, setDetailModal] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const load = () => {
    const params = {};
    if (filter !== 'ALL') params.status = filter;
    getApprovals(params).then(setRequests);
  };

  useEffect(load, [filter]);

  const canAct = (req) => {
    if (!user) return null;
    if (req.status === 'PENDING_COORDINATOR' && user.role === 'coordinator') return ['approve', 'reject'];
    if (req.status === 'PENDING_FINANCE' && user.role === 'finance') return ['approve', 'reject'];
    if (req.status === 'REJECTED' && user.role === 'data_entry') return ['resubmit'];
    return null;
  };

  const doAction = async (reqId, action) => {
    setLoading(true);
    try {
      await performApprovalAction(reqId, { action, remarks: remarks || null });
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)} successful`);
      setActionModal(null);
      setRemarks('');
      load();
      if (detailModal?.id === reqId) {
        const list = await getApprovals({ entity_id: detailModal.entity_id, entity_type: detailModal.entity_type });
        setDetailModal(list.find(r => r.id === reqId) || null);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (reqId) => {
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      await addApprovalComment(reqId, newComment.trim());
      setNewComment('');
      load();
      const list = await getApprovals({ entity_id: detailModal.entity_id, entity_type: detailModal.entity_type });
      setDetailModal(list.find(r => r.id === reqId) || detailModal);
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const tabs = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING_COORDINATOR', label: 'Pending Coordinator' },
    { key: 'PENDING_FINANCE', label: 'Pending Finance' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#334155' }}>approval</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Approval Queue</h2>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: '8px 16px',
              background: 'none', border: 'none',
              borderBottom: filter === t.key ? '2px solid #2563eb' : '2px solid transparent',
              color: filter === t.key ? '#2563eb' : '#64748b',
              fontWeight: filter === t.key ? 600 : 500,
              fontSize: 13, cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', marginBottom: 8 }}>inbox</span>
          No approval requests found
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Entity', 'Status', 'Submitted By', 'Submitted At', 'Comments', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map(r => {
              const actions = canAct(r);
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px' }}><EntityInfo req={r} /></td>
                  <td style={{ padding: '10px 12px' }}><Badge status={r.status} /></td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{r.submitted_by?.display_name || '-'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 12 }}>
                    {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => setDetailModal(r)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid #e2e8f0', background: '#fff',
                        color: '#475569', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>forum</span>
                      {r.comments?.length || 0}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {actions?.includes('approve') && (
                        <button
                          onClick={() => setActionModal({ req: r, action: 'approve' })}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid #059669', background: '#ecfdf5',
                            color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                          Approve
                        </button>
                      )}
                      {actions?.includes('reject') && (
                        <button
                          onClick={() => setActionModal({ req: r, action: 'reject' })}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid #dc2626', background: '#fef2f2',
                            color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                          Reject
                        </button>
                      )}
                      {actions?.includes('resubmit') && (
                        <button
                          onClick={() => setActionModal({ req: r, action: 'resubmit' })}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '5px 12px', borderRadius: 6,
                            border: '1px solid #2563eb', background: '#eff6ff',
                            color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                          Resubmit
                        </button>
                      )}
                      <button
                        onClick={() => setDetailModal(r)}
                        title="View details"
                        style={{
                          display: 'inline-flex', alignItems: 'center',
                          padding: '5px 8px', borderRadius: 6,
                          border: '1px solid #e2e8f0', background: '#fff',
                          color: '#64748b', cursor: 'pointer',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Detail / Comments Modal */}
      {detailModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => { setDetailModal(null); setNewComment(''); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, width: 600, maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#334155' }}>description</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Approval Details</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{detailModal.entity_type} - {detailModal.entity_id.slice(0, 12)}...</div>
              </div>
              <Badge status={detailModal.status} />
              <button
                onClick={() => { setDetailModal(null); setNewComment(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Payload preview */}
              {detailModal.payload && (
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    {detailModal.entity_type === 'pricing' ? 'Proposed Pricing' : 'Submission Details'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {Object.entries(detailModal.payload).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Activity Timeline
                </div>
                {(detailModal.history || []).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 12 }}>No activity yet</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 20 }}>
                    <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#e2e8f0' }} />
                    {detailModal.history.map((h) => (
                      <div key={h.id} style={{ position: 'relative', marginBottom: 14, paddingLeft: 16 }}>
                        <div style={{
                          position: 'absolute', left: -14, top: 4,
                          width: 10, height: 10, borderRadius: '50%',
                          background: h.action === 'approve' ? '#059669' : h.action === 'reject' ? '#dc2626' : '#2563eb',
                          border: '2px solid #fff',
                        }} />
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {new Date(h.created_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                          {h.actor?.display_name} <span style={{ fontWeight: 400, color: '#64748b' }}>({h.actor?.role?.replace('_', ' ')})</span>
                          <span style={{ fontWeight: 400, color: '#64748b' }}> - {h.action}</span>
                        </div>
                        {h.remarks && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 2 }}>"{h.remarks}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Comments ({detailModal.comments?.length || 0})
                </div>
                {(!detailModal.comments || detailModal.comments.length === 0) && (
                  <div style={{ textAlign: 'center', padding: 12, color: '#94a3b8', fontSize: 13 }}>
                    No comments yet
                  </div>
                )}
                {(detailModal.comments || []).map(c => (
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
            </div>

            {/* Comment input footer */}
            <div style={{
              borderTop: '1px solid #e2e8f0',
              padding: '12px 20px',
              display: 'flex', gap: 8,
            }}>
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment(detailModal.id)}
                placeholder="Add a comment..."
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6,
                  border: '1px solid #d1d5db', fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleAddComment(detailModal.id)}
                disabled={!newComment.trim() || sendingComment}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 16px', borderRadius: 6,
                  border: 'none', background: newComment.trim() ? '#2563eb' : '#94a3b8',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal (approve/reject/resubmit) */}
      {actionModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
          }}
          onClick={() => { setActionModal(null); setRemarks(''); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, width: 480,
              overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 20,
                color: actionModal.action === 'approve' ? '#059669' : actionModal.action === 'reject' ? '#dc2626' : '#2563eb',
              }}>
                {actionModal.action === 'approve' ? 'check_circle' : actionModal.action === 'reject' ? 'cancel' : 'refresh'}
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b', textTransform: 'capitalize' }}>
                {actionModal.action} Request
              </h3>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Entity</div>
              <EntityInfo req={actionModal.req} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Current Status</div>
              <Badge status={actionModal.req.status} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>
                {actionModal.action === 'reject' ? 'Reason for rejection (required for visibility)' : 'Remarks (optional)'}
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder={actionModal.action === 'reject' ? 'Please explain what needs to be changed...' : 'Add a note...'}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setActionModal(null); setRemarks(''); }}
                style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => doAction(actionModal.req.id, actionModal.action)}
                disabled={loading}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: actionModal.action === 'approve' ? '#059669' : actionModal.action === 'reject' ? '#dc2626' : '#2563eb',
                  color: '#fff',
                }}
              >
                {loading ? 'Processing...' : actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
