'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip as ReTT, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { ClientPortfolio, ClientTransaction, OperationType } from '@/lib/clientPortfolios';
import { computeMetrics } from '@/lib/clientPortfolios';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return `${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

const ASSET_COLORS = ['#c9a84c', '#60a5fa', '#34d399', '#f97316', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c', '#4ade80', '#e879f9'];

const OP_META: Record<OperationType, { label: string; color: string; bg: string }> = {
  buy:        { label: 'Compra',      color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  sell:       { label: 'Venda',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  deposit:    { label: 'Aportació',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  withdrawal: { label: 'Retirada',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  rebalance:  { label: 'Rebalanceig', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, colored, positive }: { label: string; value: string; sub?: string; colored?: boolean; positive?: boolean }) {
  const color = colored
    ? (positive ? '#10b981' : '#ef4444')
    : '#c9a84c';
  return (
    <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
      <div className="font-bold text-xl" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-0.5 text-white/30">{sub}</div>}
      <div className="text-white/40 text-xs mt-1.5">{label}</div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.4) 0%, transparent 70%)' }}>
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-[#1a3a2a] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-[#c9a84c] text-2xl">💼</span>
        </div>
        <h1 className="text-white font-bold text-xl mb-2">Hola, {name}</h1>
        <p className="text-white/40 text-sm leading-relaxed">
          El teu assessor encara no t&apos;ha assignat cap cartera. En breu rebràs accés a la teva àrea personal.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const metrics     = computeMetrics(portfolio);
  const totalValue  = metrics.currentValue;

  // Pie chart data by asset
  const pieData = portfolio.holdings
    .map((h, i) => ({
      name: h.assetName, value: Math.round(h.currentPrice * h.quantity * 100) / 100, color: ASSET_COLORS[i % ASSET_COLORS.length],
    }))
    .filter(d => d.value > 0);

  // Broker distribution
  const brokerMap: Record<string, number> = {};
  for (const h of portfolio.holdings) {
    const key = h.broker || 'Sense broker';
    brokerMap[key] = (brokerMap[key] ?? 0) + h.currentPrice * h.quantity;
  }
  const brokerData = Object.entries(brokerMap).sort((a, b) => b[1] - a[1]);

  // Snapshot chart
  const snapshotChart = [...portfolio.snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ date: s.date, valor: s.totalValue }));

  // Visible notes only
  const visibleNotes = portfolio.advisorNotes.filter(n => n.isVisibleToClient);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',     label: 'Resum'       },
    { id: 'holdings',     label: 'Posicions'   },
    { id: 'transaccions', label: 'Moviments'   },
    { id: 'notes',        label: 'Notes'       },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0d] px-4 py-8"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.3) 0%, transparent 60%)' }}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white font-bold text-2xl">{portfolio.name}</h1>
            <p className="text-white/40 text-sm mt-1">Hola, {userName}</p>
          </div>
          <div className="text-right">
            {metrics.lastUpdated && <p className="text-white/30 text-xs">Preus actualitzats: {metrics.lastUpdated}</p>}
            {portfolio.nextFollowup && <p className="text-[#c9a84c]/60 text-xs mt-0.5">Proper seguiment: {portfolio.nextFollowup}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6 gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'text-[#c9a84c] border-b-2 border-[#c9a84c]'
                  : 'text-white/40 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="Valor actual" value={fEur(metrics.currentValue)} />
              <KpiCard label="Rendibilitat (€)" value={fEur(metrics.pnlEur)} colored positive={metrics.pnlEur >= 0} />
              <KpiCard label="Rendibilitat (%)" value={fPct(metrics.pnlPct)} colored positive={metrics.pnlPct >= 0} />
              <KpiCard
                label="Inversió neta"
                value={fEur(metrics.netContributions > 0 ? metrics.netContributions : metrics.totalInvested)}
                sub={`${metrics.holdingCount} posicion${metrics.holdingCount !== 1 ? 's' : ''}`}
              />
            </div>

            {/* Evolution chart */}
            <div className="bg-[#0d1f1a] border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-sm">Evolució del valor</h3>
                <span className="text-white/30 text-xs">Basada en snapshots manuals de l&apos;assessor</span>
              </div>
              {snapshotChart.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={snapshotChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                    <ReTT
                      formatter={(v: number) => [fEur(v), 'Valor']}
                      contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                      labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      itemStyle={{ color: '#c9a84c' }}
                    />
                    <Line type="monotone" dataKey="valor" stroke="#c9a84c" strokeWidth={2} dot={{ r: 3, fill: '#c9a84c' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-32 text-white/20 text-sm text-center">
                  L&apos;assessor encara no ha registrat snapshots d&apos;evolució.<br />
                  <span className="text-xs block mt-1">El gràfic apareixerà quan hi hagi dades reals.</span>
                </div>
              )}
            </div>

            {/* Pie + Broker */}
            {totalValue > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Asset distribution */}
                <div className="bg-[#0d1f1a] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-sm mb-4">Distribució per actiu</h3>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2} dataKey="value">
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <ReTT formatter={(v: number) => [fEur(v), '']} contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#c9a84c' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-white/60 text-xs truncate">{d.name}</span>
                          </div>
                          <span className="text-white/40 text-xs flex-shrink-0">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Broker distribution */}
                <div className="bg-[#0d1f1a] border border-white/10 rounded-2xl p-6">
                  <h3 className="text-white font-semibold text-sm mb-4">Distribució per broker</h3>
                  <div className="space-y-3">
                    {brokerData.map(([broker, val], i) => {
                      const pct = totalValue > 0 ? (val / totalValue) * 100 : 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/60 text-xs">{broker}</span>
                            <span className="text-white/40 text-xs">{fEur(val)} · {pct.toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#c9a84c] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {portfolio.recommendations && (
              <div className="bg-[#0d1f1a] border border-[#c9a84c]/20 rounded-2xl p-6">
                <h3 className="text-[#c9a84c]/80 font-semibold text-sm mb-3">Recomanacions de l&apos;assessor</h3>
                <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{portfolio.recommendations}</p>
              </div>
            )}
          </div>
        )}

        {/* ── HOLDINGS ── */}
        {activeTab === 'holdings' && (
          <div className="space-y-3">
            {portfolio.holdings.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <p>Sense posicions assignades.</p>
              </div>
            ) : (
              portfolio.holdings.map((h, i) => {
                const val    = h.currentPrice * h.quantity;
                const cost   = h.avgEntryPrice * h.quantity;
                const pnl    = val - cost;
                const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                const weight = totalValue > 0 ? (val / totalValue) * 100 : 0;
                return (
                  <div key={h.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                          <span className="text-white font-semibold text-sm">{h.assetName}</span>
                          {h.assetSymbol && <span className="text-white/30 text-xs">({h.assetSymbol})</span>}
                        </div>
                        <p className="text-white/30 text-xs ml-4">{h.assetCategory} · {h.broker}</p>
                      </div>
                      <div className={`text-sm font-bold flex-shrink-0 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fPct(pnlPct)}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div><div className="text-white font-semibold text-sm">{fEur(val)}</div><div className="text-white/30 text-xs">Valor actual</div></div>
                      <div><div className={`font-semibold text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fEur(pnl)}</div><div className="text-white/30 text-xs">Guany/Pèrdua</div></div>
                      <div><div className="text-white font-semibold text-sm">{fEur(h.avgEntryPrice)}</div><div className="text-white/30 text-xs">Preu entrada</div></div>
                      <div><div className="text-white font-semibold text-sm">{weight.toFixed(1)}%</div><div className="text-white/30 text-xs">Pes cartera</div></div>
                    </div>
                    <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${weight}%`, backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                    </div>
                    {h.priceLastUpdated && <p className="text-white/20 text-xs mt-2">Preu actualitzat: {h.priceLastUpdated}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TRANSACCIONS ── */}
        {activeTab === 'transaccions' && (
          <div className="space-y-2">
            {portfolio.transactions.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <p>Sense moviments registrats.</p>
              </div>
            ) : (
              [...portfolio.transactions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((tx: ClientTransaction) => {
                  const meta = OP_META[tx.operationType];
                  return (
                    <div key={tx.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                        <div className="min-w-0">
                          <div className="text-white text-sm truncate">
                            {tx.assetName || tx.ticker || '—'}
                            {tx.ticker && tx.assetName && <span className="text-white/30 text-xs ml-1">({tx.ticker})</span>}
                          </div>
                          <div className="text-white/30 text-xs">{tx.date}{tx.broker ? ` · ${tx.broker}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-white font-medium text-sm">{fEur(tx.totalEur)}</div>
                        {tx.quantity > 0 && <div className="text-white/30 text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>}
                        {tx.commission > 0 && <div className="text-white/20 text-xs">Comissió: {fEur(tx.commission)}</div>}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ── NOTES ── */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            {visibleNotes.length === 0 ? (
              <div className="text-center py-20 text-white/30">
                <p>Sense notes de l&apos;assessor.</p>
              </div>
            ) : (
              visibleNotes.map(note => (
                <div key={note.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white/30 text-xs">{note.author}</span>
                    <span className="text-white/10 text-xs">·</span>
                    <span className="text-white/30 text-xs">{note.createdAt.split('T')[0]}</span>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{note.text}</p>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
