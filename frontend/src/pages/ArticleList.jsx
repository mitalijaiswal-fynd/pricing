import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getArticles, createArticle, deleteArticle } from '../api';
import ArticleForm from '../components/ArticleForm';
import BulkUpload from './BulkUpload';
import { toast } from '../components/Toast';

function fmt(v) {
  if (v == null) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS = [
  { key: 'single', label: 'Single SKU' },
  { key: 'bulk',   label: 'Bulk Upload' },
];

/* DMS-style pill tab bar */
function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderBottom: '2px solid var(--c-grey-40)',
      marginBottom: 24,
      gap: 0,
    }}>
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--c-primary-mid)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 14,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--c-primary-mid)' : 'var(--c-text-sub)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ArticleList() {
  const [tab, setTab]         = useState('single');
  const [articles, setArticles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { setArticles(await getArticles()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    await createArticle(data);
    setShowForm(false);
    toast.success('Article created successfully');
    load();
  };

  const handleDelete = async (e, id, sku) => {
    e.stopPropagation();
    if (!confirm(`Delete "${sku}" and its pricing rule?`)) return;
    await deleteArticle(id);
    toast.success('Article deleted');
    load();
  };

  const q = search.toLowerCase();
  const filtered = q
    ? articles.filter((item) =>
        item.article.sku.toLowerCase().includes(q) ||
        item.article.name.toLowerCase().includes(q))
    : articles;

  /* DMS table cell — compact padding so columns aren't wasteful */
  const cell = { padding: '13px 14px', fontSize: 14, fontWeight: 500, color: 'var(--c-text)' };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text)', margin: 0, letterSpacing: '-0.02em' }}>
            Articles &amp; Pricing
          </h1>
          <p style={{ fontSize: 14, color: 'var(--c-text-sub)', margin: '6px 0 0', fontWeight: 400 }}>
            Manage articles and their pricing waterfall
          </p>
        </div>
        {tab === 'single' && (
          <button
            className="dms-btn-primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ Close' : '+ Add Article'}
          </button>
        )}
      </div>

      <TabBar active={tab} onChange={(k) => { setTab(k); setShowForm(false); }} />

      {/* ─── Single SKU tab ─── */}
      {tab === 'single' && (
        <>
          {showForm && (
            <ArticleForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Search */}
          {!loading && articles.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '0 1 360px' }}>
                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-grey-60)' }}
                >
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by SKU or product name…"
                  className="dms-input"
                  style={{ paddingLeft: 36 }}
                />
              </div>
              {search && (
                <button className="dms-btn-link" onClick={() => setSearch('')}>Clear</button>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
              Loading articles…
            </div>
          ) : articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ fontSize: 14, color: 'var(--c-text-sub)', fontWeight: 500 }}>No articles yet</div>
              <div style={{ fontSize: 13, color: 'var(--c-grey-60)', marginTop: 4 }}>Click "+ Add Article" to get started.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
              No articles match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="dms-table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '130px' }} />  {/* SKU */}
                  <col style={{ width: '220px' }} />  {/* Name — fixed, truncated if long */}
                  <col style={{ width: '120px' }} />  {/* MRP */}
                  <col style={{ width: '110px' }} />  {/* PTR */}
                  <col style={{ width: '110px' }} />  {/* PTD */}
                  <col style={{ width: '120px' }} />  {/* SS Price */}
                  <col style={{ width: '70px'  }} />  {/* Actions */}
                </colgroup>
                <thead>
                  <tr>
                    <th className="dms-th" style={{ padding: '13px 14px' }}>SKU</th>
                    <th className="dms-th" style={{ padding: '13px 14px' }}>Name</th>
                    <th className="dms-th dms-th-right" style={{ padding: '13px 14px' }}>MRP (₹)</th>
                    <th className="dms-th dms-th-right" style={{ padding: '13px 14px' }}>PTR (₹)</th>
                    <th className="dms-th dms-th-right" style={{ padding: '13px 14px' }}>PTD (₹)</th>
                    <th className="dms-th dms-th-right" style={{ padding: '13px 14px' }}>SS Price (₹)</th>
                    <th className="dms-th" style={{ padding: '13px 14px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.article.id}
                      onClick={() => navigate(`/articles/${item.article.id}`)}
                      style={{
                        borderBottom: '1px solid var(--c-grey-40)',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-primary-bg)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      {/* SKU — truncated, monospace-free, DMS primary-mid blue */}
                      <td style={{ ...cell, fontWeight: 700, color: 'var(--c-primary-mid)' }}>
                        <div style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={item.article.sku}>
                          {item.article.sku}
                        </div>
                      </td>

                      {/* Name — truncated with tooltip */}
                      <td style={cell}>
                        <div style={{
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={item.article.name}>
                          {item.article.name}
                        </div>
                      </td>

                      {/* MRP — bold base price */}
                      <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>
                        {fmt(item.article.mrp)}
                      </td>

                      {/* PTR — DMS primary blue */}
                      <td style={{ ...cell, textAlign: 'right', color: 'var(--c-primary)', fontWeight: 600 }}>
                        {fmt(item.waterfall?.ptr)}
                      </td>

                      {/* PTD — DMS mid blue */}
                      <td style={{ ...cell, textAlign: 'right', color: 'var(--c-primary-mid)', fontWeight: 600 }}>
                        {fmt(item.waterfall?.ptd)}
                      </td>

                      {/* SS Price — DMS deep blue */}
                      <td style={{ ...cell, textAlign: 'right', color: 'var(--c-primary-deep)', fontWeight: 700 }}>
                        {fmt(item.waterfall?.ss_price)}
                      </td>

                      {/* Delete action */}
                      <td style={{ ...cell, textAlign: 'right', padding: '14px 12px' }}>
                        <button
                          onClick={(e) => handleDelete(e, item.article.id, item.article.sku)}
                          style={{
                            background: 'none', border: 'none',
                            color: 'var(--c-error)', fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'bulk' && <BulkUpload />}
    </div>
  );
}
