'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip as ReTT, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart,
} from 'recharts';
import type { ClientPortfolio, ClientHolding, ClientTransaction, OperationType } from '@/lib/clientPortfolios';
import { computeMetrics } from '@/lib/clientPortfolios';

function fEur(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return `${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

const ASSET_COLORS = ['#c9a84c','#60a5fa','#34d399','#f97316','#a78bfa','#f472b6','#38bdf8','#fb923c','#4ade80','#e879f9'];

const OP_META: Record<OperationType, { label: string; color: string; bg: string }> = {
  buy:        { label: 'Compra',      color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  sell:       { label: 'Venda',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  deposit:    { label: 'Aportació',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  withdrawal: { label: 'Retirada',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  rebalance:  { label: 'Rebalanceig', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

function EmptyState({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.4) 0%, transparent 70%)' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-[#1a3a2a] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#c9a84c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <h1 className="text-white font-bold text-xl mb-3">Hola, {name}</h1>
        <p className="text-white/45 text-sm leading-relaxed mb-6">
          El teu assessor encara no t&apos;ha assignat cap cartera. En breu rebràs accés a la teva àrea personal.
        </p>
        <a href="/login" className="inline-flex items-center gap-2 text-[#c9a84c] text-xs border border-[#c9a84c]/20 px-4 py-2 rounded-lg hover:bg-[#c9a84c]/8 transition-colors">
          ← Tornar a l&apos;inici
        </a>
      </div>
    </div>
  );
}

type Tab = 'overview' | 'holdings' | 'transaccions' | 'notes';

export default function ClientCarteraPage() {
  const { data: session, status } = useSession();
  const router                    = useRouter();
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/client/portfolio')
        .then(r => r.json())
        .then((d: { portfolio: ClientPortfolio | null }) => { setPortfolio(d.portfolio ?? null); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const userName = (session?.user as { name?: string } | undefined)?.name ?? 'Client';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!portfolio) return <EmptyState name={userName} />;

  const isPendingH  = (h: ClientHolding) => h.priceSource === 'pending' || (h.currentPrice === 0 && h.quantity === 0);
  const metrics     = computeMetrics(portfolio);
  const totalValue  = metrics.currentValue;
  const isPositive  = metrics.pnlEur >= 0;

  const pieData = portfolio.holdings
    .map((h, i) => ({ name: h.assetName, value: Math.round(h.currentPrice * h.quantity * 100) / 100, color: ASSET_COLORS[i % ASSET_COLORS.length] }))
    .filter(d => d.value > 0);

  const brokerMap: Record<string, number> = {};
  for (const h of portfolio.holdings) {
    const key = h.broker || 'Sense broker';
    brokerMap[key] = (brokerMap[key] ?? 0) + h.currentPrice * h.quantity;
  }
  const brokerData = Object.entries(brokerMap).sort((a, b) => b[1] - a[1]);

  const snapshotChart = [...portfolio.snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ date: s.date, valor: s.totalValue }));

  const visibleNotes  = portfolio.advisorNotes.filter(n => n.isVisibleToClient);
  const activeHoldings  = portfolio.holdings.filter(h => !isPendingH(h));
  const pendingHoldings = portfolio.holdings.filter(h => isPendingH(h));

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',     label: 'Resum' },
    { id: 'holdings',     label: 'Posicions',  count: activeHoldings.length },
    { id: 'transaccions', label: 'Moviments',  count: portfolio.transactions.length || undefined },
    { id: 'notes',        label: 'Notes',      count: visibleNotes.length || undefined },
  ];

  const tooltipStyle = {
    contentStyle: { background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
    labelStyle:   { color: 'rgba(255,255,255,0.4)', fontSize: 10 },
    itemStyle:    { color: '#c9a84c', fontSize: 12 },
  };

  return (
    <div className="min-h-screen bg-[#0a0f0d]"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.25) 0%, transparent 55%)' }}>

      {/* Top nav bar */}
      <div className="border-b border-white/8 bg-[#0a0f0d]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-[10px] leading-none">F</span>
            </div>
            <span className="text-white/60 font-medium text-sm">Factor OTC</span>
            <span className="text-white/20 text-sm">/</span>
            <span className="text-white/40 text-sm">La meva cartera</span>
          </div>
          <div className="flex items-center gap-3">
            {portfolio.nextFollowup && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#c9a84c]/70 border border-[#c9a84c]/15 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Seguiment: {portfolio.nextFollowup}
              </div>
            )}
            <span className="text-white/30 text-xs">{userName}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Hero valor card */}
        <div className="relative border border-[#1a3a2a]/70 rounded-2xl overflow-hidden mb-8"
          style={{ background: 'linear-gradient(135deg,rgba(26,58,42,0.35) 0%,rgba(8,14,11,0.95) 100%)', boxShadow: '0 0 0 1px rgba(45,106,79,0.08), 0 16px 40px rgba(0,0,0,0.4)' }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_50%,rgba(201,168,76,0.04),transparent)] pointer-events-none" />

          <div className="relative px-6 py-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{portfolio.name}</p>
                <div className="flex items-end gap-4 mb-1">
                  <span className="text-white font-black text-4xl md:text-5xl tabular-nums tracking-tight">
                    {fEur(totalValue)}
                  </span>
                  {metrics.pnlPct !== 0 && (
                    <span className={`text-lg font-bold mb-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fPct(metrics.pnlPct)}
                    </span>
                  )}
                </div>
                {metrics.pnlEur !== 0 && (
                  <p className={`text-sm ${isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                    {isPositive ? '+' : ''}{fEur(metrics.pnlEur)} des de l&apos;entrada
                  </p>
                )}
              </div>

              {/* Mini stats */}
              <div className="flex gap-4 sm:gap-6 sm:text-right flex-wrap">
                <div>
                  <p className="text-white font-semibold text-sm tabular-nums">{fEur(metrics.totalInvested)}</p>
                  <p className="text-white/35 text-xs">Invertit</p>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm tabular-nums">{metrics.holdingCount}</p>
                  <p className="text-white/35 text-xs">Posicions</p>
                </div>
                {pendingHoldings.length > 0 && (
                  <div>
                    <p className="text-amber-400 font-semibold text-sm tabular-nums">{pendingHoldings.length}</p>
                    <p className="text-white/35 text-xs">Pendents</p>
                  </div>
                )}
              </div>
            </div>

            {/* P&L progress bar */}
            {metrics.totalInvested > 0 && (
              <div className="mt-4">
                <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.abs(metrics.pnlPct) * 3, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 mb-6 gap-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
                activeTab === t.id
                  ? 'text-[#c9a84c] border-b-2 border-[#c9a84c] -mb-px'
                  : 'text-white/35 hover:text-white/70'
              }`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === t.id ? 'bg-[#c9a84c]/15 text-[#c9a84c]' : 'bg-white/8 text-white/35'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Snapshot evolution */}
            <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-white font-semibold text-sm">Evolució del valor</h3>
                  <p className="text-white/35 text-xs mt-0.5">Snapshots registrats per l&apos;assessor</p>
                </div>
                {snapshotChart.length >= 2 && (
                  <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fPct(metrics.pnlPct)}
                  </span>
                )}
              </div>
              {snapshotChart.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={snapshotChart} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#c9a84c" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <ReTT formatter={(v: number) => [fEur(v), 'Valor']} {...tooltipStyle} />
                    <Area type="monotone" dataKey="valor" stroke="#c9a84c" strokeWidth={2} fill="url(#valGrad)" dot={{ r: 3, fill: '#c9a84c', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-36 gap-2">
                  <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-white/25 text-sm">Sense dades d&apos;evolució encara</p>
                  <p className="text-white/18 text-xs">El gràfic apareixerà quan l&apos;assessor registri snapshots.</p>
                </div>
              )}
            </div>

            {/* Distribution charts */}
            {totalValue > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-sm mb-5">Distribució per actiu</h3>
                  <div className="flex items-center gap-5">
                    <ResponsiveContainer width={110} height={110}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value">
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <ReTT formatter={(v: number) => [fEur(v), '']} {...tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {pieData.slice(0, 6).map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-white/55 text-xs truncate">{d.name}</span>
                          </div>
                          <span className="text-white/40 text-xs flex-shrink-0">
                            {totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-sm mb-5">Distribució per broker</h3>
                  <div className="space-y-3">
                    {brokerData.map(([broker, val], i) => {
                      const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-white/55 text-xs">{broker}</span>
                            <span className="text-white/40 text-xs">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#c9a84c] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Advisor recommendations */}
            {portfolio.recommendations && (
              <div className="bg-[#0d1f1a] border border-[#c9a84c]/15 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#c9a84c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-[#c9a84c]/80 font-semibold text-sm">Recomanacions de l&apos;assessor</h3>
                </div>
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{portfolio.recommendations}</p>
              </div>
            )}

            {/* Pending holdings notice */}
            {pendingHoldings.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-amber-400 font-semibold text-sm mb-1">{pendingHoldings.length} posicion{pendingHoldings.length > 1 ? 's' : ''} pendent{pendingHoldings.length > 1 ? 's' : ''} de confirmar</p>
                    <p className="text-white/45 text-xs leading-relaxed">
                      El teu assessor ha proposat les següents posicions. Quan confirmes les compres, s&apos;actualitzaran automàticament:
                      {' '}{pendingHoldings.map(h => h.assetName).join(', ')}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HOLDINGS ── */}
        {activeTab === 'holdings' && (
          <div className="space-y-3">
            {activeHoldings.length === 0 && pendingHoldings.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <svg className="w-8 h-8 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <p className="text-sm">Sense posicions assignades.</p>
              </div>
            ) : (
              <>
                {activeHoldings.map((h, i) => {
                  const val    = h.currentPrice * h.quantity;
                  const cost   = h.avgEntryPrice * h.quantity;
                  const pnl    = val - cost;
                  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                  const weight = totalValue > 0 ? (val / totalValue) * 100 : 0;
                  const srcBadge = h.priceSource === 'fmp'    ? { text: 'FMP',    cls: 'text-emerald-400/70 bg-emerald-500/8 border-emerald-500/15' }
                    : h.priceSource === 'manual' ? { text: 'Manual', cls: 'text-amber-400/70 bg-amber-500/8 border-amber-500/15' }
                    : { text: 'Pendent', cls: 'text-white/30 bg-white/5 border-white/10' };
                  return (
                    <div key={h.id} className="bg-[#0d1f1a] border border-white/8 rounded-xl p-5 hover:border-white/12 transition-colors">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: `${ASSET_COLORS[i % ASSET_COLORS.length]}18`, border: `1px solid ${ASSET_COLORS[i % ASSET_COLORS.length]}25` }}>
                            <span className="font-black text-[10px]" style={{ color: ASSET_COLORS[i % ASSET_COLORS.length] }}>
                              {(h.assetSymbol || h.assetName).slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-white font-semibold text-sm">{h.assetName}</span>
                              {h.assetSymbol && <span className="text-white/30 text-xs">({h.assetSymbol})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white/35 text-xs">{h.assetCategory}</span>
                              {h.broker && <><span className="text-white/15 text-xs">·</span><span className="text-white/35 text-xs">{h.broker}</span></>}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${srcBadge.cls}`}>{srcBadge.text}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white font-bold text-base tabular-nums">{fEur(val)}</div>
                          <div className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fPct(pnlPct)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3 text-center mb-3">
                        <div>
                          <div className={`font-semibold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fEur(pnl)}</div>
                          <div className="text-white/30 text-xs">Guany/Pèrdua</div>
                        </div>
                        <div>
                          <div className="text-white/70 font-semibold text-sm">{fEur(h.currentPrice)}</div>
                          <div className="text-white/30 text-xs">Preu actual</div>
                        </div>
                        <div>
                          <div className="text-white/70 font-semibold text-sm">{fEur(h.avgEntryPrice)}</div>
                          <div className="text-white/30 text-xs">Preu entrada</div>
                        </div>
                        <div>
                          <div className="text-white/70 font-semibold text-sm">{weight.toFixed(1)}%</div>
                          <div className="text-white/30 text-xs">Pes cartera</div>
                        </div>
                      </div>

                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${weight}%`, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                      </div>
                      {h.priceLastUpdated && (
                        <p className="text-white/20 text-xs mt-1.5">Preu actualitzat: {h.priceLastUpdated}</p>
                      )}
                    </div>
                  );
                })}

                {pendingHoldings.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px flex-1 bg-white/8" />
                      <span className="text-amber-400/60 text-xs uppercase tracking-widest">Propostes pendents</span>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    {pendingHoldings.map(h => (
                      <div key={h.id} className="bg-[#0d1f1a] border border-amber-500/15 rounded-xl p-4 opacity-70">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-white/55 font-medium text-sm">{h.assetName}</span>
                            <p className="text-white/30 text-xs mt-0.5">{h.assetCategory} · {h.broker}</p>
                            {h.notes && <p className="text-white/25 text-xs mt-1 italic">{h.notes}</p>}
                          </div>
                          <span className="text-amber-400 text-xs px-2 py-1 rounded-lg bg-amber-500/8 border border-amber-500/15 flex-shrink-0">
                            Pendent de compra
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TRANSACCIONS ── */}
        {activeTab === 'transaccions' && (
          <div className="space-y-2">
            {portfolio.transactions.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <p className="text-sm">Sense moviments registrats.</p>
              </div>
            ) : (
              [...portfolio.transactions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((tx: ClientTransaction) => {
                  const meta = OP_META[tx.operationType];
                  return (
                    <div key={tx.id} className="bg-[#0d1f1a] border border-white/8 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-white/12 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}30` }}>
                          <span className="text-xs font-bold" style={{ color: meta.color }}>
                            {meta.label.slice(0, 1)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                            <span className="text-white/55 text-sm truncate">{tx.assetName || tx.ticker || '—'}</span>
                            {tx.ticker && tx.assetName && <span className="text-white/25 text-xs">({tx.ticker})</span>}
                          </div>
                          <div className="text-white/30 text-xs mt-0.5">{tx.date}{tx.broker ? ` · ${tx.broker}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-white font-semibold text-sm tabular-nums">{fEur(tx.totalEur)}</div>
                        {tx.quantity > 0 && <div className="text-white/30 text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>}
                        {tx.commission > 0 && <div className="text-white/20 text-xs">Com. {fEur(tx.commission)}</div>}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ── NOTES ── */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {visibleNotes.length === 0 ? (
              <div className="text-center py-20">
                <svg className="w-8 h-8 mx-auto mb-3 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-white/30 text-sm">Sense notes de l&apos;assessor.</p>
              </div>
            ) : (
              visibleNotes.map(note => (
                <div key={note.id} className="bg-[#0d1f1a] border border-[#c9a84c]/12 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-[#1a3a2a] border border-[#2d6a4f]/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#c9a84c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/60 text-xs font-medium">{note.author}</p>
                      <p className="text-white/25 text-xs">{note.createdAt.split('T')[0]}</p>
                    </div>
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed">{note.text}</p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
