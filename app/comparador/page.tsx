'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const MAX_FUNDS = 5;
const RISK_LABELS = ['', 'Molt baix', 'Baix', 'Moderat', 'Alt', 'Molt alt'];
const MGMT_LABELS: Record<string, string> = { indexada: 'Indexada', passiva: 'Passiva', activa: 'Activa' };
const SFDR_LABELS: Record<number, string> = { 6: 'Art. 6', 8: 'Art. 8 🌿', 9: 'Art. 9 🌱' };
const FUND_COLORS = ['#c9a84c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

interface FundResult { id: string; name: string; isin: string; manager: string; category: string; risk: number; }
interface FundDetail extends FundResult {
  assetClass: string; region: string; managementType: string; benchmark: string;
  recommendedProfiles: string[]; ter: number; currency: string; dataStatus: string;
  justification: string; historicalReturn5Y: number | null; historicalVolatility: number | null;
  maxDrawdownEstimate: number | null; yieldEstimate: number | null; durationYears: number | null;
  inceptionYear: number | null; aum: number | null; morningstarCategory: string | null;
  morningstarRating: number | null; sfdrArticle: number | null; mifidRiskIndicator: number | null;
  realtimeNote: string | null;
}

export default function ComparadorPage() {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<FundResult[]>([]);
  const [funds, setFunds]       = useState<FundDetail[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeChart, setActiveChart] = useState<'bars' | 'radar'>('bars');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/fons/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults((await res.json()).results);
      setSearching(false);
    }, 300);
  }, [query]);

  const addFund = async (id: string) => {
    if (funds.length >= MAX_FUNDS) return;
    if (funds.some(f => f.id === id)) return;
    const res = await fetch(`/api/fons/${id}`);
    if (res.ok) {
      const { fund } = await res.json();
      setFunds(prev => [...prev, fund]);
    }
    setQuery(''); setResults([]);
  };

  const removeFund = (id: string) => setFunds(prev => prev.filter(f => f.id !== id));

  // Chart data
  const returnData   = funds.map(f => ({ name: truncate(f.name, 18), value: f.historicalReturn5Y }));
  const volData      = funds.map(f => ({ name: truncate(f.name, 18), value: f.historicalVolatility }));
  const drawdownData = funds.map(f => ({ name: truncate(f.name, 18), value: Math.abs(f.maxDrawdownEstimate ?? 0) }));
  const terData      = funds.map(f => ({ name: truncate(f.name, 18), value: f.ter }));

  const radarData = ['Rendibilitat 5Y', 'Volatilitat', 'Drawdown', 'TER (inv.)', 'Risc'].map((dim, i) => {
    const entry: Record<string, string | number> = { dimension: dim };
    funds.forEach((f, fi) => {
      const raw = [f.historicalReturn5Y, f.historicalVolatility,
        Math.abs(f.maxDrawdownEstimate ?? 0), f.ter, (f.risk ?? 3) * 20][i];
      entry[`f${fi}`] = normalizeRadar(raw ?? 0, i);
    });
    return entry;
  });

  return (
    <div className="min-h-screen bg-[#0a0f0d]">

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white font-black text-lg tracking-wider">FACTOR</span>
            <span className="text-[#c9a84c] font-light text-lg tracking-widest">OTC</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/noticies" className="text-white/50 hover:text-white transition-colors">Notícies</Link>
            <Link href="/comparador" className="text-[#c9a84c] font-medium">Comparador</Link>
            <Link href="/admin" className="text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-widest">Admin</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC</p>
          <h1 className="text-white font-black text-4xl mb-3">Comparador de Fons</h1>
          <p className="text-white/50 text-base">Compara fins a {MAX_FUNDS} fons per ISIN, nom o gestora.</p>
        </div>

        {/* Search */}
        <div className="relative mb-8 max-w-xl">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca per ISIN, nom o gestora..."
            disabled={funds.length >= MAX_FUNDS}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-5 py-3.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#c9a84c]/60 disabled:opacity-40"
          />
          {searching && <span className="absolute right-4 top-3.5 text-white/30 text-sm animate-pulse">Cercant...</span>}

          {results.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-[#0d1f1a] border border-white/20 rounded-xl shadow-xl z-10 overflow-hidden">
              {results.map(r => (
                <button key={r.id} onClick={() => addFund(r.id)}
                  disabled={funds.some(f => f.id === r.id) || funds.length >= MAX_FUNDS}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors disabled:opacity-40 text-left border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-medium">{r.name}</p>
                    <p className="text-white/40 text-xs">{r.isin} · {r.manager}</p>
                  </div>
                  <RiskBadge risk={r.risk} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected chips */}
        {funds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {funds.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium"
                style={{ borderColor: FUND_COLORS[i] + '60', color: FUND_COLORS[i], backgroundColor: FUND_COLORS[i] + '15' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: FUND_COLORS[i] }} />
                <span className="max-w-[180px] truncate">{f.name}</span>
                <button onClick={() => removeFund(f.id)} className="text-white/40 hover:text-white ml-1 leading-none">×</button>
              </div>
            ))}
            {funds.length < MAX_FUNDS && (
              <span className="text-white/20 text-xs self-center ml-1">+ afegeix fins a {MAX_FUNDS - funds.length} més</span>
            )}
          </div>
        )}

        {funds.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Comparison table ── */}
            <div className="overflow-x-auto mb-12">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/40 text-xs uppercase tracking-widest py-3 pr-6 w-36">Camp</th>
                    {funds.map((f, i) => (
                      <th key={f.id} className="text-left py-3 px-3 min-w-[180px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: FUND_COLORS[i] }} />
                          <span className="text-white font-semibold text-xs leading-snug">{truncate(f.name, 28)}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROWS.map(row => (
                    <tr key={row.key} className="border-b border-white/5 hover:bg-white/2">
                      <td className="py-2.5 pr-6 text-white/40 text-xs">{row.label}</td>
                      {funds.map(f => (
                        <td key={f.id} className="py-2.5 px-3 text-white text-xs">
                          {row.render(f)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Charts ── */}
            <div className="mb-6 flex items-center gap-2">
              <h2 className="text-white font-bold text-lg flex-1">Gràfics comparatius</h2>
              <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
                {(['bars', 'radar'] as const).map(t => (
                  <button key={t} onClick={() => setActiveChart(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeChart === t ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'text-white/60 hover:text-white'}`}>
                    {t === 'bars' ? '📊 Barres' : '🕸 Radar'}
                  </button>
                ))}
              </div>
            </div>

            {activeChart === 'bars' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="Rendibilitat anualitzada 5Y (%)" data={returnData} color="#10b981" suffix="%" />
                <ChartCard title="Volatilitat anualitzada (%)" data={volData} color="#ef4444" suffix="%" />
                <ChartCard title="Màxim drawdown estimat (%)" data={drawdownData} color="#f59e0b" suffix="%" />
                <ChartCard title="TER / Comissions anuals (%)" data={terData} color="#8b5cf6" suffix="%" />
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#ffffff15" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                    {funds.map((f, i) => (
                      <Radar key={f.id} name={truncate(f.name, 20)} dataKey={`f${i}`}
                        stroke={FUND_COLORS[i]} fill={FUND_COLORS[i]} fillOpacity={0.12} strokeWidth={2} />
                    ))}
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(0)} / 100`, '']} />
                  </RadarChart>
                </ResponsiveContainer>
                <p className="text-white/20 text-xs text-center mt-2">Puntuació normalitzada 0–100. Rendibilitat i inversió de TER: valors alts = millor. Volatilitat i drawdown: valors alts = pitjor.</p>
              </div>
            )}

            {/* Justification */}
            <div className="mt-10 space-y-3">
              <h2 className="text-white font-bold text-lg">Justificació professional</h2>
              {funds.map((f, i) => (
                <div key={f.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FUND_COLORS[i] }} />
                    <span className="text-white font-medium text-sm">{f.name}</span>
                    {f.realtimeNote && <span className="text-yellow-500/70 text-xs ml-2">⚠ {f.realtimeNote}</span>}
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{f.justification || '—'}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }

function normalizeRadar(value: number, dimIndex: number): number {
  // dim 0: return (higher=better, scale 0-15%), dim 1: vol (lower=better, scale 0-30%)
  // dim 2: drawdown abs (lower=better, scale 0-60%), dim 3: TER inv (lower=better, scale 0-2%)
  // dim 4: risk (0-100 already)
  const scales = [15, 30, 60, 2, 100];
  const inverted = [false, true, true, true, false];
  const pct = Math.min(value / scales[dimIndex], 1) * 100;
  return inverted[dimIndex] ? 100 - pct : pct;
}

function RiskBadge({ risk }: { risk: number }) {
  const colors = ['', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7f1d1d'];
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: colors[risk] + '25', color: colors[risk] }}>
      R{risk}
    </span>
  );
}

function StarRating({ n }: { n: number }) {
  return <span className="text-[#c9a84c]">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function ChartCard({ title, data, color, suffix }: {
  title: string;
  data: { name: string; value: number | null }[];
  color: string;
  suffix: string;
}) {
  const chartData = data.map((d, i) => ({ name: d.name, value: d.value ?? 0, fill: FUND_COLORS[i] }));
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-white/60 text-xs uppercase tracking-widest mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickFormatter={v => `${v}${suffix}`} />
          <Tooltip
            contentStyle={{ background: '#0d1f1a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [`${v.toFixed(2)}${suffix}`, '']}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <rect key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 border border-white/10 rounded-2xl bg-white/3">
      <p className="text-5xl mb-4">🔍</p>
      <p className="text-white font-semibold text-lg mb-2">Cerca fons per comparar</p>
      <p className="text-white/40 text-sm">Introdueix un ISIN, nom o gestora al cercador de dalt.</p>
      <p className="text-white/20 text-xs mt-4">Exemples: LU0996182563 · Amundi · Vanguard · iShares</p>
    </div>
  );
}

// ── Table row definitions ─────────────────────────────────────────────────────

const TABLE_ROWS: { key: string; label: string; render: (f: FundDetail) => React.ReactNode }[] = [
  { key: 'isin',      label: 'ISIN',          render: f => <span className="font-mono text-[#c9a84c]">{f.isin}</span> },
  { key: 'manager',   label: 'Gestora',        render: f => f.manager },
  { key: 'category',  label: 'Categoria',      render: f => f.category },
  { key: 'region',    label: 'Regió',          render: f => f.region },
  { key: 'mgmt',      label: 'Gestió',         render: f => MGMT_LABELS[f.managementType] ?? f.managementType },
  { key: 'risk',      label: 'Risc (1-5)',      render: f => <span>{f.risk} — {RISK_LABELS[f.risk]}</span> },
  { key: 'return',    label: 'Rendibilitat 5Y', render: f => f.historicalReturn5Y != null ? <span className={f.historicalReturn5Y >= 0 ? 'text-green-400' : 'text-red-400'}>{f.historicalReturn5Y > 0 ? '+' : ''}{f.historicalReturn5Y.toFixed(2)}%</span> : '—' },
  { key: 'vol',       label: 'Volatilitat',     render: f => f.historicalVolatility != null ? `${f.historicalVolatility.toFixed(2)}%` : '—' },
  { key: 'drawdown',  label: 'Max. Drawdown',   render: f => f.maxDrawdownEstimate != null ? <span className="text-red-400">{f.maxDrawdownEstimate.toFixed(1)}%</span> : '—' },
  { key: 'ter',       label: 'TER anual',        render: f => <span className={f.ter > 1 ? 'text-yellow-400' : 'text-green-400'}>{f.ter.toFixed(2)}%</span> },
  { key: 'currency',  label: 'Divisa',           render: f => f.currency },
  { key: 'benchmark', label: 'Benchmark',        render: f => <span className="text-white/60">{f.benchmark}</span> },
  { key: 'profiles',  label: 'Perfils',          render: f => f.recommendedProfiles.join(', ') },
  { key: 'sfdr',      label: 'SFDR',             render: f => f.sfdrArticle ? SFDR_LABELS[f.sfdrArticle] : '—' },
  { key: 'aum',       label: 'AuM (M€ aprox.)',  render: f => f.aum ? `${f.aum.toLocaleString('ca-ES')} M€` : '—' },
  { key: 'inception', label: 'Any inici',         render: f => f.inceptionYear ?? '—' },
  { key: 'mstar',     label: 'Morningstar',       render: f => f.morningstarRating ? <StarRating n={f.morningstarRating} /> : '—' },
  { key: 'mstarcat',  label: 'Categoria MS',      render: f => <span className="text-white/60">{f.morningstarCategory ?? '—'}</span> },
  { key: 'status',    label: 'Estat dades',       render: f => <DataStatusBadge status={f.dataStatus} /> },
];

function DataStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    validated:   'text-green-400 bg-green-400/10',
    partial:     'text-yellow-400 bg-yellow-400/10',
    pending:     'text-white/40 bg-white/5',
    unavailable: 'text-red-400 bg-red-400/10',
  };
  const labels: Record<string, string> = { validated: 'Validat', partial: 'Parcial', pending: 'Pendent', unavailable: 'No disp.' };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? ''}`}>{labels[status] ?? status}</span>;
}
