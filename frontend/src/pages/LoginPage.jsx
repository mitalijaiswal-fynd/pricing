import { useState, useEffect } from 'react';
import { getUsers, loginUser } from '../api';
import { useAuth } from '../AuthContext';

const ROLE_META = {
  data_entry:   { label: 'Data Entry',   color: '#2563eb', bg: '#eff6ff', icon: 'edit_note',     desc: 'Create and submit pricing / schemes for review' },
  coordinator:  { label: 'Coordinator',   color: '#7c3aed', bg: '#f5f3ff', icon: 'fact_check',    desc: 'Review and approve submissions from data entry' },
  finance:      { label: 'Finance',       color: '#059669', bg: '#ecfdf5', icon: 'account_balance', desc: 'Final approval to make pricing / schemes live' },
};

export default function LoginPage() {
  const { login } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getUsers().then(setUsers); }, []);

  const grouped = {};
  users.forEach(u => {
    if (!grouped[u.role]) grouped[u.role] = [];
    grouped[u.role].push(u);
  });

  const handleLogin = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await loginUser(selected);
      login(data);
    } catch {
      alert('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ width: 520, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#60a5fa', marginBottom: 8, display: 'block' }}>
            verified_user
          </span>
          <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>Pricing Management</h1>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Select a user to sign in</p>
        </div>

        <div style={{ background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 28 }}>
          {['data_entry', 'coordinator', 'finance'].map(role => {
            const meta = ROLE_META[role];
            const roleUsers = grouped[role] || [];
            return (
              <div key={role} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: meta.color }}>{meta.icon}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</span>
                  <span style={{ color: '#64748b', fontSize: 12, marginLeft: 'auto' }}>{meta.desc}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {roleUsers.map(u => {
                    const active = selected === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelected(u.id)}
                        style={{
                          flex: 1,
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: active ? `2px solid ${meta.color}` : '2px solid #334155',
                          background: active ? meta.bg + '18' : '#0f172a',
                          color: active ? '#f1f5f9' : '#94a3b8',
                          cursor: 'pointer',
                          fontSize: 13, fontWeight: 500,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? meta.color : '#64748b' }}>person</span>
                        {u.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button
            onClick={handleLogin}
            disabled={!selected || loading}
            style={{
              width: '100%', padding: '12px 0',
              borderRadius: 8, border: 'none',
              background: selected ? '#2563eb' : '#334155',
              color: selected ? '#fff' : '#64748b',
              fontSize: 14, fontWeight: 600,
              cursor: selected ? 'pointer' : 'not-allowed',
              marginTop: 8,
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#1e293b', border: '1px solid #334155', borderRadius: 20,
            padding: '6px 14px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#f59e0b' }}>info</span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              Approval flow: Data Entry
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', margin: '0 2px', color: '#64748b' }}>arrow_forward</span>
              Coordinator
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', margin: '0 2px', color: '#64748b' }}>arrow_forward</span>
              Finance
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
