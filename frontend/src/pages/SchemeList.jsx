import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchemes, deleteScheme, toggleScheme, createApproval } from '../api';
import { toast } from '../components/Toast';
import { useAuth } from '../AuthContext';

const TYPE_TABS = [
  { key: null,                label: 'All' },
  { key: 'BUY_X_GET_Y',       label: 'Buy X Get Y Free' },
  { key: 'AMOUNT_OFF_PRODUCTS', label: 'Amount Off Products' },
  { key: 'AMOUNT_OFF_ORDER',   label: 'Amount Off Order' },
];

const AUDIENCE_TABS = [
  { key: null,          label: 'All' },
  { key: 'DISTRIBUTOR', label: 'Distributors' },
  { key: 'RETAILER',    label: 'Retailers' },
];

const ELIG_LABELS = {
  ALL:      'All Distributors',
  SEGMENT:  'Segments',
  SPECIFIC: 'Specific',
};

const TYPE_STYLE = {
  BUY_X_GET_Y:          { bg: '#E9F7E9', color: '#1a7a17' },
  AMOUNT_OFF_PRODUCTS:  { bg: 'var(--c-primary-bg)', color: 'var(--c-primary-mid)' },
  AMOUNT_OFF_ORDER:     { bg: '#FEF0E7', color: '#9a5a00' },
};

const AUDIENCE_STYLE = {
  DISTRIBUTOR: { bg: 'var(--c-primary-light)', color: 'var(--c-primary-hover)' },
  RETAILER:    { bg: '#E9F7E9', color: '#1a7a17' },
};

const APPROVAL_STYLE = {
  DRAFT:                { label: 'Draft',               color: '#64748b', bg: '#f1f5f9', icon: 'draft' },
  PENDING_COORDINATOR:  { label: 'Pending Coordinator',  color: '#d97706', bg: '#fffbeb', icon: 'hourglass_top' },
  PENDING_FINANCE:      { label: 'Pending Finance',      color: '#7c3aed', bg: '#f5f3ff', icon: 'hourglass_bottom' },
  APPROVED:             { label: 'Approved',              color: '#059669', bg: '#ecfdf5', icon: 'check_circle' },
  REJECTED:             { label: 'Rejected',              color: '#dc2626', bg: '#fef2f2', icon: 'cancel' },
};

function ApprovalBadge({ status }) {
  const s = APPROVAL_STYLE[status] || APPROVAL_STYLE.DRAFT;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{s.icon}</span>
      {s.label}
    </span>
  );
}

function Badge({ bg, color, children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 11, fontWeight: 700,
      background: bg || 'var(--c-grey-20)',
      color: color || 'var(--c-text-sub)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function PillTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: '4px 5px', background: 'var(--c-grey-20)', borderRadius: 100, border: '1px solid var(--c-grey-40)' }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key ?? 'all'}
            onClick={() => onChange(tab.key)}
            style={{
              padding: '7px 16px',
              borderRadius: 100,
              border: 'none',
              fontSize: 13,
              fontWeight: isActive ? 700 : 500,
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? 'var(--c-primary-mid)' : 'var(--c-text-sub)',
              cursor: 'pointer',
              boxShadow: isActive ? '0 1px 6px rgba(0,0,0,0.13)' : 'none',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              letterSpacing: isActive ? '-0.01em' : 'normal',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function formatDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function slabSummary(s) {
  if (!s.slabs || s.slabs.length === 0) return '';
  const isBxgy = s.discount_type === 'BUY_X_GET_Y';
  if (s.slabs.length === 1) {
    const sl = s.slabs[0];
    if (isBxgy) return `Buy ${sl.min_quantity} → Get ${sl.free_quantity} Free`;
    const unit = s.value_type === 'PERCENTAGE' ? '%' : '₹';
    return `${sl.min_quantity}+ qty → ${sl.discount_value}${unit} off`;
  }
  const first = s.slabs[0];
  const last = s.slabs[s.slabs.length - 1];
  if (isBxgy) {
    return `${s.slabs.length} tiers · Buy ${first.min_quantity}→${first.free_quantity} free … ${last.min_quantity}→${last.free_quantity} free`;
  }
  const unit = s.value_type === 'PERCENTAGE' ? '%' : '₹';
  return `${s.slabs.length} tiers · ${first.discount_value}${unit} – ${last.discount_value}${unit} off`;
}

export default function SchemeList() {
  const { user } = useAuth();
  const [schemes, setSchemes]           = useState([]);
  const [activeType, setActiveType]     = useState(null);
  const [activeAudience, setActiveAudience] = useState(null);
  const [loading, setLoading]           = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      setSchemes(await getSchemes({ discountType: activeType, targetAudience: activeAudience }));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [activeType, activeAudience]);

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!confirm(`Delete scheme "${name}"?`)) return;
    await deleteScheme(id);
    toast.success('Scheme deleted');
    load();
  };

  const handleToggle = async (e, id, isActive) => {
    e.stopPropagation();
    await toggleScheme(id);
    toast.success(isActive ? 'Scheme deactivated' : 'Scheme activated');
    load();
  };

  const handleSubmitForApproval = async (e, scheme) => {
    e.stopPropagation();
    try {
      await createApproval({
        entity_type: 'scheme',
        entity_id: scheme.id,
        payload: { name: scheme.name, code: scheme.code, discount_type: scheme.discount_type },
      });
      toast.success('Submitted for approval');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    }
  };

  const canCreate = user?.role === 'data_entry';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
            Schemes &amp; Offers
          </h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-sub)', margin: '4px 0 0' }}>
            Manage Buy X Get Y, product discounts, and order discounts
          </p>
        </div>
        {canCreate && (
          <button className="dms-btn-primary" onClick={() => navigate('/schemes/new')}>
            + Create Scheme
          </button>
        )}
      </div>

      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 20, padding: '10px 16px',
        background: '#fff', borderRadius: 12,
        border: '1px solid var(--c-grey-40)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Audience</span>
        <PillTabs tabs={AUDIENCE_TABS} active={activeAudience} onChange={setActiveAudience} />
        <div style={{ width: 1, height: 24, background: 'var(--c-grey-40)', margin: '0 6px' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-sub)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Type</span>
        <PillTabs tabs={TYPE_TABS} active={activeType} onChange={setActiveType} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--c-text-sub)' }}>
          Loading schemes...
        </div>
      ) : schemes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--c-text-sub)', fontWeight: 500 }}>No schemes found</div>
          <div style={{ fontSize: 12, color: 'var(--c-grey-60)', marginTop: 4 }}>Create one to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {schemes.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/schemes/${s.id}`)}
              className="dms-card"
              style={{
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--c-primary-soft)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--c-border)'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)' }}>{s.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--c-grey-60)' }}>{s.code}</span>
                    <ApprovalBadge status={s.approval_status} />
                    {s.is_active ? (
                      <span className="dms-chip dms-chip-success">Active</span>
                    ) : (
                      <span className="dms-chip dms-chip-muted">Inactive</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(() => {
                      const ts = TYPE_STYLE[s.discount_type] || {};
                      return <Badge bg={ts.bg} color={ts.color}>{s.discount_type.replace(/_/g, ' ')}</Badge>;
                    })()}
                    {(() => {
                      const as_ = AUDIENCE_STYLE[s.target_audience] || {};
                      return <Badge bg={as_.bg} color={as_.color}>{s.target_audience}</Badge>;
                    })()}
                    <Badge bg="var(--c-grey-20)" color="var(--c-text-sub)">{ELIG_LABELS[s.eligibility_type]}</Badge>
                    {s.slabs?.length > 1 && (
                      <Badge bg="#FEF0E7" color="#9a5a00">{s.slabs.length} slabs</Badge>
                    )}
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 4 }}>
                    {slabSummary(s)}
                  </div>

                  {s.description && (
                    <div style={{ fontSize: 12, color: 'var(--c-grey-60)', marginBottom: 4 }}>{s.description}</div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--c-grey-60)' }}>
                      Starts: <span style={{ color: 'var(--c-text-sub)', fontWeight: 500 }}>{formatDateTime(s.start_at)}</span>
                    </span>
                    {s.has_end_date && s.end_at && (
                      <span style={{ fontSize: 11, color: 'var(--c-grey-60)' }}>
                        Ends: <span style={{ color: 'var(--c-text-sub)', fontWeight: 500 }}>{formatDateTime(s.end_at)}</span>
                      </span>
                    )}
                    {s.articles?.length > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--c-grey-60)' }}>{s.articles.length} article(s)</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {/* Submit for Approval (data_entry only, only when DRAFT or REJECTED) */}
                  {user?.role === 'data_entry' && (s.approval_status === 'DRAFT' || s.approval_status === 'REJECTED') && (
                    <button
                      onClick={(e) => handleSubmitForApproval(e, s)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '6px 14px', borderRadius: 100,
                        border: '1px solid #2563eb', background: '#eff6ff',
                        color: '#2563eb', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                      Submit
                    </button>
                  )}
                  <button
                    onClick={(e) => handleToggle(e, s.id, s.is_active)}
                    style={{
                      padding: '6px 14px', borderRadius: 100,
                      border: `1px solid ${s.is_active ? 'var(--c-success)' : 'var(--c-grey-40)'}`,
                      background: s.is_active ? 'var(--c-success-bg)' : 'var(--c-grey-20)',
                      color: s.is_active ? 'var(--c-success)' : 'var(--c-text-sub)',
                      fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s.is_active ? 'Active' : 'Activate'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, s.id, s.name)}
                    style={{
                      background: 'none', border: `1px solid var(--c-grey-40)`,
                      color: 'var(--c-error)', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      padding: '6px 12px', borderRadius: 100,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-error-bg)'; e.currentTarget.style.borderColor = 'var(--c-error)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--c-grey-40)'; }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
