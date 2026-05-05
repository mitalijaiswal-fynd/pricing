import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getScheme, getArticles, createScheme, updateScheme, getDistributors } from '../api';
import { toast } from '../components/Toast';

const DISCOUNT_TYPE_ICONS = {
  BUY_X_GET_Y: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="10" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 14h18" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 10V21" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 10c0-1.657 1.343-3 3-3 .47 0 .91.107 1.302.296" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 10c0-1.657-1.343-3-3-3-.47 0-.91.107-1.302.296" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 10H5.5a1.5 1.5 0 0 1 0-3C7 7 8 8.5 8 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M16 10h2.5a1.5 1.5 0 0 0 0-3C17 7 16 8.5 16 10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  ),
  AMOUNT_OFF_PRODUCTS: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8 8a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-8-8z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
      <path d="M15 12l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  AMOUNT_OFF_ORDER: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 7h8M8 11h8M8 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 17l-1.5 1.5L16 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const DISCOUNT_TYPES = [
  { key: 'BUY_X_GET_Y',        label: 'Buy X Get Y Free',     desc: 'Customer buys X items, gets Y free' },
  { key: 'AMOUNT_OFF_PRODUCTS', label: 'Amount Off Products',  desc: 'Discount on specific products' },
  { key: 'AMOUNT_OFF_ORDER',    label: 'Amount Off Order',     desc: 'Discount on the entire order' },
];

const MAX_SLABS = 10;

/* Geographic scope levels for the Segments sub-section */
const REGION_LEVELS = [
  {
    key:   'PAN_INDIA',
    label: 'Pan India Level',
    desc:  'Discount scheme applicable uniformly across all regions in India',
  },
  {
    key:   'REGION',
    label: 'Regional Level',
    desc:  'Discount scheme applicable to a specific geographic region (e.g. West, South)',
  },
  {
    key:   'STATE',
    label: 'State Level',
    desc:  'Discount scheme applicable to one or more specific states',
  },
];

/* Eligibility options — change labels based on target audience */
function eligibilityOptions(audience) {
  const isRetailer = audience === 'RETAILER';
  const entity     = isRetailer ? 'Retailer'    : 'Distributor';
  const entities   = isRetailer ? 'retailers'   : 'distributors';
  return [
    {
      key:   'ALL',
      label: `All ${entity}s`,
      desc:  `This scheme applies to every ${entity.toLowerCase()}`,
    },
    {
      key:   'SEGMENT',
      label: `Specific ${entity} Segments`,
      desc:  `Select ${entity.toLowerCase()} segments by geographic scope`,
    },
    {
      key:   'SPECIFIC',
      label: `Specific ${entity}s`,
      desc:  `Search and add individual ${entities}`,
    },
  ];
}

function nowLocalISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function emptyBxgySlab()   { return { min_quantity: '', free_quantity: '' }; }
function emptyAmountSlab() { return { min_quantity: '', discount_value: '' }; }

/* ── Section card wrapper ── */
function Section({ title, children }) {
  return (
    <div className="dms-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
      <div className="dms-section-label" style={{ marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  );
}

/* ── Selector card (audience / discount type) ── */
function SelectorCard({ selected, onClick, disabled, icon, iconSrc, iconNode, label, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: '16px',
        borderRadius: 12,
        border: `2px solid ${selected ? 'var(--c-primary)' : 'var(--c-grey-40)'}`,
        background: selected ? 'var(--c-primary-bg)' : '#fff',
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
        transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => { if (!disabled && !selected) e.currentTarget.style.borderColor = 'var(--c-primary-soft)'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = 'var(--c-grey-40)'; }}
    >
      <div style={{
        marginBottom: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, borderRadius: 10,
        background: selected ? 'var(--c-primary-light)' : 'var(--c-grey-20)',
        color: selected ? 'var(--c-primary)' : 'var(--c-text-sub)',
      }}>
        {iconNode
          ? iconNode
          : iconSrc
            ? <img src={iconSrc} alt="" style={{ width: 22, height: 22, opacity: selected ? 1 : 0.6, filter: selected ? 'invert(24%) sepia(90%) saturate(2000%) hue-rotate(210deg) brightness(90%)' : 'none' }} />
            : <span style={{ fontSize: 20 }}>{icon}</span>
        }
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--c-text-sub)' }}>{desc}</div>
    </button>
  );
}

export default function SchemeEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [allArticles, setAllArticles]       = useState([]);
  const [distSearch, setDistSearch]         = useState('');
  const [distResults, setDistResults]       = useState([]);
  const [articleSearch, setArticleSearch]   = useState('');
  const [saving, setSaving]                 = useState(false);
  const [schemeCode, setSchemeCode]         = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    target_audience: 'DISTRIBUTOR',
    discount_type: 'BUY_X_GET_Y',
    value_type: 'PERCENTAGE',
    start_at: nowLocalISO(),
    has_end_date: false,
    end_at: '',
    is_active: true,
    eligibility_type: 'ALL',
    articles: [],
    segment_ids: [],
    distributor_ids: [],
  });

  const [slabs, setSlabs] = useState([emptyBxgySlab()]);
  const [selectedDistributors, setSelectedDistributors] = useState([]);

  useEffect(() => {
    getArticles().then((list) => setAllArticles(list.map((x) => x.article)));
  }, []);

  useEffect(() => {
    if (!isNew) {
      getScheme(id).then((s) => {
        setSchemeCode(s.code || '');
        setForm({
          name: s.name,
          description: s.description || '',
          target_audience: s.target_audience || 'DISTRIBUTOR',
          discount_type: s.discount_type,
          value_type: s.value_type || 'PERCENTAGE',
          start_at: s.start_at ? s.start_at.slice(0, 16) : nowLocalISO(),
          has_end_date: s.has_end_date,
          end_at: s.end_at ? s.end_at.slice(0, 16) : '',
          is_active: s.is_active,
          eligibility_type: s.eligibility_type,
          articles: s.articles.map((a) => ({ article_id: a.article_id })),
          segment_ids: s.segments?.map((seg) => seg.id) || [],
          distributor_ids: s.distributors?.map((d) => d.id) || [],
        });
        if (s.slabs && s.slabs.length > 0) {
          setSlabs(s.slabs.map((sl) => ({
            min_quantity: String(sl.min_quantity),
            free_quantity: sl.free_quantity != null ? String(sl.free_quantity) : '',
            discount_value: sl.discount_value != null ? String(sl.discount_value) : '',
          })));
        } else {
          setSlabs([s.discount_type === 'BUY_X_GET_Y' ? emptyBxgySlab() : emptyAmountSlab()]);
        }
        setSelectedDistributors(s.distributors || []);
      });
    }
  }, [id, isNew]);

  useEffect(() => {
    if (distSearch.length >= 2) {
      getDistributors(distSearch).then(setDistResults);
    } else {
      setDistResults([]);
    }
  }, [distSearch]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const isBxgy = form.discount_type === 'BUY_X_GET_Y';

  const handleTypeChange = (key) => {
    set({ discount_type: key });
    setSlabs([key === 'BUY_X_GET_Y' ? emptyBxgySlab() : emptyAmountSlab()]);
  };

  const updateSlab = (idx, field, value) =>
    setSlabs((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  const addSlab = () => {
    if (slabs.length >= MAX_SLABS) return;
    setSlabs((prev) => [...prev, isBxgy ? emptyBxgySlab() : emptyAmountSlab()]);
  };

  const removeSlab = (idx) => {
    if (slabs.length <= 1) return;
    setSlabs((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleArticle = (articleId) => {
    setForm((f) => {
      const exists = f.articles.find((a) => a.article_id === articleId);
      return exists
        ? { ...f, articles: f.articles.filter((a) => a.article_id !== articleId) }
        : { ...f, articles: [...f.articles, { article_id: articleId }] };
    });
  };

  const toggleSegment = (segId) => {
    setForm((f) => {
      const exists = f.segment_ids.includes(segId);
      return exists
        ? { ...f, segment_ids: f.segment_ids.filter((s) => s !== segId) }
        : { ...f, segment_ids: [...f.segment_ids, segId] };
    });
  };

  const addDistributor = (dist) => {
    if (form.distributor_ids.includes(dist.id)) return;
    set({ distributor_ids: [...form.distributor_ids, dist.id] });
    setSelectedDistributors((prev) => [...prev, dist]);
    setDistSearch('');
    setDistResults([]);
  };

  const removeDistributor = (distId) => {
    set({ distributor_ids: form.distributor_ids.filter((d) => d !== distId) });
    setSelectedDistributors((prev) => prev.filter((d) => d.id !== distId));
  };

  const slabsValid = slabs.every((s) => {
    const qty = parseInt(s.min_quantity, 10);
    if (!qty || qty < 1) return false;
    if (isBxgy) {
      const free = parseInt(s.free_quantity, 10);
      return free && free >= 1;
    }
    const disc = parseFloat(s.discount_value);
    return disc != null && disc >= 0 && s.discount_value !== '';
  });

  const articlesRequired = form.discount_type !== 'AMOUNT_OFF_ORDER';
  const canSave = form.name && slabsValid && (!articlesRequired || form.articles.length > 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        slabs: slabs.map((s) => {
          const obj = { min_quantity: parseInt(s.min_quantity, 10) };
          if (isBxgy) obj.free_quantity = parseInt(s.free_quantity, 10);
          else obj.discount_value = parseFloat(s.discount_value);
          return obj;
        }),
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.has_end_date && form.end_at ? new Date(form.end_at).toISOString() : null,
      };
      if (isBxgy) delete payload.value_type;
      if (isNew) {
        const created = await createScheme(payload);
        toast.success('Scheme created successfully');
        navigate(`/schemes/${created.id}`, { replace: true });
      } else {
        delete payload.name;
        await updateScheme(id, payload);
        toast.success('Scheme updated successfully');
      }
      navigate('/schemes');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Back */}
      <Link
        to="/schemes"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 15, fontWeight: 600,
          color: 'var(--c-primary-mid)', textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Schemes
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text)', margin: '0 0 24px' }}>
        {isNew ? 'Create Scheme' : 'Edit Scheme'}
      </h1>

      {/* ─── Basic Info ─── */}
      <Section title="Basic Info">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isNew && schemeCode && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
                Scheme Code
              </label>
              <div style={{
                padding: '10px 14px', background: 'var(--c-grey-20)',
                border: '1px solid var(--c-grey-40)', borderRadius: 8,
                fontFamily: 'monospace', fontSize: 13, color: 'var(--c-text-sub)',
                userSelect: 'all',
              }}>
                {schemeCode}
              </div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              Scheme Name {!isNew && <span style={{ fontWeight: 400, opacity: 0.6 }}>(read-only)</span>}
            </label>
            {isNew ? (
              <>
                <input
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="dms-input"
                  placeholder="e.g. Summer BOGO Offer"
                />
                {form.name && (
                  <div style={{ fontSize: 11, color: 'var(--c-grey-60)', marginTop: 4 }}>
                    Code: <span style={{ fontFamily: 'monospace', color: 'var(--c-text-sub)' }}>
                      {form.name.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || '—'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                padding: '10px 14px', background: 'var(--c-grey-20)',
                border: '1px solid var(--c-grey-40)', borderRadius: 8,
                fontSize: 14, color: 'var(--c-text-sub)',
              }}>
                {form.name}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={2}
              className="dms-input"
              style={{ resize: 'none' }}
              placeholder="Describe the scheme…"
            />
          </div>
        </div>
      </Section>

      {/* ─── Target Audience ─── */}
      <Section title="Offer For">
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { key: 'DISTRIBUTOR', label: 'Distributors', iconSrc: '/icon-distributor.svg', desc: 'Offer applies to distributors' },
            { key: 'RETAILER',    label: 'Retailers',    iconSrc: '/icon-retailer.svg',    desc: 'Offer applies to retailers' },
          ].map((opt) => (
            <SelectorCard
              key={opt.key}
              selected={form.target_audience === opt.key}
              onClick={() => set({ target_audience: opt.key })}
              iconSrc={opt.iconSrc} label={opt.label} desc={opt.desc}
            />
          ))}
        </div>
      </Section>

      {/* ─── Discount Type ─── */}
      <Section title="Discount Type">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {DISCOUNT_TYPES.map((dt) => (
            <SelectorCard
              key={dt.key}
              selected={form.discount_type === dt.key}
              onClick={() => handleTypeChange(dt.key)}
              disabled={!isNew}
              iconNode={DISCOUNT_TYPE_ICONS[dt.key]} label={dt.label} desc={dt.desc}
            />
          ))}
        </div>
        {!isNew && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'var(--c-warning-bg)', borderRadius: 8,
            fontSize: 12, color: 'var(--c-warning)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 6v3M7 10v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Discount type cannot be changed after creation.
          </div>
        )}
      </Section>

      {/* ─── Value Type ─── */}
      {!isBxgy && (
        <Section title="Discount Mode">
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'PERCENTAGE', label: 'Percentage (%)' },
              { key: 'FIXED',      label: 'Fixed Amount (₹)' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => set({ value_type: opt.key })}
                style={{
                  padding: '8px 20px', borderRadius: 100,
                  border: `2px solid ${form.value_type === opt.key ? 'var(--c-primary)' : 'var(--c-grey-40)'}`,
                  background: form.value_type === opt.key ? 'var(--c-primary-bg)' : '#fff',
                  color: form.value_type === opt.key ? 'var(--c-primary-mid)' : 'var(--c-text-sub)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ─── Slabs ─── */}
      <Section title={`Quantity Slabs (${slabs.length}/${MAX_SLABS})`}>
        <p style={{ fontSize: 12, color: 'var(--c-text-sub)', marginBottom: 14, marginTop: -8 }}>
          {isBxgy
            ? 'Define quantity tiers: higher purchases unlock more free items.'
            : `Define quantity tiers: higher quantities unlock bigger ${form.value_type === 'PERCENTAGE' ? 'percentage' : 'amount'} discounts.`}
        </p>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 1fr 36px',
          gap: 8, marginBottom: 8,
          padding: '0 0 8px',
          borderBottom: '1px solid var(--c-grey-40)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-grey-60)', textTransform: 'uppercase' }}>#</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-grey-60)', textTransform: 'uppercase' }}>
            {isBxgy ? 'Min Buy Qty' : 'Min Quantity'}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-grey-60)', textTransform: 'uppercase' }}>
            {isBxgy ? 'Free Qty' : form.value_type === 'PERCENTAGE' ? 'Discount %' : 'Discount ₹'}
          </div>
          <div />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slabs.map((slab, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 36px', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 13, fontFamily: 'monospace', fontWeight: 700,
                color: 'var(--c-primary-mid)', textAlign: 'center',
                background: 'var(--c-primary-bg)', borderRadius: 6, padding: '4px 0',
              }}>
                {idx + 1}
              </span>
              <input
                type="number" min={1} placeholder="e.g. 5"
                value={slab.min_quantity}
                onChange={(e) => updateSlab(idx, 'min_quantity', e.target.value)}
                className="dms-input"
              />
              {isBxgy ? (
                <input
                  type="number" min={1} placeholder="e.g. 1"
                  value={slab.free_quantity}
                  onChange={(e) => updateSlab(idx, 'free_quantity', e.target.value)}
                  className="dms-input"
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number" min={0} step={form.value_type === 'PERCENTAGE' ? 0.1 : 1}
                    placeholder={form.value_type === 'PERCENTAGE' ? 'e.g. 10' : 'e.g. 50'}
                    value={slab.discount_value}
                    onChange={(e) => updateSlab(idx, 'discount_value', e.target.value)}
                    className="dms-input"
                  />
                  <span style={{ fontSize: 13, color: 'var(--c-grey-60)', fontWeight: 600, flexShrink: 0 }}>
                    {form.value_type === 'PERCENTAGE' ? '%' : '₹'}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeSlab(idx)}
                disabled={slabs.length <= 1}
                style={{
                  background: 'none', border: 'none', cursor: slabs.length <= 1 ? 'not-allowed' : 'pointer',
                  color: slabs.length <= 1 ? 'var(--c-grey-40)' : 'var(--c-error)',
                  fontSize: 18, fontFamily: 'inherit', padding: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Remove slab"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSlab}
          disabled={slabs.length >= MAX_SLABS}
          className="dms-btn-link"
          style={{ marginTop: 14, fontSize: 13 }}
        >
          + Add Slab {slabs.length >= MAX_SLABS && `(max ${MAX_SLABS})`}
        </button>

        {/* Slab preview */}
        {slabs.length > 1 && slabsValid && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--c-grey-40)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-grey-60)', textTransform: 'uppercase', marginBottom: 8 }}>
              Preview
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {slabs.map((s, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px',
                  background: 'var(--c-primary-bg)', borderRadius: 100,
                  fontSize: 12, fontWeight: 600, color: 'var(--c-primary-mid)',
                }}>
                  {s.min_quantity}+
                  <span style={{ color: 'var(--c-grey-60)' }}>→</span>
                  {isBxgy
                    ? <span style={{ color: 'var(--c-success)' }}>{s.free_quantity} free</span>
                    : <span style={{ color: 'var(--c-primary-mid)' }}>{s.discount_value}{form.value_type === 'PERCENTAGE' ? '%' : '₹'} off</span>
                  }
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ─── Duration ─── */}
      <Section title="Duration">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              Start Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => set({ start_at: e.target.value })}
              className="dms-input"
            />
          </div>
          <div>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)',
              marginBottom: 6, cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={form.has_end_date}
                onChange={(e) => set({ has_end_date: e.target.checked, end_at: e.target.checked ? form.end_at : '' })}
                style={{ accentColor: 'var(--c-primary)' }}
              />
              Set End Date
            </label>
            {form.has_end_date ? (
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => set({ end_at: e.target.value })}
                className="dms-input"
              />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--c-grey-60)', padding: '10px 0' }}>
                No end date — scheme runs indefinitely
              </div>
            )}
          </div>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 600, color: 'var(--c-text)', cursor: 'pointer',
          marginTop: 14,
        }}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set({ is_active: e.target.checked })}
            style={{ accentColor: 'var(--c-primary)', width: 16, height: 16 }}
          />
          Mark as Active
        </label>
      </Section>

      {/* ─── Eligibility — labels adapt to target audience ─── */}
      <Section title="Eligibility">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {eligibilityOptions(form.target_audience).map((opt) => (
            <label
              key={opt.key}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                borderRadius: 10,
                border: `2px solid ${form.eligibility_type === opt.key ? 'var(--c-primary)' : 'var(--c-grey-40)'}`,
                background: form.eligibility_type === opt.key ? 'var(--c-primary-bg)' : '#fff',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <input
                type="radio" name="eligibility"
                checked={form.eligibility_type === opt.key}
                onChange={() => set({ eligibility_type: opt.key, segment_ids: [], distributor_ids: [] })}
                style={{ accentColor: 'var(--c-primary)', marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-sub)', marginTop: 2 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {form.eligibility_type === 'SEGMENT' && (
          <div style={{
            marginTop: 8,
            marginLeft: 28,
            paddingLeft: 16,
            borderLeft: '2px solid var(--c-primary-light)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--c-primary-mid)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              marginBottom: 10,
            }}>
              Select Scope
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REGION_LEVELS.map((lvl) => {
                const isSelected = form.segment_ids[0] === lvl.key;
                return (
                  <label
                    key={lvl.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px',
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? 'var(--c-primary)' : 'var(--c-grey-40)'}`,
                      background: isSelected ? 'var(--c-primary-bg)' : '#fff',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--c-primary-soft)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--c-grey-40)'; }}
                  >
                    <input
                      type="radio"
                      name="region_level"
                      checked={isSelected}
                      onChange={() => set({ segment_ids: [lvl.key] })}
                      style={{ accentColor: 'var(--c-primary)', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 13, fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? 'var(--c-primary-mid)' : 'var(--c-text)',
                      }}>
                        {lvl.label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--c-text-sub)', marginTop: 2, fontWeight: 400 }}>
                        {lvl.desc}
                      </div>
                    </div>
                    {isSelected && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="7" fill="var(--c-primary)" />
                        <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {form.eligibility_type === 'SPECIFIC' && (
          <div style={{ paddingLeft: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 8 }}>
              Search &amp; Add {form.target_audience === 'RETAILER' ? 'Retailers' : 'Distributors'}
            </div>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type="text"
                value={distSearch}
                onChange={(e) => setDistSearch(e.target.value)}
                placeholder="Search by name, code, or city…"
                className="dms-input"
              />
              {distResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                  background: '#fff', border: '1px solid var(--c-grey-40)', borderRadius: 10,
                  marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {distResults
                    .filter((d) => !form.distributor_ids.includes(d.id))
                    .map((d) => (
                      <button
                        key={d.id} type="button"
                        onClick={() => addDistributor(d)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', textAlign: 'left',
                          padding: '10px 14px', border: 'none',
                          background: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          borderBottom: '1px solid var(--c-grey-40)',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-primary-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{d.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--c-text-sub)', marginLeft: 8 }}>{d.code}</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--c-grey-60)' }}>{d.city}, {d.state}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            {selectedDistributors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedDistributors.map((d) => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--c-grey-20)', borderRadius: 8, padding: '8px 12px',
                  }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: 'var(--c-text)' }}>{d.name}</span>
                      <span style={{ color: 'var(--c-text-sub)', marginLeft: 8 }}>{d.code}</span>
                      <span style={{ color: 'var(--c-grey-60)', fontSize: 11, marginLeft: 8 }}>{d.city}, {d.state}</span>
                      {d.segment_name && (
                        <span style={{
                          marginLeft: 8, padding: '2px 6px',
                          background: 'var(--c-primary-bg)', color: 'var(--c-primary-mid)',
                          borderRadius: 4, fontSize: 11, fontWeight: 600,
                        }}>{d.segment_name}</span>
                      )}
                    </div>
                    <button
                      type="button" onClick={() => removeDistributor(d.id)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--c-error)', fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--c-grey-60)' }}>
                No distributors added yet. Search above to add.
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─── Article Picker ─── */}
      {form.discount_type !== 'AMOUNT_OFF_ORDER' && (() => {
        const q = articleSearch.toLowerCase();
        const selectedArticles = allArticles.filter((a) => form.articles.some((sa) => sa.article_id === a.id));
        const filteredArticles = q
          ? allArticles.filter((a) => a.sku.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
          : allArticles;

        return (
          <Section title={`Applicable Articles (${form.articles.length} selected)`}>
            {selectedArticles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {selectedArticles.map((a) => (
                  <span key={a.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px',
                    background: 'var(--c-primary-bg)',
                    border: '1px solid var(--c-primary-soft)',
                    borderRadius: 6, fontSize: 12,
                  }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--c-primary-mid)' }}>{a.sku}</span>
                    <span style={{ color: 'var(--c-text-sub)' }}>{a.name}</span>
                    <button
                      type="button" onClick={() => toggleArticle(a.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-primary-soft)', fontSize: 14, padding: 0, fontFamily: 'inherit' }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            <input
              type="text"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="Search by SKU or name…"
              className="dms-input"
              style={{ marginBottom: 12 }}
            />

            {allArticles.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--c-grey-60)' }}>No articles. Create articles first.</div>
            ) : filteredArticles.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--c-grey-60)' }}>No articles match "{articleSearch}"</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                {filteredArticles.map((a) => {
                  const selected = form.articles.some((sa) => sa.article_id === a.id);
                  return (
                    <div
                      key={a.id}
                      onClick={() => toggleArticle(a.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${selected ? 'var(--c-primary-soft)' : 'transparent'}`,
                        background: selected ? 'var(--c-primary-bg)' : 'transparent',
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--c-grey-20)'; }}
                      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <input
                        type="checkbox" readOnly checked={selected}
                        style={{ accentColor: 'var(--c-primary)', pointerEvents: 'none' }}
                      />
                      <div style={{ fontSize: 13 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--c-text-sub)' }}>{a.sku}</span>
                        <span style={{ marginLeft: 10, color: 'var(--c-text)' }}>{a.name}</span>
                        <span style={{ marginLeft: 10, color: 'var(--c-grey-60)', fontSize: 12 }}>₹{a.mrp}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        );
      })()}

      {/* ─── Validation errors ─── */}
      {!canSave && form.name && (
        <div style={{
          padding: '12px 16px', background: 'var(--c-error-bg)',
          border: `1px solid var(--c-error)`, borderRadius: 10, marginBottom: 16,
        }}>
          {!slabsValid && (
            <div style={{ fontSize: 13, color: 'var(--c-error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4v4M7 9v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Please fill in all slab fields correctly.
            </div>
          )}
          {articlesRequired && form.articles.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--c-error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: !slabsValid ? 6 : 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 4v4M7 9v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Please select at least one article.
            </div>
          )}
        </div>
      )}

      {/* ─── Actions ─── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 64 }}>
        <button
          className="dms-btn-primary"
          onClick={handleSave}
          disabled={saving || !canSave}
          style={{ padding: '10px 36px' }}
        >
          {saving ? 'Saving…' : isNew ? 'Create Scheme' : 'Save Changes'}
        </button>
        <button
          className="dms-btn-secondary"
          onClick={() => navigate('/schemes')}
          style={{ padding: '10px 28px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
