function fmt(v) {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const LEVELS = [
  { key: 'mrp', label: 'MRP', sublabel: 'Consumer Billing Price', color: 'bg-blue-500', textColor: 'text-blue-700' },
  { key: 'ptr', label: 'PTR', sublabel: 'Retailer Billing Price', color: 'bg-emerald-500', textColor: 'text-emerald-700', deductKey: 'rm_amount', deductLabel: 'Retailer Margin' },
  { key: 'ptd', label: 'PTD', sublabel: 'Distributor Billing Price', color: 'bg-amber-500', textColor: 'text-amber-700', deductKey: 'dm_amount', deductLabel: 'Distributor Margin' },
  { key: 'ss_price', label: 'SS Price', sublabel: 'SS Billing Price', color: 'bg-purple-500', textColor: 'text-purple-700', deductKey: 'anchor_amount', deductLabel: 'SS / Anchor Margin' },
];

export default function WaterfallChart({ waterfall }) {
  if (!waterfall) return null;

  const maxVal = waterfall.mrp || 1;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-6">
        Price Waterfall
      </h3>
      <div className="space-y-0">
        {LEVELS.map((level, i) => {
          const val = waterfall[level.key];
          const pct = (val / maxVal) * 100;
          const prevKey = i > 0 ? LEVELS[i - 1].key : null;
          const prevVal = prevKey ? waterfall[prevKey] : null;
          const prevPct = prevVal != null ? (prevVal / maxVal) * 100 : null;
          const deduct = level.deductKey ? waterfall[level.deductKey] : null;
          const deductPct = deduct != null ? (deduct / maxVal) * 100 : null;

          return (
            <div key={level.key}>
              {/* Deduction connector row between previous bar and this bar */}
              {deduct != null && deductPct > 0 && (
                <div className="flex items-center gap-3 h-8">
                  <div className="w-28 shrink-0" />
                  <div className="flex-1 relative h-full">
                    {/* The deduction block: positioned from current bar end to previous bar end */}
                    <div
                      className="absolute top-0 h-full bg-red-100 border-l-2 border-r-2 border-dashed border-red-300"
                      style={{
                        left: `${pct}%`,
                        width: `${deductPct}%`,
                        minWidth: '2px',
                      }}
                    />
                    {/* Vertical connector line on the left edge */}
                    <div
                      className="absolute top-0 w-px h-full bg-gray-300"
                      style={{ left: `${pct}%` }}
                    />
                  </div>
                  <div className="w-44 shrink-0 text-right">
                    <span className="text-xs text-red-600 font-medium">
                      − Rs {fmt(deduct)} {level.deductLabel}
                    </span>
                  </div>
                </div>
              )}

              {/* Price bar row */}
              <div className="flex items-center gap-3 h-12">
                <div className="w-28 shrink-0 text-right pr-2">
                  <div className="text-sm font-bold text-gray-900 leading-tight">{level.label}</div>
                  <div className="text-[10px] text-gray-400 leading-tight">{level.sublabel}</div>
                </div>
                <div className="flex-1 relative">
                  <div
                    className={`h-10 ${level.color} rounded-sm transition-all duration-500 flex items-center`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  >
                    {pct > 15 && (
                      <span className="text-white text-xs font-bold pl-3 whitespace-nowrap">
                        Rs {fmt(val)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-44 shrink-0 text-right">
                  <span className={`text-sm font-bold ${level.textColor}`}>
                    Rs {fmt(val)}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Margin summary strip */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex gap-6 justify-center text-xs">
          {LEVELS.slice(1).map((level) => {
            const deduct = waterfall[level.deductKey];
            const deductPctOfMrp = ((deduct / maxVal) * 100).toFixed(1);
            return (
              <div key={level.key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${level.color}`} />
                <span className="text-gray-500">{level.deductLabel}:</span>
                <span className="font-semibold text-gray-800">Rs {fmt(deduct)}</span>
                <span className="text-gray-400">({deductPctOfMrp}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
