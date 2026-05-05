import { useState, useEffect, useRef, useCallback } from 'react';
import { downloadTemplate, uploadBulkFile, getBulkUploads } from '../api';
import { toast } from '../components/Toast';

/* ── Status config — DMS .status-cell style (bordered, dot+text) ── */
const STATUS_CONFIG = {
  SUCCESS:    { label: 'Success',          cls: 'dms-chip-success', dot: '#25ab21' },
  PARTIAL:    { label: 'Partially Failed', cls: 'dms-chip-warning', dot: '#F06D0F' },
  FAILED:     { label: 'Failed',           cls: 'dms-chip-error',   dot: '#f50031' },
  PROCESSING: { label: 'Processing',       cls: 'dms-chip-muted',   dot: '#595959' },
};

function StatusChip({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'dms-chip-muted', dot: '#595959' };
  return (
    <span className={`dms-chip ${cfg.cls}`}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

/* ── Date formatter — matches DMS "04/05/26, 1:05 pm" style ── */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const yr    = String(d.getFullYear()).slice(2);
  const time  = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  return `${day}/${month}/${yr}, ${time}`;
}

/* ── Error Modal ── */
function ErrorModal({ upload, onClose }) {
  const errors = upload?.error_details?.errors || [];

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 680,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--c-grey-40)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>
              Errors while uploading file
            </div>
            <div style={{ fontSize: 13, color: 'var(--c-text-sub)', marginTop: 4, fontWeight: 400 }}>
              {upload?.filename} &nbsp;·&nbsp; {errors.length} error{errors.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-primary-hover)', padding: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Error table */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr>
                <th className="dms-th" style={{ width: 70 }}>Row</th>
                <th className="dms-th" style={{ width: 120 }}>SKU</th>
                <th className="dms-th">Error Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--c-grey-40)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--c-error)', fontWeight: 600, fontSize: 14 }}>
                    {err.row}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--c-text-sub)', fontSize: 14 }}>
                    {err.sku || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--c-text)', fontSize: 14 }}>
                    {err.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--c-grey-40)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button className="dms-btn-primary" onClick={onClose} style={{ padding: '8px 28px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Drop zone ── */
function DropZone({ onFile, uploading }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      className={`dms-drop-zone ${isDragOver ? 'drag-over' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onClick={() => !uploading && inputRef.current?.click()}
      style={{ minHeight: 160, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onFile(f); e.target.value = ''; } }}
        disabled={uploading}
      />

      {uploading ? (
        <>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid var(--c-primary-bg)',
            borderTopColor: 'var(--c-primary)',
            animation: 'spin 0.8s linear infinite',
            marginBottom: 16,
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text-sub)' }}>Uploading file…</div>
        </>
      ) : (
        <>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
            <rect width="48" height="48" rx="24" fill="var(--c-primary-bg)"/>
            <path d="M24 30V20M24 20l-4 4M24 20l4 4" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 33h14" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round"/>
            <path d="M15 26.5a5 5 0 01.5-10 7 7 0 0113.5 2 5 5 0 01-.5 8" stroke="var(--c-primary-soft)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text-sub)' }}>
            Drag &amp; drop your Excel file here, or{' '}
            <span className="browse-link">browse</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-grey-60)', marginTop: 6 }}>
            Supports .xlsx, .xls
          </div>
        </>
      )}
    </div>
  );
}

/* ── Tab counts helper ── */
function tabCounts(uploads) {
  return {
    all:     uploads.length,
    success: uploads.filter((u) => u.status === 'SUCCESS').length,
    error:   uploads.filter((u) => u.status === 'FAILED' || u.status === 'PARTIAL').length,
  };
}

/* ── Main component ── */
export default function BulkUpload() {
  const [uploads, setUploads]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [errorModal, setErrorModal] = useState(null);
  const [activeTab, setActiveTab]   = useState('all');
  const [sortAsc, setSortAsc]       = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUploads(await getBulkUploads()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async () => {
    try {
      await downloadTemplate();
      toast.success('Template downloaded successfully');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleFile = async (file) => {
    setUploading(true);
    try {
      await uploadBulkFile(file);
      toast.success(`"${file.name}" uploaded successfully`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please check the file and try again.');
    } finally {
      setUploading(false);
    }
  };

  /* DMS cell style */
  const cell = { padding: '14px 16px', fontSize: 14, fontWeight: 500, color: 'var(--c-text)' };

  const counts = tabCounts(uploads);
  const TABS = [
    { key: 'all',     label: `All (${counts.all})` },
    { key: 'success', label: 'Successfully Uploaded' },
    { key: 'error',   label: 'Error' },
  ];
  const filtered = (activeTab === 'all'
    ? uploads
    : activeTab === 'success'
      ? uploads.filter((u) => u.status === 'SUCCESS')
      : uploads.filter((u) => u.status === 'FAILED' || u.status === 'PARTIAL')
  ).slice().sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortAsc ? ta - tb : tb - ta;
  });

  return (
    <div>
      {/* ─ Upload card ─ */}
      <div className="dms-card" style={{ padding: '28px', marginBottom: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
            Upload in Bulk
          </div>
          <div style={{ fontSize: 14, color: 'var(--c-text-sub)', marginTop: 6, fontWeight: 400 }}>
            Download the template, fill in article and pricing data, then upload.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 28, alignItems: 'start' }}>
          {/* Step 1 */}
          <div>
            <div className="dms-section-label">Step 1 — Get Template</div>
            <div style={{
              background: 'var(--c-grey-20)',
              borderRadius: 12,
              padding: '18px 20px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 }}>
                Pricing Bulk Template
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text-sub)', fontWeight: 400, lineHeight: 1.6 }}>
                Fill in serviceability scope, article ID, MRP, and retailer margin details. The template includes a sample row and an Attribute Definition sheet.
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-grey-60)', marginTop: 10, fontWeight: 400, lineHeight: 1.6 }}>
                <strong>Mandatory:</strong> Serviceability Level · Serviceability Value · Merchant Classification Type · Article ID · MRP · Retailer Margin Type · Retailer Margin Value · Start Date · End Date
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-grey-60)', marginTop: 6, fontWeight: 400 }}>
                <strong>Retailer margin types:</strong> Markdown as % of MRP · Re off on MRP (absolute) · Absolute PTR
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-grey-60)', marginTop: 4, fontWeight: 400 }}>
                <strong>Distributor margin types:</strong> Markdown as % of PTR · Re off on PTR (absolute) · Absolute PTD
              </div>
            </div>
            <button className="dms-btn-secondary" onClick={handleDownload} style={{ width: '100%', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
                Download Template (.xlsx)
              </button>
          </div>

          {/* Step 2 */}
          <div>
            <div className="dms-section-label">Step 2 — Upload Filled File</div>
            <DropZone onFile={handleFile} uploading={uploading} />
          </div>
        </div>
      </div>

      {/* ─ Uploaded Documents table — DMS "Uploaded documents" section ─ */}
      <div className="dms-table-wrap">

        {/* Row 1 — title + refresh */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
            Uploaded Documents
          </div>
          <button
            onClick={load}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--c-primary-mid)',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 112 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 4v3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* Row 2 — DMS tabs + Date & Time filter — matches DMS "All / Successfully Uploaded / Error" row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '2px solid var(--c-grey-40)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #0F3CC9' : '2px solid transparent',
                    marginBottom: -2,
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#0F3CC9' : 'var(--c-text-sub)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
      </div>

          {/* Filter button — Date & Time sort toggle */}
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: '#fff',
              border: '1px solid var(--c-border)',
              borderRadius: 8,
              fontSize: 13, fontWeight: 500,
              color: 'var(--c-text)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {sortAsc ? 'Oldest First' : 'Newest First'}
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: sortAsc ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
            Loading uploads…
          </div>
        ) : uploads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 12 }}>
              <rect x="12" y="8" width="24" height="32" rx="3" stroke="var(--c-grey-40)" strokeWidth="2"/>
              <path d="M18 18h12M18 24h8" stroke="var(--c-grey-60)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: 14, color: 'var(--c-text-sub)', fontWeight: 500 }}>No uploads yet</div>
            <div style={{ fontSize: 13, color: 'var(--c-grey-60)', marginTop: 4 }}>Upload your first file using the form above.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--c-text-sub)', fontSize: 14 }}>
            No uploads match this filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="dms-th">File Name</th>
                <th className="dms-th dms-th-right">Total Rows</th>
                <th className="dms-th dms-th-right">Success</th>
                <th className="dms-th dms-th-right">Failed</th>
                <th className="dms-th">Created By</th>
                <th className="dms-th">Upload Date &amp; Time</th>
                <th className="dms-th">Status</th>
                <th className="dms-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: '1px solid var(--c-grey-40)', background: '#fff', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-primary-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ ...cell, maxWidth: 240 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.filename}
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>
                    {u.total_rows ?? '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: 'var(--c-success)' }}>
                    {u.success_count ?? '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: u.failed_count > 0 ? 'var(--c-error)' : 'var(--c-grey-60)' }}>
                    {u.failed_count ?? '—'}
                  </td>
                  <td style={{ ...cell, color: 'var(--c-text-sub)' }}>
                    {u.created_by || 'System User'}
                  </td>
                  <td style={{ ...cell, fontSize: 13, color: 'var(--c-text-sub)', whiteSpace: 'nowrap' }}>
                    {fmtDate(u.created_at)}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <StatusChip status={u.status} />
                  </td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    {u.failed_count > 0 && (
                      <button className="dms-btn-link" onClick={() => setErrorModal(u)}>
                        View Error
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {errorModal && <ErrorModal upload={errorModal} onClose={() => setErrorModal(null)} />}
    </div>
  );
}
