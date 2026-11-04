'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PieChart, Pie, Cell, Tooltip as ReTT, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Area, AreaChart, ReferenceLine,
} from 'recharts';
import type {
  ClientPortfolio, ClientHolding, ClientTransaction, OperationType, PortfolioMetrics,
} from '@/lib/clientPortfolios';
import { computeMetrics } from '@/lib/clientPortfolios';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { DataSourcePanel } from '@/components/DataSourcePanel';

// ── Formatters ─────────────────────────────────────────────────────────────

function fEur(n: number, compact = false): string {
  const abs = Math.abs(n);
  if (compact) {
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
    if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)} K€`;
  }
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fPct(n: number, sign = true): string {
  return `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLORS = [
  '#c9a84c', '#60a5fa', '#34d399', '#f97316', '#a78bfa',
  '#f472b6', '#38bdf8', '#fb923c', '#4ade80', '#e879f9',
];

const OP_META: Record<OperationType, { label: string; color: string; bg: string; icon: string }> = {
  buy:        { label: 'Compra',      color: '#10b981', bg: 'rgba(16,185,129,0.1)',  icon: '↑' },
  sell:       { label: 'Venda',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '↓' },
  deposit:    { label: 'Aportació',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: '+' },
  withdrawal: { label: 'Retirada',    color: '#f97316', bg: 'rgba(249,115,22,0.1)',  icon: '−' },
  rebalance:  { label: 'Rebalanceig', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: '↺' },
};

const TT = {
  contentStyle: { background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 14px' },
  labelStyle:   { color: 'rgba(255,255,255,0.3)',  fontSize: 11, marginBottom: 4 },
  itemStyle:    { color: '#c9a84c', fontSize: 12 },
  cursor:       { stroke: 'rgba(201,168,76,0.15)', strokeWidth: 1 },
};

// ── Derived data helpers ───────────────────────────────────────────────────

function deriveRisk(portfolio: ClientPortfolio): { label: string; color: string } {
  const cats = portfolio.holdings.map(h => h.assetCategory.toLowerCase());
  if (cats.length === 0) return { label: 'No disponible', color: '#6b7280' };
  const eqPct = cats.filter(c =>
    c.includes('variable') || c.includes('equity') || c.includes('accions')
    || c.includes('etf') || c.includes('acció')
  ).length / cats.length * 100;
  if (eqPct >= 80) return { label: 'Dinàmic',         color: '#f97316' };
  if (eqPct >= 50) return { label: 'Moderat',         color: '#c9a84c' };
  if (eqPct >= 20) return { label: 'Conservador',     color: '#60a5fa' };
  return              { label: 'Molt conservador',    color: '#34d399' };
}

function monthlyReturn(portfolio: ClientPortfolio): number | null {
  const snaps = [...portfolio.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length < 2) return null;
  const last   = snaps[snaps.length - 1];
  const cutoff = new Date(last.date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - 30);
  const cStr = cutoff.toISOString().split('T')[0];
  const prev  = snaps.filter(s => s.date <= cStr).pop() ?? snaps[snaps.length - 2];
  if (!prev || prev.id === last.id || prev.totalValue <= 0) return null;
  return ((last.totalValue - prev.totalValue) / prev.totalValue) * 100;
}

function buildSummary(portfolio: ClientPortfolio, metrics: PortfolioMetrics): string {
  const isPos = metrics.pnlEur >= 0;
  const mPct  = monthlyReturn(portfolio);
  const parts: string[] = [];

  parts.push(
    isPos
      ? `La cartera manté una evolució positiva des de l'entrada (${fPct(metrics.pnlPct)}).`
      : `La cartera presenta una variació de ${fPct(metrics.pnlPct)} des de l'entrada, coherent amb les condicions actuals de mercat.`,
  );

  if (mPct !== null) {
    parts.push(
      mPct >= 0
        ? `En el darrer mes ha crescut un ${fPct(mPct, false)}.`
        : `En el darrer mes ha retrocedit un ${fPct(Math.abs(mPct), false)}.`,
    );
  }

  const catMap: Record<string, number> = {};
  for (const h of portfolio.holdings.filter(h => h.priceSource !== 'pending')) {
    const k = h.assetCategory || 'Altres';
    catMap[k] = (catMap[k] ?? 0) + h.currentPrice * h.quantity;
  }
  const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  if (top && metrics.currentValue > 0) {
    const pct = ((top[1] / metrics.currentValue) * 100).toFixed(0);
    parts.push(`Categoria principal: ${top[0]} (${pct}% de la cartera).`);
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />;
}

function SkeletonPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      <div className="border-b border-white/6 bg-[#0a0f0d]/95 sticky top-0 h-14 z-30" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="border border-white/6 rounded-2xl p-6 space-y-4 bg-[#0d1f1a]">
          <Pulse className="h-3 w-44" />
          <Pulse className="h-12 w-64" />
          <Pulse className="h-3.5 w-36" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {[...Array(4)].map((_, i) => <Pulse key={i} className="h-14" />)}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Pulse className="h-64" />
            <div className="grid grid-cols-2 gap-4">
              <Pulse className="h-44" /><Pulse className="h-44" />
            </div>
          </div>
          <div className="space-y-5">
            <Pulse className="h-48" /><Pulse className="h-52" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

const HeroSection = memo(function HeroSection({
  portfolio, metrics, name,
}: {
  portfolio: ClientPortfolio;
  metrics:   PortfolioMetrics;
  name:      string;
}) {
  const isPos = metrics.pnlEur >= 0;
  const mPct  = monthlyReturn(portfolio);
  const risk  = deriveRisk(portfolio);
  const col   = isPos ? '#34d399' : '#ef4444';

  return (
    <div className="relative border border-[#1a3a2a]/80 rounded-2xl overflow-hidden mb-6"
      style={{
        background:  'linear-gradient(135deg,rgba(26,58,42,0.65) 0%,rgba(10,15,13,0.98) 55%,rgba(12,22,17,0.99) 100%)',
        boxShadow:   '0 0 0 1px rgba(45,106,79,0.08),0 24px 64px rgba(0,0,0,0.55)',
      }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 65% 80% at 88% 48%,rgba(201,168,76,0.05),transparent)' }} />
      <div className="absolute top-0 left-0 w-full h-px"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(201,168,76,0.22),transparent)' }} />

      <div className="relative px-6 sm:px-8 py-6 sm:py-7">

        {/* Status badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <span className="text-white/28 text-xs uppercase tracking-[0.15em]">{portfolio.name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ color: '#34d399', border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.07)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Activa
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ color: risk.color, border: `1px solid ${risk.color}30`, background: `${risk.color}0e` }}>
              Risc {risk.label}
            </span>
            {portfolio.nextFollowup && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-[#c9a84c]/18 text-[#c9a84c]/60">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Seg.: {portfolio.nextFollowup}
              </span>
            )}
          </div>
        </div>

        {/* Value + return */}
        <p className="text-white/30 text-sm mb-1.5">{name}</p>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mb-5">
          <div>
            <div className="text-white font-black text-4xl sm:text-5xl tabular-nums tracking-tight leading-none">
              {fEur(metrics.currentValue)}
            </div>
            <p className="text-white/22 text-xs mt-1 uppercase tracking-wider">Valor total de la cartera</p>
          </div>
          {metrics.pnlEur !== 0 && (
            <div className="pb-1">
              <div className="font-bold text-2xl sm:text-3xl tabular-nums leading-none" style={{ color: col }}>
                {fPct(metrics.pnlPct)}
              </div>
              <div className="text-xs mt-1" style={{ color: col, opacity: 0.7 }}>
                {isPos ? '+' : ''}{fEur(metrics.pnlEur)} des de l&apos;entrada
              </div>
            </div>
          )}
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Tile label="Capital invertit"  value={fEur(metrics.totalInvested, true)} />
          <Tile label="Posicions actives" value={String(metrics.holdingCount)} />
          <Tile
            label="Rendiment mes"
            value={mPct !== null ? fPct(mPct) : 'N/D'}
            color={mPct !== null ? (mPct >= 0 ? '#34d399' : '#ef4444') : undefined}
          />
          <Tile
            label="Última actualit."
            value={metrics.lastUpdated ? fDate(metrics.lastUpdated) : 'N/D'}
          />
        </div>

        {/* P&L progress bar */}
        {metrics.totalInvested > 0 && Math.abs(metrics.pnlPct) > 0.01 && (
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center justify-between mb-1.5 text-[10px] uppercase tracking-widest">
              <span className="text-white/22">Rendiment acumulat</span>
              <span style={{ color: col }}>{fPct(metrics.pnlPct)}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width:      `${Math.min(Math.abs(metrics.pnlPct) * 5, 100)}%`,
                  background: `linear-gradient(90deg,${col}88,${col})`,
                }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/[0.025] border border-white/[0.05] rounded-xl px-3 py-2.5">
      <div className="font-semibold text-sm tabular-nums leading-tight"
        style={{ color: color ?? 'rgba(255,255,255,0.75)' }}>{value}</div>
      <div className="text-white/25 text-[10px] mt-0.5 uppercase tracking-wide leading-tight">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVOLUTION CHART
// ─────────────────────────────────────────────────────────────────────────────

const EvolutionChart = memo(function EvolutionChart({
  portfolio, metrics,
}: { portfolio: ClientPortfolio; metrics: PortfolioMetrics }) {
  const data = useMemo(
    () => [...portfolio.snapshots]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({ date: s.date, valor: s.totalValue })),
    [portfolio.snapshots],
  );

  const isPos = metrics.pnlEur >= 0;
  const col   = isPos ? '#34d399' : '#ef4444';
  const gid   = isPos ? 'eg-pos' : 'eg-neg';

  return (
    <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold text-sm">Evolució patrimonial</h3>
          <p className="text-white/25 text-xs mt-0.5">Snapshots registrats per l&apos;assessor</p>
        </div>
        {data.length >= 2 && (
          <span className="text-sm font-bold" style={{ color: col }}>{fPct(metrics.pnlPct)}</span>
        )}
      </div>

      {data.length >= 2 ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={col} stopOpacity={0.2} />
                <stop offset="95%" stopColor={col} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.22)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v + 'T00:00:00');
                return `${d.getDate()} ${d.toLocaleString('ca-ES', { month: 'short' })}`;
              }}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.22)', fontSize: 10 }}
              axisLine={false} tickLine={false} width={46}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            />
            {metrics.totalInvested > 0 && (
              <ReferenceLine y={metrics.totalInvested} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4"
                label={{ value: 'Capital invertit', fill: 'rgba(255,255,255,0.18)', fontSize: 9, position: 'insideTopRight' }} />
            )}
            <ReTT
              formatter={(v: number) => [fEur(v), 'Valor']}
              labelFormatter={(l: string) => fDate(l)}
              {...TT}
            />
            <Area type="monotone" dataKey="valor"
              stroke={col} strokeWidth={2} fill={`url(#${gid})`}
              dot={{ r: 3, fill: col, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: col, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart text="El gràfic apareixerà quan l'assessor registri snapshots de la cartera" />
      )}
    </div>
  );
});

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
        <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <p className="text-white/22 text-sm text-center max-w-xs">{text}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUTION CHARTS
// ─────────────────────────────────────────────────────────────────────────────

const DistributionPanel = memo(function DistributionPanel({
  portfolio, total,
}: { portfolio: ClientPortfolio; total: number }) {
  const byAsset = useMemo(
    () => portfolio.holdings
      .map((h, i) => ({
        name: h.assetName,
        val:  h.currentPrice * h.quantity,
        col:  COLORS[i % COLORS.length],
      }))
      .filter(d => d.val > 0),
    [portfolio.holdings],
  );

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of portfolio.holdings) {
      const k = h.assetCategory || 'Altres';
      m[k] = (m[k] ?? 0) + h.currentPrice * h.quantity;
    }
    return Object.entries(m)
      .map(([name, val], i) => ({ name, val, pct: total > 0 ? (val / total) * 100 : 0, col: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.val - a.val);
  }, [portfolio.holdings, total]);

  if (total === 0 || byAsset.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Donut */}
      <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Distribució per actiu</h3>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <ResponsiveContainer width={96} height={96}>
              <PieChart>
                <Pie data={byAsset} dataKey="val" cx="50%" cy="50%"
                  innerRadius={26} outerRadius={44} paddingAngle={2} strokeWidth={0}>
                  {byAsset.map((d, i) => <Cell key={i} fill={d.col} />)}
                </Pie>
                <ReTT formatter={(v: number) => [fEur(v), '']} {...TT} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            {byAsset.slice(0, 5).map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.col }} />
                  <span className="text-white/42 text-xs truncate">{d.name}</span>
                </div>
                <span className="text-white/28 text-xs flex-shrink-0 tabular-nums">
                  {total > 0 ? ((d.val / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            ))}
            {byAsset.length > 5 && (
              <p className="text-white/18 text-xs">+{byAsset.length - 5} més</p>
            )}
          </div>
        </div>
      </div>

      {/* Category bars */}
      <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-5">
        <h3 className="text-white font-semibold text-sm mb-4">Per categoria</h3>
        <div className="space-y-3">
          {byCategory.slice(0, 5).map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/42 text-xs truncate pr-2">{c.name}</span>
                <span className="text-white/28 text-xs flex-shrink-0 tabular-nums">{c.pct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${c.pct}%`, background: c.col }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

const ExecutiveSummary = memo(function ExecutiveSummary({
  portfolio, metrics,
}: { portfolio: ClientPortfolio; metrics: PortfolioMetrics }) {
  const text  = useMemo(() => buildSummary(portfolio, metrics), [portfolio, metrics]);
  const isPos = metrics.pnlEur >= 0;
  const col   = isPos ? '#34d399' : '#ef4444';

  return (
    <div className="bg-[#0d1f1a] border border-[#c9a84c]/15 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/18 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-[#c9a84c]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-[#c9a84c]/72 font-semibold text-sm">Resum executiu</h3>
      </div>

      <p className="text-white/55 text-sm leading-relaxed">{text}</p>

      <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
        style={{ background: `${col}08`, border: `1px solid ${col}18`, color: col }}>
        {isPos ? '▲' : '▼'} {fPct(metrics.pnlPct)} · {isPos ? '+' : ''}{fEur(metrics.pnlEur, true)}
      </div>

      {portfolio.recommendations && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <p className="text-white/22 text-[10px] uppercase tracking-widest mb-2">Recomanació de l&apos;assessor</p>
          <p className="text-white/48 text-xs leading-relaxed line-clamp-4">{portfolio.recommendations}</p>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// GOALS
// ─────────────────────────────────────────────────────────────────────────────

function GoalsSection({ metrics }: { metrics: PortfolioMetrics }) {
  const target   = metrics.totalInvested * 1.2;
  const progress = target > 0 ? Math.min((metrics.currentValue / target) * 100, 100) : 0;

  return (
    <div className="bg-[#0d1f1a] border border-white/8 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-white/22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="text-white font-semibold text-sm">Objectiu financer</h3>
        </div>
        <span className="text-white/18 text-[10px] border border-white/8 px-2 py-0.5 rounded-full uppercase tracking-wide">
          Pròximament
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <GoalBlock label="Capital actual"   value={fEur(metrics.currentValue, true)} />
        <GoalBlock label="Objectiu estimat" value={fEur(target, true)} highlight />
        <GoalBlock label="Assolit"          value={`${progress.toFixed(0)}%`} />
      </div>

      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#c9a84c88,#c9a84c)' }} />
      </div>
      <p className="text-white/16 text-[10px] mt-2 leading-tight">
        L&apos;objectiu es definirà amb l&apos;assessor en el proper seguiment.
      </p>
    </div>
  );
}

function GoalBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white/[0.025] border border-white/[0.05] rounded-xl p-2.5 text-center">
      <div className="font-semibold text-xs tabular-nums leading-tight"
        style={{ color: highlight ? '#c9a84c' : 'rgba(255,255,255,0.65)' }}>{value}</div>
      <div className="text-white/20 text-[9px] mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOLDING CARD
// ─────────────────────────────────────────────────────────────────────────────

const HoldingCard = memo(function HoldingCard({
  h, idx, total,
}: { h: ClientHolding; idx: number; total: number }) {
  const val    = h.currentPrice * h.quantity;
  const cost   = h.avgEntryPrice * h.quantity;
  const pnl    = val - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
  const weight = total > 0 ? (val / total) * 100 : 0;
  const col    = COLORS[idx % COLORS.length];
  const pnlPos = pnl >= 0;

  const priceSourceId = h.priceSource === 'fmp' ? 'fmp' : h.priceSource === 'manual' ? 'internal' : 'pending';

  return (
    <div className="bg-[#0d1f1a] border border-white/[0.06] rounded-xl p-5 hover:border-white/12 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${col}14`, border: `1px solid ${col}22` }}>
            <span className="font-black text-[11px]" style={{ color: col }}>
              {(h.assetSymbol || h.assetName).slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="text-white font-semibold text-sm">{h.assetName}</span>
              {h.assetSymbol && (
                <span className="text-white/25 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">{h.assetSymbol}</span>
              )}
              <DataSourceBadge source={priceSourceId} variant="chip" />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/28">
              {h.assetCategory && <span>{h.assetCategory}</span>}
              {h.broker && <><span className="opacity-40">·</span><span>{h.broker}</span></>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-white font-bold text-base tabular-nums">{fEur(val)}</div>
          <div className="text-sm font-semibold tabular-nums"
            style={{ color: pnlPos ? '#34d399' : '#ef4444' }}>{fPct(pnlPct)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StCell label="P&L"            value={fEur(pnl)}              pnl={pnlPos ? 'pos' : 'neg'} />
        <StCell label="Preu actual"    value={fEur(h.currentPrice)}   />
        <StCell label="Preu entrada"   value={fEur(h.avgEntryPrice)}  />
        <StCell
          label="Participacions"
          value={h.quantity % 1 === 0 ? String(h.quantity) : h.quantity.toFixed(4)}
        />
      </div>

      {/* Weight bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/18 text-[10px] uppercase tracking-wider">Pes cartera</span>
          <span className="text-white/28 text-[10px] tabular-nums">{weight.toFixed(1)}%</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weight}%`, background: col }} />
        </div>
      </div>

      {h.priceLastUpdated && (
        <DataSourceBadge source={priceSourceId} updatedAt={h.priceLastUpdated} variant="inline" className="mt-2 block" />
      )}
    </div>
  );
});

function StCell({ label, value, pnl }: { label: string; value: string; pnl?: 'pos' | 'neg' }) {
  const color = pnl === 'pos' ? '#34d399' : pnl === 'neg' ? '#ef4444' : 'rgba(255,255,255,0.6)';
  return (
    <div className="bg-white/[0.02] border border-white/[0.045] rounded-lg px-2.5 py-2">
      <div className="font-semibold text-xs tabular-nums leading-tight" style={{ color }}>{value}</div>
      <div className="text-white/20 text-[9px] mt-0.5 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: { id: string; text: string; author: string; createdAt: string } }) {
  return (
    <div className="flex gap-3 pb-5">
      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
        <div className="w-9 h-9 bg-[#1a3a2a] border border-[#2d6a4f]/28 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#c9a84c]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="w-px flex-1 bg-white/[0.05] min-h-[8px]" />
      </div>
      <div className="flex-1 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/52 text-xs font-semibold">{note.author}</span>
          <span className="text-white/16 text-xs">·</span>
          <span className="text-white/20 text-xs">{fDate(note.createdAt)}</span>
        </div>
        <div className="bg-[#0d1f1a] border border-[#c9a84c]/10 rounded-2xl rounded-tl-sm px-4 py-3.5">
          <p className="text-white/58 text-sm leading-relaxed">{note.text}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

interface ReportItem {
  id: string; periodStart: string; periodEnd: string; createdAt: string; sentAt?: string;
}

function ReportsSection({ portfolioId }: { portfolioId: string }) {
  const [items, setItems]  = useState<ReportItem[]>([]);
  const [loading, setLoad] = useState(true);

  useEffect(() => {
    fetch(`/api/client/reports?portfolioId=${encodeURIComponent(portfolioId)}`)
      .then(r => r.json())
      .then((d: { reports?: ReportItem[] }) => { setItems(d.reports ?? []); setLoad(false); })
      .catch(() => setLoad(false));
  }, [portfolioId]);

  if (loading) return (
    <div className="space-y-3">{[...Array(3)].map((_, i) => <Pulse key={i} className="h-20" />)}</div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center">
        <svg className="w-6 h-6 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-white/25 text-sm">Cap informe disponible</p>
      <p className="text-white/16 text-xs">El teu assessor publicarà els informes mensuals aquí.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((r, i) => (
        <div key={r.id}
          className={`flex items-center justify-between gap-4 p-5 rounded-xl border transition-all ${
            i === 0
              ? 'bg-[#0d1f1a] border-[#c9a84c]/18'
              : 'bg-[#0d1f1a] border-white/[0.055] hover:border-white/12'
          }`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              i === 0 ? 'bg-[#c9a84c]/10 border border-[#c9a84c]/18' : 'bg-white/[0.035] border border-white/8'
            }`}>
              <svg className={`w-5 h-5 ${i === 0 ? 'text-[#c9a84c]/60' : 'text-white/20'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium text-sm ${i === 0 ? 'text-white/78' : 'text-white/55'}`}>
                  Informe {fDate(r.periodStart)} — {fDate(r.periodEnd)}
                </span>
                {i === 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/18 text-[#c9a84c]/62">
                    Darrer
                  </span>
                )}
              </div>
              <p className="text-white/20 text-xs mt-0.5">
                Publicat: {fDate(r.createdAt)}{r.sentAt ? ' · Enviat per email' : ''}
              </p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-white/20 text-xs border border-white/8 px-3 py-1.5 rounded-lg hover:border-white/20 hover:text-white/40 transition-all flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────────────────────

function TabEmpty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-white/8" />
      </div>
      <p className="text-white/25 text-sm">{text}</p>
      {sub && <p className="text-white/15 text-xs text-center max-w-xs">{sub}</p>}
    </div>
  );
}

function EmptyPortfolio({ name }: { name: string }) {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%,rgba(26,58,42,0.4) 0%,transparent 70%)' }}>
      <div className="text-center max-w-xs">
        <div className="w-20 h-20 bg-[#1a3a2a] border border-[#2d6a4f]/22 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-9 h-9 text-[#c9a84c]/22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-white font-bold text-xl mb-2">Hola, {name}</h1>
        <p className="text-white/35 text-sm leading-relaxed mb-6">
          El teu assessor encara no t&apos;ha assignat cap cartera. Rebràs accés a la teva àrea personal ben aviat.
        </p>
        <a href="/login"
          className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl border border-[#c9a84c]/18 text-[#c9a84c]/60 hover:text-[#c9a84c] hover:bg-[#c9a84c]/5 transition-all">
          ← Tornar a l&apos;inici
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'posicions' | 'moviments' | 'informes' | 'notes';

export default function ClientCarteraPage() {
  const { data: session, status } = useSession();
  const router                    = useRouter();
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('overview');
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/client/portfolio')
        .then(r => r.json())
        .then((d: { portfolio: ClientPortfolio | null }) => {
          setPortfolio(d.portfolio ?? null);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const name = (session?.user as { name?: string } | undefined)?.name ?? 'Client';

  if (status === 'loading' || loading) return <SkeletonPage />;
  if (!portfolio) return <EmptyPortfolio name={name} />;

  const metrics         = computeMetrics(portfolio);
  const isPending       = (h: ClientHolding) =>
    h.priceSource === 'pending' || (h.currentPrice === 0 && h.quantity === 0);
  const activeHoldings  = portfolio.holdings.filter(h => !isPending(h));
  const pendingHoldings = portfolio.holdings.filter(h => isPending(h));
  const visibleNotes    = portfolio.advisorNotes.filter(n => n.isVisibleToClient);

  const TABS: { id: Tab; label: string; cnt?: number }[] = [
    { id: 'overview',  label: 'Resum'                                         },
    { id: 'posicions', label: 'Posicions',  cnt: activeHoldings.length        },
    { id: 'moviments', label: 'Moviments',  cnt: portfolio.transactions.length || undefined },
    { id: 'informes',  label: 'Informes'                                       },
    { id: 'notes',     label: 'Notes',      cnt: visibleNotes.length || undefined },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f0d]"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% -8%,rgba(26,58,42,0.3) 0%,transparent 60%)' }}>

      {/* ── Navbar ── */}
      <nav className="border-b border-white/[0.055] bg-[#0a0f0d]/95 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[#c9a84c] font-black text-[9px] leading-none">F</span>
            </div>
            <span className="text-white/32 text-sm hidden sm:inline">Factor OTC</span>
            <span className="text-white/14 text-sm hidden sm:inline">/</span>
            <span className="text-white/50 text-sm truncate">La meva cartera</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {portfolio.nextFollowup && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-[#c9a84c]/52 border border-[#c9a84c]/12 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Seg.: {portfolio.nextFollowup}
              </span>
            )}
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 text-xs text-white/28 border border-white/8 px-2.5 py-1 rounded-lg hover:border-white/18 hover:text-white/45 transition-all">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hidden sm:inline">Fonts de dades</span>
            </button>
            <span className="text-white/28 text-xs">{name}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* ── Hero ── */}
        <HeroSection portfolio={portfolio} metrics={metrics} name={name} />

        {/* ── Tabs ── */}
        <div className="flex border-b border-white/[0.055] mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all relative ${
                tab === t.id
                  ? 'text-[#c9a84c] border-b-2 border-[#c9a84c] -mb-px'
                  : 'text-white/25 hover:text-white/52'
              }`}>
              {t.label}
              {(t.cnt ?? 0) > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-tight ${
                  tab === t.id ? 'bg-[#c9a84c]/14 text-[#c9a84c]' : 'bg-white/6 text-white/25'
                }`}>{t.cnt}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <EvolutionChart portfolio={portfolio} metrics={metrics} />
                <DistributionPanel portfolio={portfolio} total={metrics.currentValue} />
              </div>
              <div className="space-y-5">
                <ExecutiveSummary portfolio={portfolio} metrics={metrics} />
                <GoalsSection metrics={metrics} />
              </div>
            </div>

            {/* Latest note preview */}
            {visibleNotes.length > 0 && (
              <div className="bg-[#0d1f1a] border border-[#c9a84c]/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-sm">Última nota de l&apos;assessor</h3>
                  {visibleNotes.length > 1 && (
                    <button onClick={() => setTab('notes')}
                      className="text-[#c9a84c]/42 hover:text-[#c9a84c]/72 text-xs transition-colors">
                      Totes ({visibleNotes.length}) →
                    </button>
                  )}
                </div>
                <NoteCard
                  note={[...visibleNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]}
                />
              </div>
            )}

            {/* Pending holdings alert */}
            {pendingHoldings.length > 0 && (
              <div className="bg-amber-500/[0.04] border border-amber-500/18 rounded-2xl p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/18 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-amber-400/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-amber-400/85 font-semibold text-sm mb-1">
                    {pendingHoldings.length} posicion{pendingHoldings.length > 1 ? 's' : ''} pendent{pendingHoldings.length > 1 ? 's' : ''} de confirmar
                  </p>
                  <p className="text-white/35 text-xs leading-relaxed">
                    {pendingHoldings.map(h => h.assetName).join(' · ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── POSICIONS ── */}
        {tab === 'posicions' && (
          <div className="space-y-3">
            {activeHoldings.length === 0 && pendingHoldings.length === 0 ? (
              <TabEmpty
                text="Sense posicions assignades"
                sub="El teu assessor afegirà les posicions quan la cartera sigui operativa."
              />
            ) : (
              <>
                {activeHoldings.map((h, i) => (
                  <HoldingCard key={h.id} h={h} idx={i} total={metrics.currentValue} />
                ))}

                {pendingHoldings.length > 0 && (
                  <>
                    <div className="flex items-center gap-3 my-3">
                      <div className="h-px flex-1 bg-white/5" />
                      <span className="text-amber-400/40 text-[9px] uppercase tracking-[0.2em]">Propostes pendents</span>
                      <div className="h-px flex-1 bg-white/5" />
                    </div>
                    {pendingHoldings.map(h => (
                      <div key={h.id} className="bg-[#0d1f1a] border border-amber-500/10 rounded-xl p-4 opacity-55">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-white/45 font-medium text-sm">{h.assetName}</span>
                            <p className="text-white/22 text-xs mt-0.5">
                              {h.assetCategory}{h.broker ? ` · ${h.broker}` : ''}
                            </p>
                            {h.notes && <p className="text-white/18 text-xs mt-1 italic">{h.notes}</p>}
                          </div>
                          <span className="text-amber-400/60 text-xs px-2.5 py-1.5 rounded-xl bg-amber-500/6 border border-amber-500/12 flex-shrink-0">
                            Pendent
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

        {/* ── MOVIMENTS ── */}
        {tab === 'moviments' && (
          <div className="space-y-2">
            {portfolio.transactions.length === 0 ? (
              <TabEmpty
                text="Sense moviments registrats"
                sub="Les compres, vendes i aportacions apareixeran aquí."
              />
            ) : (
              [...portfolio.transactions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((tx: ClientTransaction) => {
                  const m = OP_META[tx.operationType];
                  return (
                    <div key={tx.id}
                      className="bg-[#0d1f1a] border border-white/[0.055] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                          style={{ background: m.bg, border: `1px solid ${m.color}18`, color: m.color }}>
                          {m.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                            <span className="text-white/50 text-sm truncate">{tx.assetName || tx.ticker || '—'}</span>
                          </div>
                          <div className="text-white/20 text-xs mt-0.5">
                            {fDate(tx.date)}{tx.broker ? ` · ${tx.broker}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-white font-semibold text-sm tabular-nums">{fEur(tx.totalEur)}</div>
                        {tx.quantity > 0 && (
                          <div className="text-white/20 text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>
                        )}
                        {tx.commission > 0 && (
                          <div className="text-white/15 text-xs">Com. {fEur(tx.commission)}</div>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ── INFORMES ── */}
        {tab === 'informes' && <ReportsSection portfolioId={portfolio.id} />}

        {/* ── NOTES ── */}
        {tab === 'notes' && (
          visibleNotes.length === 0 ? (
            <TabEmpty
              text="Sense notes de l'assessor"
              sub="Les notes apareixeran aquí quan el teu assessor les publiqui."
            />
          ) : (
            <div className="pt-2">
              {[...visibleNotes]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map(note => <NoteCard key={note.id} note={note} />)
              }
            </div>
          )
        )}

      </div>

      {panelOpen && <DataSourcePanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
