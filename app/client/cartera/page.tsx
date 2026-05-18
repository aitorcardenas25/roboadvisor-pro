'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { ClientPortfolio, ClientHolding, PortfolioMetrics } from '@/lib/clientPortfolios';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return `${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

function computeMetrics(p: ClientPortfolio): PortfolioMetrics {
  const totalInvested = p.holdings.reduce((s, h) => s + h.avgEntryPrice * h.quantity, 0);
  const currentValue  = p.holdings.reduce((s, h) => s + h.currentPrice  * h.quantity, 0);
  const pnlEur = currentValue - totalInvested;
  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue:  Math.round(currentValue  * 100) / 100,
    pnlEur:        Math.round(pnlEur * 100) / 100,
    pnlPct:        totalInvested > 0 ? Math.round((pnlEur / totalInvested) * 10000) / 100 : 0,
    holdingCount:  p.holdings.length,
  };
}

const ASSET_COLORS = [
  '#c9a84c', '#60a5fa', '#34d399', '#f97316', '#a78bfa',
  '#f472b6', '#38bdf8', '#fb923c', '#4ade80', '#e879f9',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color = positive === undefined ? '#c9a84c' : positive ? '#10b981' : '#ef4444';
  return (
    <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
      <div className="font-bold text-xl" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color }}>{sub}</div>}
      <div className="text-white/40 text-xs mt-1.5">{label}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientCarteraPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'holdings' | 'notes'>('overview');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/client/portfolio')
        .then(r => r.json())
        .then(d => { setPortfolio(d.portfolio ?? null); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const userName = session?.user?.name ?? 'Client';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d]">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0d1f1a]/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#c9a84c]" />
            </div>
            <span className="text-white font-black text-sm">FACTOR</span>
            <span className="text-[#c9a84c] text-sm">OTC</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm hidden sm:block">{userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-white/30 hover:text-white transition-colors text-xs">
              Sortir
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">La meva cartera</h1>
          <p className="text-white/40 text-sm mt-1">Seguiment de les teves posicions d&apos;inversió · Sols lectura</p>
        </div>

        {!portfolio ? (
          <EmptyState />
        ) : (
          <PortfolioView portfolio={portfolio} activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        {/* Legal */}
        <div className="mt-10 p-4 bg-[#0d1f1a] border border-white/10 rounded-xl">
          <p className="text-white/25 text-xs leading-relaxed">
            <strong className="text-white/35">Avís legal:</strong> La informació d&apos;aquesta pàgina té caràcter
            informatiu i no constitueix assessorament financer personalitzat. Els rendiments mostrats no garanteixen
            resultats futurs. Factor OTC no és una entitat financera autoritzada per la CNMV.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 border border-[#c9a84c]/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-[#c9a84c]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h2 className="text-white font-semibold text-lg mb-2">La teva cartera no és activa encara</h2>
      <p className="text-white/40 text-sm max-w-sm mx-auto leading-relaxed">
        L&apos;assessor de Factor OTC ha de configurar la teva cartera personalitzada.
        Posa&apos;t en contacte per iniciar el procés.
      </p>
    </div>
  );
}

// ─── PortfolioView ────────────────────────────────────────────────────────────

function PortfolioView({
  portfolio,
  activeTab,
  onTabChange,
}: {
  portfolio: ClientPortfolio;
  activeTab: 'overview' | 'holdings' | 'notes';
  onTabChange: (t: 'overview' | 'holdings' | 'notes') => void;
}) {
  const m = computeMetrics(portfolio);

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard label="Capital invertit"       value={fEur(m.totalInvested)} />
        <KpiCard label="Valor actual"            value={fEur(m.currentValue)} />
        <KpiCard label="Guany / Pèrdua"          value={fEur(m.pnlEur)}   sub={fPct(m.pnlPct)} positive={m.pnlEur >= 0} />
        <KpiCard label="Posicions obertes"       value={String(m.holdingCount)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
        {([
          { id: 'overview', label: 'Visió general' },
          { id: 'holdings', label: 'Posicions'     },
          { id: 'notes',    label: 'Notes assessor' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#c9a84c] text-[#0d1f1a]'
                : 'text-white/50 hover:text-white'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview'  && <OverviewTab  portfolio={portfolio} metrics={m} />}
      {activeTab === 'holdings'  && <HoldingsTab  portfolio={portfolio} />}
      {activeTab === 'notes'     && <NotesTab     portfolio={portfolio} />}
    </>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ portfolio, metrics }: { portfolio: ClientPortfolio; metrics: PortfolioMetrics }) {
  const pieData = portfolio.holdings.map((h, i) => ({
    name:  h.assetName.length > 22 ? h.assetName.slice(0, 22) + '…' : h.assetName,
    value: Math.round(h.currentPrice * h.quantity * 100) / 100,
    color: ASSET_COLORS[i % ASSET_COLORS.length],
  }));

  // Category breakdown
  const catMap: Record<string, number> = {};
  for (const h of portfolio.holdings) {
    const cat = h.assetCategory || 'Altres';
    catMap[cat] = (catMap[cat] ?? 0) + h.currentPrice * h.quantity;
  }
  const catData = Object.entries(catMap).map(([name, value], i) => ({
    name, value: Math.round(value * 100) / 100,
    color: ASSET_COLORS[(i + 2) % ASSET_COLORS.length],
  }));

  // Simulated evolution line (from avgEntryPrice to currentPrice over portfolio.updatedAt period)
  const months = 12;
  const startVal = metrics.totalInvested;
  const endVal   = metrics.currentValue;
  const step     = (endVal - startVal) / (months - 1);
  const now      = new Date();
  const chartData = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const label = d.toLocaleDateString('ca-ES', { month: 'short', year: '2-digit' });
    return { month: label, value: Math.round((startVal + step * i) * 100) / 100 };
  });

  return (
    <div className="space-y-6">
      {/* Description */}
      {portfolio.description && (
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
          <h3 className="text-white/50 text-xs uppercase tracking-wide mb-2">{portfolio.name}</h3>
          <p className="text-white/70 text-sm leading-relaxed">{portfolio.description}</p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Allocation pie */}
        {pieData.length > 0 && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wide mb-4">Distribució per actiu</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                </Pie>
                <ReTooltip
                  contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                  formatter={(v: number) => [fEur(v), '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {pieData.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="text-white/60">{e.name}</span>
                  </div>
                  <span className="text-white/70 font-medium">{fEur(e.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {catData.length > 0 && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wide mb-4">Distribució per categoria</h3>
            <div className="space-y-3">
              {catData.map((c, i) => {
                const pct = metrics.currentValue > 0 ? (c.value / metrics.currentValue) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/70">{c.name}</span>
                      <span className="text-white/50">{fEur(c.value)} · {pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Simulated evolution chart */}
      <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white/50 text-xs uppercase tracking-wide">Evolució estimada (12 mesos)</h3>
          <span className="text-amber-400/60 text-xs">Simulació lineal · No és rendiment real</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cgr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <ReTooltip
              contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              itemStyle={{ color: '#c9a84c', fontSize: 12 }}
              formatter={(v: number) => [fEur(v), 'Valor estimat']}
            />
            <Area type="monotone" dataKey="value" stroke="#c9a84c" strokeWidth={1.5} fill="url(#cgr)" dot={false} activeDot={{ r: 3, fill: '#c9a84c' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendations */}
      {portfolio.recommendations && (
        <div className="bg-[#0d1f1a] border-l-4 border-l-[#c9a84c] border border-white/10 rounded-xl p-5">
          <h3 className="text-[#c9a84c] font-semibold text-sm mb-3">Recomanacions del teu assessor</h3>
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{portfolio.recommendations}</p>
        </div>
      )}
    </div>
  );
}

// ─── Holdings tab ─────────────────────────────────────────────────────────────

function HoldingsTab({ portfolio }: { portfolio: ClientPortfolio }) {
  const total = portfolio.holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);

  if (portfolio.holdings.length === 0) {
    return <div className="text-center py-16 text-white/30">Sense posicions obertes.</div>;
  }

  return (
    <div className="space-y-3">
      {portfolio.holdings.map((h: ClientHolding, i: number) => {
        const invested = h.avgEntryPrice * h.quantity;
        const current  = h.currentPrice  * h.quantity;
        const pnl      = current - invested;
        const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;
        const weight   = total > 0 ? (current / total) * 100 : 0;

        return (
          <div key={h.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                <div>
                  <div className="text-white font-semibold text-sm">{h.assetName}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/30 text-xs font-mono">{h.assetIsin}</span>
                    <span className="text-white/20 text-xs bg-white/5 px-1.5 py-0.5 rounded">{h.assetCategory}</span>
                    <span className="text-white/20 text-xs">{h.broker}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`font-bold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fEur(pnl)}</div>
                <div className={`text-xs ${pnl >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>{fPct(pnlPct)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div><div className="text-white/30 mb-0.5">Quantitat</div><div className="text-white/80">{h.quantity}</div></div>
              <div><div className="text-white/30 mb-0.5">Preu entrada</div><div className="text-white/80">{fEur(h.avgEntryPrice)}</div></div>
              <div><div className="text-white/30 mb-0.5">Preu actual</div>
                <div className="text-white/80">{fEur(h.currentPrice)}
                  <span className="text-white/20 ml-1">{h.priceLastUpdated}</span>
                </div>
              </div>
              <div><div className="text-white/30 mb-0.5">Valor actual</div><div className="text-white font-medium">{fEur(current)}</div></div>
              <div><div className="text-white/30 mb-0.5">Pes cartera</div>
                <div className="text-white/80">{weight.toFixed(1)}%
                  <div className="mt-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${weight}%`, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                  </div>
                </div>
              </div>
            </div>

            {h.notes && <p className="mt-3 text-white/40 text-xs italic leading-relaxed">{h.notes}</p>}
          </div>
        );
      })}

      {/* Summary row */}
      <div className="bg-white/3 border border-white/10 rounded-xl px-5 py-3 flex items-center justify-between">
        <span className="text-white/40 text-sm">Total cartera</span>
        <span className="text-white font-bold">{fEur(total)}</span>
      </div>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ portfolio }: { portfolio: ClientPortfolio }) {
  const notes = [...portfolio.advisorNotes].reverse();
  if (notes.length === 0) {
    return <div className="text-center py-16 text-white/30">L&apos;assessor no ha afegit notes encara.</div>;
  }
  return (
    <div className="space-y-4">
      {notes.map(n => (
        <div key={n.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#c9a84c] text-xs font-medium">{n.author}</span>
            <span className="text-white/20 text-xs">·</span>
            <span className="text-white/30 text-xs">{n.date}</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{n.text}</p>
        </div>
      ))}
    </div>
  );
}
