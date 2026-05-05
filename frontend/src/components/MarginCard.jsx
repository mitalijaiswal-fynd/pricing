/* ── MarginCard — DMS primary-blue colour scheme throughout ── */

const TYPE_OPTIONS = [
  { value: 'PERCENT',  label: '%'     },
  { value: 'ABSOLUTE', label: '₹ Abs' },
];

const BASE_OPTIONS = [
  { value: 'MRP',         label: 'On MRP'   },
  { value: 'TRADE_PRICE', label: 'On Trade' },
];

/* Active toggle uses DMS --c-primary (#3535f3) for all cards */
const ACTIVE_BG   = 'var(--c-primary)';
const ACTIVE_TEXT = '#fff';
const IDLE_BG     = '#fff';
const IDLE_TEXT   = 'var(--c-text-sub)';

export default function MarginCard({
  title,
  type,
  base,
  value,
  showBase = false,
  onChange,
}) {
  return (
    <div className="dms-card" style={{
      padding: '18px 18px 16px',
      display: 'flex', flexDirection: 'column',
      /* Cards always fill the grid row height so all three stay aligned */
    }}>

      {/* Header — section label style */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 16, paddingBottom: 14,
        borderBottom: '1px solid var(--c-grey-40)',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--c-primary)', flexShrink: 0,
        }} />
        <div style={{
          fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--c-text-sub)',
        }}>
          {title}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>

        {/* ── Type toggle ── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--c-grey-60)',
            marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Type
          </div>
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--c-grey-40)',
          }}>
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ type: opt.value })}
                  style={{
                    flex: 1, padding: '9px 6px',
                    border: 'none',
                    background: active ? ACTIVE_BG : IDLE_BG,
                    color: active ? ACTIVE_TEXT : IDLE_TEXT,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/*
          ── Base toggle ──
          Always rendered so all three cards stay the same height.
          Hidden (visibility: hidden) when showBase=false or type=ABSOLUTE.
        */}
        <div style={{ visibility: showBase && type === 'PERCENT' ? 'visible' : 'hidden' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--c-grey-60)',
            marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Base
          </div>
          <div style={{
            display: 'flex', borderRadius: 8, overflow: 'hidden',
            border: '1px solid var(--c-grey-40)',
          }}>
            {BASE_OPTIONS.map((opt) => {
              const active = base === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ base: opt.value })}
                  style={{
                    flex: 1, padding: '9px 6px',
                    border: 'none',
                    background: active ? ACTIVE_BG : IDLE_BG,
                    color: active ? ACTIVE_TEXT : IDLE_TEXT,
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Value input ── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--c-grey-60)',
            marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Value ({type === 'PERCENT' ? '%' : '₹'})
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => onChange({ value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
              className="dms-input"
              style={{ paddingRight: 32 }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 12, fontWeight: 700,
              color: 'var(--c-primary)', pointerEvents: 'none',
            }}>
              {type === 'PERCENT' ? '%' : '₹'}
            </span>
          </div>
        </div>

        {/* ── Margin indicator chip ── */}
        <div style={{ minHeight: 26 }}>
          {value > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '4px 10px', borderRadius: 100,
              background: 'var(--c-primary-light)',
              color: 'var(--c-primary)',
              fontSize: 11, fontWeight: 700,
            }}>
              {value}{type === 'PERCENT' ? '%' : '₹'} margin
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
