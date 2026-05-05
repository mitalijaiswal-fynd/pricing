import { useState } from 'react';

export default function ArticleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ sku: '', name: '', mrp: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, mrp: parseFloat(form.mrp) });
    setForm({ sku: '', name: '', mrp: '' });
  };

  return (
    <div className="dms-card" style={{ padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 16 }}>
        Add New Article
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              SKU *
            </label>
            <input
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="dms-input"
              placeholder="e.g. SKU-006"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="dms-input"
              placeholder="e.g. Product Name"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', marginBottom: 6 }}>
              MRP (₹) *
            </label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: e.target.value })}
              className="dms-input"
              placeholder="e.g. 100"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="dms-btn-primary">
            Create Article
          </button>
          <button type="button" className="dms-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
