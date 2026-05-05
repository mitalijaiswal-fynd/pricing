import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import ArticleList from './pages/ArticleList';
import PricingEditor from './pages/PricingEditor';
import SchemeList from './pages/SchemeList';
import SchemeEditor from './pages/SchemeEditor';
import ApprovalQueue from './pages/ApprovalQueue';
import LoginPage from './pages/LoginPage';
import { ToastContainer } from './components/Toast';
import { AuthProvider, useAuth } from './AuthContext';

function LuIcon({ path, size = 18, color = 'currentColor' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {Array.isArray(path)
        ? path.map((d, i) => <path key={i} d={d} />)
        : <path d={path} />}
    </svg>
  );
}

const P = {
  articles: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  schemes:  ['M20 12v10H4V12', 'M22 7H2v5h20V7z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z'],
  chevUp:   ['M18 15l-6-6-6 6'],
  chevDown: ['M6 9l6 6 6-6'],
};

const DMS_NAV = [
  { label: 'Data Upload',                    src: '/icon-upload.svg',    imgStyle: { width: 15, marginLeft: 15 } },
  { label: 'Data Download',                  src: '/icon-download.svg',  imgStyle: { width: 15, marginLeft: 15 } },
  { label: 'Primary Indent Management',      src: '/icon-indent.svg',    imgStyle: { width: 15, marginLeft: 15 } },
  { label: 'Cohort Configuration',           src: '/icon-indent.svg',    imgStyle: { width: 15, marginLeft: 15 } },
  { label: 'Vehicle Indentation',            src: '/icon-indent.svg',    imgStyle: { width: 15, marginLeft: 15 } },
  { label: 'Beat Manager',                   src: '/icon-beat.svg',      imgStyle: { width: 20, marginLeft: 15 } },
  { label: 'Ready Stock Configuration',      src: '/icon-truck.svg',     imgStyle: { width: 20, marginLeft: 15 } },
  { label: 'MOP Configuration',             src: '/icon-mop.svg',       imgStyle: { width: 20, marginLeft: 15 } },
  { label: 'DB Cash Discount Configuration', src: '/icon-cash.svg',      imgStyle: { width: 20, marginLeft: 15 } },
  { label: 'Secondary GSTIN Configuration',  src: '/icon-gstin.svg',     imgStyle: { width: 20, marginLeft: 15 } },
  { label: 'Asset Dashboard',               src: '/icon-dashboard.svg', imgStyle: { marginLeft: 10 } },
  { label: 'Return Request',                src: '/icon-return.svg',    imgStyle: { marginLeft: 10 } },
];

const INACTIVE_TEXT  = 'rgba(0,0,0,0.65)';
const ACTIVE_TEXT    = '#3535f3';
const ACTIVE_BG      = '#E7EBF8';
const ACTIVE_BORDER  = '#0F3CC9';
const HOVER_BG       = '#f5f5f5';

const TEXT_STYLE = {
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: '-0.005em',
  lineHeight: 1.25,
};

const ROLE_COLORS = {
  data_entry:  { color: '#2563eb', bg: '#eff6ff', label: 'Data Entry',  icon: 'edit_note' },
  coordinator: { color: '#7c3aed', bg: '#f5f3ff', label: 'Coordinator', icon: 'fact_check' },
  finance:     { color: '#059669', bg: '#ecfdf5', label: 'Finance',     icon: 'account_balance' },
};

function DmsItem({ label, src, imgStyle }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 0',
        borderLeft: '4px solid transparent',
        color: INACTIVE_TEXT,
        cursor: 'default',
        userSelect: 'none',
        transition: 'background 0.12s',
        ...TEXT_STYLE,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = HOVER_BG; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ minWidth: 56, display: 'flex', alignItems: 'center' }}>
        <img src={src} alt="" style={{ display: 'block', ...imgStyle }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

function PricingSubItem({ to, end, icon, label, matIcon }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center',
        padding: '14px 0',
        paddingLeft: 0,
        borderLeft: isActive ? `4px solid ${ACTIVE_BORDER}` : '4px solid transparent',
        background: isActive ? ACTIVE_BG : 'transparent',
        color: isActive ? ACTIVE_TEXT : INACTIVE_TEXT,
        textDecoration: 'none',
        transition: 'background 0.12s',
        ...TEXT_STYLE,
        fontWeight: isActive ? 600 : 500,
      })}
      onMouseEnter={(e) => {
        if (!e.currentTarget.getAttribute('data-active')) {
          e.currentTarget.style.background = HOVER_BG;
        }
      }}
      onMouseLeave={(e) => {
        if (!e.currentTarget.getAttribute('data-active')) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <div style={{ minWidth: 56, display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
        {matIcon
          ? <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{matIcon}</span>
          : <LuIcon path={P[icon]} size={16} color="currentColor" />}
      </div>
      <span>{label}</span>
    </NavLink>
  );
}

function AppShell() {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const isPricingSection =
    loc.pathname === '/' ||
    loc.pathname.startsWith('/articles') ||
    loc.pathname.startsWith('/schemes') ||
    loc.pathname.startsWith('/approvals');

  const roleMeta = user ? ROLE_COLORS[user.role] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <header style={{
        height: 72, flexShrink: 0, zIndex: 200,
        backgroundColor: '#0F3CC9',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '0 48px',
      }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 15 }}>
          <img src="/dms-logo.png" alt="logo" style={{ width: 40, cursor: 'pointer' }} />
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, lineHeight: '20px' }}>
            Reliance Retail
          </span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.12)', borderRadius: 20,
              padding: '4px 12px 4px 8px',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#93c5fd' }}>{roleMeta?.icon}</span>
              <span style={{ color: '#e0e7ff', fontSize: 12, fontWeight: 600 }}>{user.display_name}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                background: roleMeta?.color, borderRadius: 8,
                padding: '1px 6px', marginLeft: 4,
              }}>
                {roleMeta?.label}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                borderRadius: '50%', padding: 6, cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#93c5fd' }}>logout</span>
            </button>
          </div>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <aside style={{
          width: 300, flexShrink: 0,
          background: '#fff', borderRight: '1px solid #e0e0e0',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', overflowX: 'hidden',
        }}>
          <nav style={{ marginTop: 30 }}>
            {DMS_NAV.map((item) => (
              <DmsItem key={item.label} label={item.label} src={item.src} imgStyle={item.imgStyle} />
            ))}
          </nav>

          <div style={{ height: 1, background: '#e0e0e0', borderRadius: 80, margin: '15px 0' }} />

          <div>
            <div
              style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 0',
                borderLeft: isPricingSection ? `4px solid ${ACTIVE_BORDER}` : '4px solid transparent',
                background: isPricingSection ? ACTIVE_BG : 'transparent',
                color: isPricingSection ? ACTIVE_TEXT : INACTIVE_TEXT,
                cursor: 'default', userSelect: 'none',
                ...TEXT_STYLE, fontWeight: 700,
              }}
            >
              <div style={{ minWidth: 56, display: 'flex', alignItems: 'center' }}>
                <img src="/icon-cash.svg" alt="" style={{ width: 20, marginLeft: 15 }} />
              </div>
              <span style={{ flex: 1 }}>Pricing</span>
              <span style={{ marginRight: 16, opacity: 0.6 }}>
                <LuIcon path={isPricingSection ? P.chevUp : P.chevDown} size={16} color="currentColor" />
              </span>
            </div>

            <PricingSubItem to="/" end icon="articles" label="Articles & Pricing" />
            <PricingSubItem to="/schemes" icon="schemes" label="Schemes & Offers" />
            <PricingSubItem to="/approvals" matIcon="approval" label="Approval Queue" />
          </div>

          <div style={{ flex: 1 }} />
        </aside>

        <main style={{
          flex: 1, overflowY: 'auto',
          background: 'var(--c-page-bg)',
          padding: '28px 32px 64px',
        }}>
          <Routes>
            <Route path="/"             element={<ArticleList />}  />
            <Route path="/articles/:id" element={<PricingEditor />} />
            <Route path="/schemes"      element={<SchemeList />}   />
            <Route path="/schemes/new"  element={<SchemeEditor />} />
            <Route path="/schemes/:id"  element={<SchemeEditor />} />
            <Route path="/approvals"    element={<ApprovalQueue />} />
          </Routes>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: '#64748b', fontSize: 14,
    }}>
      Loading...
    </div>
  );

  if (!user) return <LoginPage />;
  return <AppShell />;
}
