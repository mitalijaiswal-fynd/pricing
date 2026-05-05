import { useState, useEffect } from 'react';

const listeners = new Set();
let _id = 0;

export const toast = {
  success: (msg) => listeners.forEach((fn) => fn({ type: 'success', msg, id: ++_id })),
  error:   (msg) => listeners.forEach((fn) => fn({ type: 'error',   msg, id: ++_id })),
  info:    (msg) => listeners.forEach((fn) => fn({ type: 'info',    msg, id: ++_id })),
};

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#25ab21" fillOpacity="0.2"/>
      <path d="M5 9l3 3 5-5" stroke="#25ab21" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#f50031" fillOpacity="0.2"/>
      <path d="M6 6l6 6M12 6l-6 6" stroke="#f50031" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="9" fill="#6789F4" fillOpacity="0.2"/>
      <path d="M9 8v5M9 6v.01" stroke="#6789F4" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px',
            borderRadius: 24,
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            minWidth: 280,
            maxWidth: 420,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          {ICONS[t.type]}
          <span style={{ flex: 1 }}>{t.msg}</span>
          <span style={{ opacity: 0.5, fontSize: 16, lineHeight: 1 }}>×</span>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
