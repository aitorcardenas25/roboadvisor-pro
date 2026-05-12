'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { AdminPortfolio, PortfolioAsset } from '@/lib/adminPortfolios';

const PROFILE_META: Record<string, { label: string; color: string; bg: string }> = {
  conservador:  { label: 'Conservador',  color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  moderat:      { label: 'Moderat',      color: '#c9a84c', bg: 'rgba(201,168,76,0.1)'  },
  dinàmic:      { label: 'Dinàmic',      color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  'molt-dinàmic':{ label: 'Molt dinàmic',color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  default:      { label: 'Indefinit',    color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' },
};

const ASSET_COLORS = [
  '#c9a84c', '#60a5fa', '#34d399', '#f97316', '#a78bfa',
  '#f472b6', '#38bdf8', '#fb923c', '#4ade80', '#e879f9',
];

const TYPE_LABEL: Record<string, string> = {
  fund: 'Fons', etf: 'ETF', stock: 'Acció',
};

function fmt(n: number | null | undefined, dec = 1, suffix = '%') {
  if (n == null) return '—';
  return `${n.toFixed(dec)}${suffix}`;
}

function sharpe(ret: number | null | undefined, vol: number | null | undefined, rf: number): number | null {
  if (ret == null || vol == null || vol <= 0) return null;
  return Math.round((ret - rf) / vol * 100) / 100;
}

function WeightBar({ weight, total = 100 }: { weight: number; total?: number }) {
  const pct = Math.min(100, (weight / total) * 100);
  const color = pct > 40 ? '#f97316' : pct > 25 ? '#c9a84c' : '#34d399';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-white/60 w-10 text-right">{weight}%</span>
    </div>
  );
}

interface SimulatedPoint { month: string; value: number }

function buildSimulatedHistory(portfolio: AdminPortfolio): SimulatedPoint[] {
  const annualReturn = portfolio.expectedReturn ?? 5;
  const monthlyReturn = annualReturn / 12 / 100;
  const vol = (portfolio.expectedVol ?? 8) / 100;
  const points: SimulatedPoint[] = [];
  let value = 10000;
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('ca-ES', { month: 'short', year: '2-digit' });
    const noise = (Math.random() - 0.48) * vol * 0.4;
    value = value * (1 + monthlyReturn + noise);
    points.push({ month: label, value: Math.round(value) });
  }
  return points;
}

function PortfolioCard({ p, onClick, rf }: { p: AdminPortfolio; onClick: () => void; rf: number }) {
  const meta = PROFILE_META[p.recommendedProfile] ?? PROFILE_META.default;
  const weightOk = Math.abs(p.totalWeight - 100) < 0.01;
  const sr = sharpe(p.expectedReturn, p.expectedVol, rf);
  const srColor = sr == null ? 'text-white/30' : sr >= 1 ? 'text-green-400' : sr >= 0.5 ? 'text-amber-400' : 'text-red-400';
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left bg-[#0d1f1a] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold text-sm mb-1">{p.name}</h3>
          <span
            className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ color: meta.color, backgroundColor: meta.bg }}>
            {meta.label}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[#c9a84c] font-bold text-lg">{fmt(p.expectedReturn)}</div>
          <div className="text-white/30 text-xs">retorn esperat</div>
        </div>
      </div>

      <p className="text-white/40 text-xs line-clamp-2 mb-3">{p.description}</p>

      <div className="flex items-center justify-between text-xs text-white/30">
        <span>{p.assets.length} actius · {p.horizon}</span>
        <div className="flex items-center gap-2">
          {sr != null && (
            <span className={`font-medium ${srColor}`}>Sharpe {sr.toFixed(2)}</span>
          )}
          <span className={weightOk ? 'text-green-400' : 'text-orange-400'}>
            {weightOk ? '✓ 100%' : `${p.totalWeight}%`}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function PortfolioDetail({ p, onBack, rf }: { p: AdminPortfolio; onBack: () => void; rf: number }) {
  const meta = PROFILE_META[p.recommendedProfile] ?? PROFILE_META.default;
  const history = buildSimulatedHistory(p);
  const gain = history.length >= 2
    ? ((history[history.length - 1].value - history[0].value) / history[0].value * 100).toFixed(1)
    : '—';
  const sr = sharpe(p.expectedReturn, p.expectedVol, rf);

  const pieData = p.assets.map((a, i) => ({
    name:  a.name.length > 22 ? a.name.slice(0, 22) + '…' : a.name,
    value: a.weight,
    color: ASSET_COLORS[i % ASSET_COLORS.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={onBack}
          className="mt-1 text-white/30 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-white font-bold text-xl">{p.name}</h2>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: meta.color, backgroundColor: meta.bg }}>
              {meta.label}
            </span>
          </div>
          <p className="text-white/40 text-sm">{p.description}</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Retorn esperat',  value: fmt(p.expectedReturn), color: '#c9a84c' },
          { label: 'Volatilitat',     value: fmt(p.expectedVol),    color: '#c9a84c' },
          { label: 'Sharpe',          value: sr != null ? sr.toFixed(2) : '—', color: sr == null ? undefined : sr >= 1 ? '#4ade80' : sr >= 0.5 ? '#fb923c' : '#f87171' },
          { label: 'Horitzó',         value: p.horizon,             color: '#c9a84c' },
          { label: 'Rendiment 2a',    value: `+${gain}%`,           color: '#c9a84c' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#0d1f1a] border border-white/10 rounded-lg p-3 text-center">
            <div className="font-bold text-lg" style={{ color: kpi.color ?? '#c9a84c' }}>{kpi.value}</div>
            <div className="text-white/30 text-xs mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* Simulated evolution */}
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
          <h3 className="text-white/60 text-xs font-medium uppercase tracking-wide mb-3">
            Evolució simulada (24 mesos)
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#c9a84c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c9a84c" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                interval={5} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                tickLine={false} axisLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <ReTooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                itemStyle={{ color: '#c9a84c', fontSize: 12 }}
                formatter={(v: number) => [`€${v.toLocaleString('ca-ES')}`, 'Valor']}
              />
              <Area type="monotone" dataKey="value" stroke="#c9a84c" strokeWidth={1.5}
                fill="url(#areaGrad)" dot={false} activeDot={{ r: 3, fill: '#c9a84c' }} />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-white/20 text-xs mt-2">
            Simulació basada en retorn esperat anual de {fmt(p.expectedReturn)} amb soroll aleatori. No és rentabilitat real.
          </p>
        </div>

        {/* Allocation pie */}
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
          <h3 className="text-white/60 text-xs font-medium uppercase tracking-wide mb-3">
            Distribució d&apos;actius
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <ReTooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                itemStyle={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                formatter={(v: number) => [`${v}%`, '']}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v: string) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset table */}
      <div className="bg-[#0d1f1a] border border-white/10 rounded-xl mb-4 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-medium text-sm">Composició de la cartera</h3>
        </div>
        <div className="divide-y divide-white/5">
          {p.assets.map((a: PortfolioAsset, i: number) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{a.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                        {TYPE_LABEL[a.type] ?? a.type}
                      </span>
                      {a.isin && <span className="text-xs text-white/20">{a.isin}</span>}
                    </div>
                  </div>
                </div>
                <span className="text-[#c9a84c] font-bold text-sm flex-shrink-0">{a.weight}%</span>
              </div>
              <WeightBar weight={a.weight} />
              {a.justification && (
                <p className="text-white/30 text-xs mt-1.5 leading-relaxed">{a.justification}</p>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-white/2 border-t border-white/10 flex justify-between">
          <span className="text-white/40 text-sm">Total</span>
          <span className={`font-bold text-sm ${Math.abs(p.totalWeight - 100) < 0.01 ? 'text-green-400' : 'text-orange-400'}`}>
            {p.totalWeight}%
          </span>
        </div>
      </div>

      {/* Justification */}
      {p.justification && (
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
          <h3 className="text-white/60 text-xs font-medium uppercase tracking-wide mb-2">
            Raonament de la cartera
          </h3>
          <p className="text-white/50 text-sm leading-relaxed">{p.justification}</p>
        </div>
      )}

      {/* Legal disclaimer */}
      <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
        <p className="text-yellow-300/60 text-xs leading-relaxed">
          La informació d&apos;aquesta pàgina té caràcter informatiu i no constitueix assessorament financer personalitzat.
          L&apos;evolució simulada és orientativa i no garanteix rentabilitats futures. Inversions passades no garanteixen resultats futurs.
        </p>
      </div>
    </motion.div>
  );
}

export default function CarteraPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<AdminPortfolio[]>([]);
  const [selected, setSelected]    = useState<AdminPortfolio | null>(null);
  const [loading, setLoading]      = useState(true);
  const [rf, setRf]                = useState(3.0);
  const [rfSource, setRfSource]    = useState<'ecb-api' | 'fallback'>('fallback');

  useEffect(() => {
    fetch('/api/risk-free-rate')
      .then(r => r.json())
      .then(d => { if (typeof d.rate === 'number') { setRf(d.rate); setRfSource(d.source ?? 'ecb-api'); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/acces-restringit');
      return;
    }
    if (status === 'authenticated') {
      const role = (session?.user as { role?: string })?.role;
      if (role !== 'authorized' && role !== 'admin') {
        router.push('/acces-restringit');
        return;
      }
      fetch('/api/portfolios')
        .then(r => r.json())
        .then(d => { setPortfolios(d.portfolios ?? []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [status, session, router]);

  const userName = (session?.user as { name?: string })?.name ?? 'Client';

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-[#0d1f1a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
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
              onClick={() => router.push('/')}
              className="text-white/30 hover:text-white transition-colors text-sm">
              ← Inici
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {selected ? (
            <PortfolioDetail key="detail" p={selected} onBack={() => setSelected(null)} rf={rf} />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}>

              {/* Page header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-1">
                  Les teves carteres model
                </h1>
                <p className="text-white/40 text-sm">
                  Carteres recomanades pel teu perfil inversor. Selecciona&apos;n una per veure el detall.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-white/30">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${rfSource === 'ecb-api' ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                  Taxa lliure de risc BCE: <span className="text-white/60 font-medium">{rf.toFixed(2)}%</span>
                  <span className="text-white/20">·</span>
                  Sharpe ≥ 1 = excel·lent &nbsp;|&nbsp; ≥ 0.5 = acceptable
                </div>
              </div>

              {portfolios.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-white/30">Encara no hi ha carteres actives disponibles.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {portfolios.map(p => (
                    <PortfolioCard key={p.id} p={p} onClick={() => setSelected(p)} rf={rf} />
                  ))}
                </div>
              )}

              <div className="mt-8 p-4 bg-[#0d1f1a] border border-white/10 rounded-xl">
                <p className="text-white/30 text-xs leading-relaxed">
                  <strong className="text-white/50">Avís legal:</strong> Les carteres model presentades tenen caràcter
                  il·lustratiu i formen part del servei d&apos;informació de Factor OTC. No constitueixen oferta ni
                  assessorament financer personalitzat al teu perfil. Consulta amb el teu assessor abans de prendre
                  cap decisió d&apos;inversió.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
