import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import ArticleList from './pages/ArticleList';
import PricingEditor from './pages/PricingEditor';
import SchemeList from './pages/SchemeList';
import SchemeEditor from './pages/SchemeEditor';
import { ToastContainer } from './components/Toast';

/* ─── Lucide-style SVG icon (for Pricing sub-items only) ──── */
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

/* ─── DMS sidebar nav items with exact icon files ────────── */
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

/* ─── Exact DMS colours ──────────────────────────────────── */
const INACTIVE_TEXT  = 'rgba(0,0,0,0.65)';   /* primary-grey-80 */
const ACTIVE_TEXT    = '#3535f3';              /* primary-50 */
const ACTIVE_BG      = '#E7EBF8';             /* DMS SingleLevel active bg */
const ACTIVE_BORDER  = '#0F3CC9';             /* 4px solid #0F3CC9 — exact DMS */
const HOVER_BG       = '#f5f5f5';

/* ─── Exact DMS body-s text style ───────────────────────── */
const TEXT_STYLE = {
  fontSize: 16,           /* 1rem */
  fontWeight: 500,
  letterSpacing: '-0.005em',
  lineHeight: 1.25,
};

/* ─── Decorative (non-functional) sidebar item ────────────── */
/*  Replicates DMS SingleLevel: padding 14px 0, icon in 56px container */
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
      {/* ListItemIcon equivalent — minWidth 56px */}
      <div style={{ minWidth: 56, display: 'flex', alignItems: 'center' }}>
        <img src={src} alt="" style={{ display: 'block', ...imgStyle }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

/* ─── Pricing sub-nav item (real NavLink) ────────────────── */
function PricingSubItem({ to, end, icon, label }) {
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
      {/* Indented icon container — same 56px + extra indent */}
      <div style={{ minWidth: 56, display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
        <LuIcon path={P[icon]} size={16} color="currentColor" />
      </div>
      <span>{label}</span>
    </NavLink>
  );
}

/* ─── App ──────────────────────────────────────────────────── */
export default function App() {
  const loc = useLocation();
  const isPricingSection =
    loc.pathname === '/' ||
    loc.pathname.startsWith('/articles') ||
    loc.pathname.startsWith('/schemes');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ══ TOP BAR — exact DMS header.js + style.scss ═════════ */}
      <header style={{
        height: 72,
        flexShrink: 0,
        zIndex: 200,
        backgroundColor: '#0F3CC9',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 48px',
      }}>
        {/* .content — left side */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 15,
        }}>
          {/* logo — matches DMS .logo class */}
          <img
            src="/dms-logo.png"
            alt="logo"
            style={{ width: 40, cursor: 'pointer' }}
          />
          {/* "Reliance Retail" — body-l: fontWeight 900, fontSize 16px */}
          <span style={{
            color: '#fff',
            fontSize: 16,
            fontWeight: 900,
            lineHeight: '20px',
          }}>
            Reliance Retail
          </span>
        </div>

        {/* Right side — Avatar in white circle */}
        <img
          src="/dms-avatar.svg"
          alt="user"
          style={{
            cursor: 'pointer',
            background: '#fff',
            padding: 4,
            borderRadius: '50%',
            width: 32,
            height: 32,
            flexShrink: 0,
          }}
        />
      </header>

      {/* ══ BODY ═══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR — DRAWERWIDTH = 300px ──────────────────── */}
        <aside style={{
          width: 300,
          flexShrink: 0,
          background: '#fff',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {/* .MenuWrapper { margin-top: 30px } */}
          <nav style={{ marginTop: 30 }}>
            {DMS_NAV.map((item) => (
              <DmsItem key={item.label} label={item.label} src={item.src} imgStyle={item.imgStyle} />
            ))}
          </nav>

          {/* Divider — .divider_style */}
          <div style={{
            height: 1,
            background: '#e0e0e0',
            borderRadius: 80,
            margin: '15px 0',
          }} />

          {/* ── Pricing section (MultiLevel equivalent) ──────── */}
          <div>
            {/* Parent row — MultiLevel ListItem */}
            <div
              style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 0',
                borderLeft: isPricingSection
                  ? `4px solid ${ACTIVE_BORDER}`
                  : '4px solid transparent',
                background: isPricingSection ? ACTIVE_BG : 'transparent',
                color: isPricingSection ? ACTIVE_TEXT : INACTIVE_TEXT,
                cursor: 'default',
                userSelect: 'none',
                ...TEXT_STYLE,
                fontWeight: 700,
              }}
            >
              {/* Icon container */}
              <div style={{ minWidth: 56, display: 'flex', alignItems: 'center' }}>
                <img
                  src="/icon-cash.svg"
                  alt=""
                  style={{ width: 20, marginLeft: 15 }}
                />
              </div>
              <span style={{ flex: 1 }}>Pricing</span>
              {/* Chevron */}
              <span style={{ marginRight: 16, opacity: 0.6 }}>
                <LuIcon
                  path={isPricingSection ? P.chevUp : P.chevDown}
                  size={16}
                  color="currentColor"
                />
              </span>
            </div>

            {/* Sub-items — Collapse > List > SingleLevel */}
            <PricingSubItem to="/"        end   icon="articles" label="Articles & Pricing" />
            <PricingSubItem to="/schemes"       icon="schemes"  label="Schemes & Offers" />
          </div>

          <div style={{ flex: 1 }} />
        </aside>

        {/* ── CONTENT ────────────────────────────────────────── */}
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
          </Routes>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
