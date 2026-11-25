'use client';

import ClientNav from '@/components/client/ClientNav';
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
import { computeMetrics, isSoldOut } from '@/lib/clientPortfolios';
import { aggregatePeriods, type Valuation, type Period } from '@/lib/portfolioValuation';
import TaxReportView from '@/components/TaxReportView';
import PortfolioExcelButton from '@/components/PortfolioExcelButton';
import MixHistoryPanel from '@/components/client/MixHistoryPanel';
import type { MixHistory } from '@/lib/mixHistory';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { DataSourcePanel } from '@/components/DataSourcePanel';
import { CLIENT_TAX_REPORT_ENABLED } from '@/lib/featureFlags';
import { useClientName } from '@/components/client/ClientPreview';
import AllocationSummary from '@/components/AllocationSummary';
import FundDrawdowns from '@/components/FundDrawdowns';
import { showDrawdownsByDefault, type FundDrawdowns as FundDD } from '@/lib/drawdowns';
import { allocationBreakdown, assetTypeLabel, classifyFund, managementLabel } from '@/lib/fundClassification';

// ── Formatters ─────────────────────────────────────────────────────────────

// Sempre l'import exacte en format català (4.617,89 €): un client vol veure els seus diners sense arrodonir.
function fEur(n: number, _compact = false): string {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fPct(n: number, sign = true): string {
  return `${sign && n >= 0 ? '+' : ''}${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}
const fPct1 = (n: number) => `${n.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function fDate(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
    return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLORS = [
  '#1e4d3f', '#1f5d8c', '#1e704c', '#8a5a00', '#5b5f7a',
  '#f472b6', '#38bdf8', '#fb923c', '#1e704c', '#e879f9',
];

const OP_META: Record<OperationType, { label: string; color: string; bg: string; icon: string }> = {
  buy:        { label: 'Compra',      color: '#1e704c', bg: 'rgba(16,185,129,0.1)',  icon: '↑' },
  sell:       { label: 'Venda',       color: '#b42820', bg: 'rgba(239,68,68,0.1)',   icon: '↓' },
  deposit:    { label: 'Aportació',   color: '#1f5d8c', bg: 'rgba(96,165,250,0.1)',  icon: '+' },
  withdrawal: { label: 'Retirada',    color: '#8a5a00', bg: 'rgba(249,115,22,0.1)',  icon: '−' },
  rebalance:  { label: 'Rebalanceig', color: '#5b5f7a', bg: 'rgba(167,139,250,0.1)', icon: '↺' },
};

const TT = {
  contentStyle: { background: '#ffffff', border: '1px solid #e6e9e7', borderRadius: 10, padding: '8px 14px' },
  labelStyle:   { color: '#3c4a45',  fontSize: 11, marginBottom: 4 },
  itemStyle:    { color: '#1e4d3f', fontSize: 12 },
  cursor:       { stroke: '#cfd8d4', strokeWidth: 1 },
};

// ── Derived data helpers ───────────────────────────────────────────────────

/** Posicions obertes en el format de lib/fundClassification.ts (pes = valor de mercat). */
function holdingMixItems(holdings: ClientHolding[]) {
  return holdings.filter(h => h.quantity > 0)
    .map(h => ({ isin: h.assetIsin, name: h.assetName, category: h.assetCategory, weight: Math.max(0, h.currentPrice * h.quantity) }));
}

/** Perfil orientatiu segons el pes en renda variable (ponderat pel valor de cada posició). */
function deriveRisk(portfolio: ClientPortfolio): { label: string; color: string } {
  const open = portfolio.holdings.filter(h => h.quantity > 0);
  const total = open.reduce((s, h) => s + Math.max(0, h.currentPrice * h.quantity), 0);
  if (open.length === 0 || total <= 0) return { label: 'No disponible', color: '#626e69' };
  // Mateixa classificació que l'informe (lib/fundClassification.ts): abans tot ETF comptava com a renda variable.
  // Arrodonit: 79,99 % per decimals de preu ha de comptar com el 80 % que és
  const eqPct = Math.round(allocationBreakdown(holdingMixItems(open)).equity);
  if (eqPct >= 80) return { label: 'Dinàmic',         color: '#8a5a00' };
  if (eqPct >= 50) return { label: 'Moderat',         color: '#1e4d3f' };
  if (eqPct >= 20) return { label: 'Conservador',     color: '#1f5d8c' };
  return              { label: 'Molt conservador',    color: '#1e704c' };
}

/** Rendiment de l'últim mes tancat (sense comptar aportacions) i quin mes és. */
function monthlyReturn(portfolio: ClientPortfolio, valuation?: Valuation | null): { pct: number; label: string } | null {
  // Amb valors liquidatius oficials: l'últim mes acabat (no els últims dies del mes en curs).
  const pts = valuation?.points ?? [];
  if (pts.length >= 2) {
    const rows = aggregatePeriods(pts, 'month').filter(r => r.periodReturn !== null);
    const closed = rows.filter(r => isPeriodEndDate(r.date, 'month'));
    const r = closed.at(-1) ?? rows.at(-1);
    if (!r || r.periodReturn === null) return null;
    const m = new Date(r.date + 'T00:00:00').toLocaleString('ca-ES', { month: 'long' }).replace(/^de |^d’|^d'/, '');
    return { pct: r.periodReturn, label: `Rendiment ${/^[aeiouà]/i.test(m) ? "d'" : 'de '}${m}` };
  }
  const snaps = [...portfolio.snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (snaps.length < 2) return null;
  const last   = snaps[snaps.length - 1];
  const cutoff = new Date(last.date + 'T00:00:00');
  cutoff.setDate(cutoff.getDate() - 30);
  const cStr = cutoff.toISOString().split('T')[0];
  const prev  = snaps.filter(s => s.date <= cStr).pop() ?? snaps[snaps.length - 2];
  if (!prev || prev.id === last.id || prev.totalValue <= 0) return null;
  return { pct: ((last.totalValue - prev.totalValue) / prev.totalValue) * 100, label: 'Rendiment últim mes' };
}

function buildSummary(portfolio: ClientPortfolio, metrics: PortfolioMetrics, valuation?: Valuation | null): string {
  const isPos = metrics.pnlEur >= 0;
  const mPct  = monthlyReturn(portfolio, valuation);
  const parts: string[] = [];

  parts.push(
    isPos
      ? `La cartera manté una evolució positiva des de l'entrada (${fPct(metrics.pnlPct)}).`
      : `La cartera presenta una variació de ${fPct(metrics.pnlPct)} des de l'entrada, coherent amb les condicions actuals de mercat.`,
  );

  if (mPct !== null) {
    parts.push(
      `${mPct.label.replace('Rendiment', 'En el mes').replace('En el mes últim mes', 'En l\'últim mes')} ha ${mPct.pct >= 0 ? 'crescut' : 'retrocedit'} un ${fPct(Math.abs(mPct.pct), false)}.`,
    );
  }

  const catMap: Record<string, number> = {};
  for (const h of portfolio.holdings.filter(h => h.priceSource !== 'pending')) {
    const k = h.assetCategory || 'Altres';
    catMap[k] = (catMap[k] ?? 0) + h.currentPrice * h.quantity;
  }
  const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
  if (top && metrics.currentValue > 0) {
    const pct = Math.round((top[1] / metrics.currentValue) * 100);
    parts.push(`Categoria principal: ${top[0]} (${pct} % de la cartera).`);
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-subtle rounded-xl ${className}`} />;
}

function SkeletonPage() {
  return (
    <div className="theme-client min-h-screen bg-canvas">
      <div className="border-b border-line bg-surface sticky top-0 h-14 z-30" />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="border border-line rounded-lg p-6 space-y-4 bg-surface">
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
  portfolio, metrics, name: _name, valuation,
}: {
  portfolio: ClientPortfolio;
  metrics:   PortfolioMetrics;
  name:      string;
  valuation?: Valuation | null;
}) {
  const isPos = metrics.pnlEur >= 0;
  const mPct  = monthlyReturn(portfolio, valuation);
  const risk  = deriveRisk(portfolio);
  const col   = isPos ? '#1e704c' : '#b42820';

  return (
    <div className="relative bg-surface border border-line rounded-lg overflow-hidden mb-6">

      <div className="relative px-6 sm:px-8 py-6 sm:py-7">

        {/* Status badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <span className="text-ink-muted text-xs">{portfolio.name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ color: '#1e704c', border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.07)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-positive" />
              Activa
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full"
              style={{ color: risk.color, border: `1px solid ${risk.color}30`, background: `${risk.color}0e` }}>
              Risc {risk.label}
            </span>
            {portfolio.nextFollowup && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-accent/18 text-accent/60">
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
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mb-5">
          <div>
            <div className="text-ink font-semibold text-4xl sm:text-5xl tabular-nums tracking-tight leading-none">
              {metrics.currentValue.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <p className="text-ink-muted text-xs mt-1">Valor total de la cartera</p>
          </div>
          {metrics.pnlEur !== 0 && (
            <div className="pb-1">
              <div className="font-bold text-2xl sm:text-3xl tabular-nums leading-none" style={{ color: col }}>
                {fPct(metrics.pnlPct)}
              </div>
              <div className="text-xs mt-1" style={{ color: col, opacity: 0.7 }}>
                {isPos ? '+' : ''}{fEur(metrics.pnlEur)}{' '}des de l&apos;entrada
              </div>
            </div>
          )}
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Tile label="Capital invertit"  value={fEur(metrics.totalInvested, true)} />
          <Tile label="Posicions actives" value={String(metrics.holdingCount)} />
          <Tile
            label={mPct?.label ?? 'Rendiment últim mes'}
            value={mPct !== null ? fPct(mPct.pct) : 'N/D'}
            color={mPct !== null ? (mPct.pct >= 0 ? '#1e704c' : '#b42820') : undefined}
          />
          <Tile
            label="Última actualit."
            value={metrics.lastUpdated ? fDate(metrics.lastUpdated) : 'N/D'}
          />
        </div>

        {/* P&L progress bar */}
        {metrics.totalInvested > 0 && Math.abs(metrics.pnlPct) > 0.01 && (
          <div className="mt-5 pt-4 border-t border-line">
            <div className="flex items-center justify-between mb-1.5 text-[10px]">
              <span className="text-ink-muted">Rendiment acumulat</span>
              <span style={{ color: col }}>{fPct(metrics.pnlPct)}</span>
            </div>
            <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
              <div className="h-full rounded-full"
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
    <div className="bg-subtle border border-line rounded-xl px-3 py-2.5">
      <div className="font-semibold text-sm tabular-nums leading-tight"
        style={{ color: color ?? '#3c4a45' }}>{value}</div>
      <div className="text-ink-muted text-[10px] mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EVOLUTION CHART
// ─────────────────────────────────────────────────────────────────────────────

const PERIODS: { id: Period; label: string; desc: string }[] = [
  { id: 'month',   label: 'Mensual',    desc: 'cada final de mes' },
  { id: 'quarter', label: 'Trimestral', desc: 'cada final de trimestre' },
  { id: 'year',    label: 'Anual',      desc: 'cada final d\u2019any' },
];

const eurFull = (n: number) => n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const pctCa   = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

function periodLabel(iso: string, period: Period, isLast: boolean): string {
  const d = new Date(iso + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.toLocaleString('ca-ES', { month: 'long' }).replace(/^de |^d’|^d'/, '');
  const base = period === 'year' ? String(y)
    : period === 'quarter' ? `T${Math.floor(d.getMonth() / 3) + 1} ${y}`
    : `${m.charAt(0).toUpperCase()}${m.slice(1)} ${y}`;
  // El període en curs encara no s'ha acabat: es diu fins a quin dia arriba
  return isLast && !isPeriodEndDate(iso, period) ? `${base} (fins al ${fDate(iso)})` : base;
}
/** Últim dia del període anterior al que conté `iso` (p. ex. 2026-03-15, trimestral → 2025-12-31). */
function previousPeriodEnd(iso: string, period: Period): string {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1;
  const startMonth = period === 'year' ? 0 : period === 'quarter' ? m - (m % 3) : m;
  return new Date(Date.UTC(y, startMonth, 0)).toISOString().slice(0, 10);
}
function isPeriodEndDate(iso: string, period: Period): boolean {
  const m = Number(iso.slice(5, 7));
  const last = new Date(Date.UTC(Number(iso.slice(0, 4)), m, 0)).toISOString().slice(0, 10) === iso;
  return last && (period === 'month' || (period === 'quarter' ? m % 3 === 0 : m === 12));
}

const EvolutionChart = memo(function EvolutionChart({
  portfolio, metrics, valuation, period, onPeriod,
}: { portfolio: ClientPortfolio; metrics: PortfolioMetrics; valuation?: Valuation | null; period: Period; onPeriod: (p: Period) => void }) {
  // Primer, l'evolució calculada amb els valors liquidatius oficials dels fons;
  // si no n'hi ha prou (falten preus), els snapshots que registra l'assessor.
  const fromNavs = (valuation?.points.length ?? 0) >= 2;
  // Amb valors oficials, el selector agrupa la sèrie per mesos, trimestres o anys
  // (els mateixos càlculs que l'Excel): canvien els punts del gràfic i la taula.
  const rows = useMemo(() => fromNavs ? aggregatePeriods(valuation!.points, period) : [], [fromNavs, valuation, period]);
  const data = useMemo(
    () => fromNavs
      ? rows.map(r => ({ date: r.date, valor: r.value, aportat: r.invested }))
      : [...portfolio.snapshots]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(s => ({ date: s.date, valor: s.totalValue, aportat: undefined as number | undefined })),
    [fromNavs, rows, portfolio.snapshots],
  );

  const isPos = metrics.pnlEur >= 0;
  const col   = isPos ? '#1e704c' : '#b42820';
  const gid   = isPos ? 'eg-pos' : 'eg-neg';
  const desc  = PERIODS.find(p => p.id === period)!.desc;
  const table = rows.filter(r => r.periodReturn !== null).slice(-8).reverse();

  return (
    <div className="bg-surface border border-line rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-ink font-semibold text-sm">Evolució patrimonial</h3>
          <p className="text-ink-muted text-xs mt-0.5">
            {fromNavs ? `Valor ${desc}, amb els valors liquidatius oficials dels fons` : 'Snapshots registrats per l\u2019assessor'}
          </p>
        </div>
        {fromNavs && (
          <div role="group" aria-label="Període" className="flex rounded-lg border border-line overflow-hidden text-xs">
            {PERIODS.map(p => (
              <button key={p.id} type="button" onClick={() => onPeriod(p.id)} aria-pressed={period === p.id}
                className={`px-3 py-1.5 transition-colors ${period === p.id ? 'bg-accent text-accent-ink font-semibold' : 'text-ink-soft hover:bg-subtle'}`}>
                {p.label}
              </button>
            ))}
          </div>
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
            <CartesianGrid strokeDasharray="2 4" stroke="#e6e9e7" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#7a8681', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v + 'T00:00:00');
                // El primer i l'últim punt poden no ser final de període (inici de la cartera, avui)
                const end = isPeriodEndDate(v, period);
                if (fromNavs && end && period === 'year') return String(d.getFullYear());
                if (fromNavs && end && period === 'quarter') return `T${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
                const m = d.toLocaleString('ca-ES', { month: 'short' }).replace(/^de |^d’|^d'/, '');
                return fromNavs ? `${m} ${String(d.getFullYear()).slice(2)}` : `${d.getDate()} ${m}`;
              }}
            />
            <YAxis
              tick={{ fill: '#7a8681', fontSize: 10 }}
              axisLine={false} tickLine={false} width={46}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toLocaleString('ca-ES', { maximumFractionDigits: 1 })}K` : String(v)}
            />
            <ReTT
              formatter={(v: number, k: string) => [eurFull(v), k === 'aportat' ? 'Capital aportat' : 'Valor']}
              labelFormatter={(l: string) => fDate(l)}
              {...TT}
            />
            {fromNavs ? (
              <Area type={period === 'month' ? 'stepAfter' : 'linear'} dataKey="aportat" stroke="#7a8681" strokeDasharray="4 4" strokeWidth={1.5} fill="none" dot={false} activeDot={false} />
            ) : metrics.totalInvested > 0 && (
              <ReferenceLine y={metrics.totalInvested} stroke="#7a8681" strokeDasharray="4 4"
                label={{ value: 'Capital invertit', fill: '#7a8681', fontSize: 9, position: 'insideTopRight' }} />
            )}
            {/* Línia recta entre punts: una corba suau inventaria valors entre dos finals de període */}
            <Area type={fromNavs ? 'linear' : 'monotone'} dataKey="valor"
              stroke={col} strokeWidth={2} fill={`url(#${gid})`}
              dot={{ r: 3, fill: col, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: col, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart text="El gràfic apareixerà quan hi hagi preus oficials de tots els fons o l'assessor registri snapshots de la cartera" />
      )}

      {fromNavs && (
        <p className="text-ink-muted text-[11px] mt-2">Línia contínua: valor de la cartera. Línia discontínua: diners que hi has posat.</p>
      )}

      {table.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-muted border-b border-line">
                <th className="text-left font-medium py-2 pr-3">Període</th>
                <th className="text-right font-medium py-2 px-2">Valor al final</th>
                <th className="hidden sm:table-cell text-right font-medium py-2 px-2">Aportacions</th>
                <th className="hidden sm:table-cell text-right font-medium py-2 px-2">Guany</th>
                <th className="text-right font-medium py-2 pl-2">Rendibilitat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.map((r, i) => (
                <tr key={r.date}>
                  <td className="py-2 pr-3 text-ink-soft">
                    {periodLabel(r.date, period, i === 0)}
                    {/* Si el punt anterior no és el final del període just anterior (primera compra a mig període,
                        o mesos sense valor liquidatiu), la rendibilitat cobreix més temps: es diu des de quan */}
                    {(() => {
                      const prev = rows[rows.findIndex(x => x.date === r.date) - 1];
                      return prev && prev.date !== previousPeriodEnd(r.date, period)
                        ? <span className="text-ink-muted"> (des del {fDate(prev.date)})</span> : null;
                    })()}
                  </td>
                  <td className="py-2 px-2 text-right text-ink whitespace-nowrap">{eurFull(r.value)}</td>
                  <td className="hidden sm:table-cell py-2 px-2 text-right text-ink-muted whitespace-nowrap">{Math.abs(r.flow) >= 0.005 ? eurFull(r.flow) : '—'}</td>
                  <td className={`hidden sm:table-cell py-2 px-2 text-right whitespace-nowrap ${r.gain >= 0 ? 'text-positive' : 'text-negative'}`}>{eurFull(r.gain)}</td>
                  <td className={`py-2 pl-2 text-right font-medium whitespace-nowrap ${(r.periodReturn ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{pctCa(r.periodReturn ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink-muted text-[11px] mt-2">
            La rendibilitat de cada període no compta els diners que hi has posat (mètode Modified Dietz).
            {rows.filter(r => r.periodReturn !== null).length > table.length ? ` Es mostren els ${table.length} últims; l'Excel els té tots.` : ''}
          </p>
        </div>
      )}
    </div>
  );
});

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-10 h-10 rounded-xl bg-subtle flex items-center justify-center">
        <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <p className="text-ink-muted text-sm text-center max-w-xs">{text}</p>
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
    for (const h of portfolio.holdings.filter(h => h.quantity > 0)) {   // les venudes del tot no compten
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
      <div className="bg-surface border border-line rounded-lg p-5">
        <h3 className="text-ink font-semibold text-sm">Distribució per actiu</h3>
        <p className="text-ink-muted text-xs mt-0.5 mb-4">Avui, amb l&apos;últim valor liquidatiu de cada fons</p>
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
                  <span className="text-ink-muted text-xs truncate">{d.name}</span>
                </div>
                <span className="text-ink-muted text-xs flex-shrink-0 tabular-nums">
                  {fPct1(total > 0 ? (d.val / total) * 100 : 0)}
                </span>
              </div>
            ))}
            {byAsset.length > 5 && (
              <p className="text-ink-muted text-xs">+{byAsset.length - 5} més</p>
            )}
          </div>
        </div>
      </div>

      {/* Category bars */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <h3 className="text-ink font-semibold text-sm mb-4">Per categoria</h3>
        <div className="space-y-3">
          {byCategory.slice(0, 5).map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-ink-muted text-xs truncate pr-2">{c.name}</span>
                <span className="text-ink-muted text-xs flex-shrink-0 tabular-nums">{fPct1(c.pct)}</span>
              </div>
              <div className="h-1.5 bg-subtle rounded-full overflow-hidden">
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
  portfolio, metrics, valuation,
}: { portfolio: ClientPortfolio; metrics: PortfolioMetrics; valuation?: Valuation | null }) {
  const text  = useMemo(() => buildSummary(portfolio, metrics, valuation), [portfolio, metrics, valuation]);
  const isPos = metrics.pnlEur >= 0;
  const col   = isPos ? '#1e704c' : '#b42820';

  return (
    <div className="bg-surface border border-accent/15 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-accent-soft border border-accent/18 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-accent/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-accent/72 font-semibold text-sm">Resum executiu</h3>
      </div>

      <p className="text-ink-soft text-sm leading-relaxed">{text}</p>

      <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
        style={{ background: `${col}08`, border: `1px solid ${col}18`, color: col }}>
        {isPos ? '▲' : '▼'} {fPct(metrics.pnlPct)} · {isPos ? '+' : ''}{fEur(metrics.pnlEur, true)}
      </div>

      {portfolio.recommendations && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-ink-muted text-[10px] mb-2">Recomanació de l&apos;assessor</p>
          <p className="text-ink-soft text-xs leading-relaxed line-clamp-4">{portfolio.recommendations}</p>
        </div>
      )}
    </div>
  );
});

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
    <div className="bg-surface border border-line rounded-xl p-5 hover:border-line-strong transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: `${col}14`, border: `1px solid ${col}22` }}>
            <span className="font-semibold text-[11px]" style={{ color: col }}>
              {(h.assetSymbol || h.assetName).slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="text-ink font-semibold text-sm">{h.assetName}</span>
              {h.assetSymbol && (
                <span className="text-ink-muted text-xs font-mono bg-subtle px-1.5 py-0.5 rounded">{h.assetSymbol}</span>
              )}
              {priceSourceId !== 'internal' && <DataSourceBadge source={priceSourceId} variant="chip" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              {(() => { const cl = classifyFund(h.assetIsin, h.assetCategory, h.assetName); return <span>{assetTypeLabel(cl)} · {managementLabel(cl)}</span>; })()}
              {h.assetCategory && <><span className="opacity-40">·</span><span>{h.assetCategory}</span></>}
              {h.broker && <><span className="opacity-40">·</span><span>{h.broker}</span></>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-ink font-bold text-base tabular-nums">{fEur(val)}</div>
          <div className="text-sm font-semibold tabular-nums"
            style={{ color: pnlPos ? '#1e704c' : '#b42820' }}>{fPct(pnlPct)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <StCell label="P&L"            value={fEur(pnl)}              pnl={pnlPos ? 'pos' : 'neg'} />
        <StCell label="Preu actual"    value={fEur(h.currentPrice)}   />
        <StCell label="Preu entrada"   value={fEur(h.avgEntryPrice)}  />
        <StCell
          label="Participacions"
          value={h.quantity.toLocaleString('ca-ES', { maximumFractionDigits: 6 })}
        />
      </div>

      {/* Weight bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-ink-muted text-[10px]">Pes cartera</span>
          <span className="text-ink-muted text-[10px] tabular-nums">{fPct1(weight)}</span>
        </div>
        <div className="h-1 bg-subtle rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weight}%`, background: col }} />
        </div>
      </div>

      {/* Amb VL oficial ("manual" = sincronitzat de fund_navs) es diu en paraules de quin dia és el preu */}
      {h.priceLastUpdated && (priceSourceId === 'internal'
        ? <p className="mt-2 text-[11px] text-ink-muted">Valor liquidatiu oficial del {fDate(h.priceLastUpdated)}</p>
        : <DataSourceBadge source={priceSourceId} updatedAt={h.priceLastUpdated} variant="inline" className="mt-2 block" />)}
    </div>
  );
});

function StCell({ label, value, pnl }: { label: string; value: string; pnl?: 'pos' | 'neg' }) {
  const color = pnl === 'pos' ? '#1e704c' : pnl === 'neg' ? '#b42820' : '#3c4a45';
  return (
    <div className="bg-subtle border border-line rounded-lg px-2.5 py-2">
      <div className="font-semibold text-xs tabular-nums leading-tight" style={{ color }}>{value}</div>
      <div className="text-ink-muted text-[9px] mt-0.5">{label}</div>
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
        <div className="w-9 h-9 bg-subtle-strong border border-accent/28 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="w-px flex-1 bg-subtle min-h-[8px]" />
      </div>
      <div className="flex-1 pb-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-ink-soft text-xs font-semibold">{note.author}</span>
          <span className="text-ink-muted text-xs">·</span>
          <span className="text-ink-muted text-xs">{fDate(note.createdAt)}</span>
        </div>
        <div className="bg-surface border border-accent/10 rounded-lg rounded-tl-sm px-4 py-3.5">
          <p className="text-ink-soft text-sm leading-relaxed">{note.text}</p>
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

/** L'informe inicial (proposta aprovada: punt de partida, objectius i cartera) sempre a dalt de tot. */
function InitialReportCard() {
  return (
    <a href="/client/informe-inicial"
      className="flex items-center justify-between gap-4 p-5 rounded-xl border bg-subtle border-line hover:border-line-strong transition-all">
      <div>
        <p className="font-medium text-sm text-ink">Informe inicial</p>
        <p className="text-ink-muted text-xs mt-0.5">El punt de partida: la teva situació, els teus objectius i la cartera proposada</p>
      </div>
      <span className="text-ink-soft text-xs border border-line-strong px-3 py-1.5 rounded-lg flex-shrink-0">Veure</span>
    </a>
  );
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
    <div className="space-y-3">
    <InitialReportCard />
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-lg bg-subtle flex items-center justify-center">
        <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-ink-muted text-sm">Encara no hi ha cap informe mensual</p>
      <p className="text-ink-muted text-xs">El teu assessor publicarà els informes mensuals aquí.</p>
    </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <InitialReportCard />
      {items.map((r, i) => (
        <div key={r.id}
          className={`flex items-center justify-between gap-4 p-5 rounded-xl border transition-all ${
            i === 0
              ? 'bg-surface border-accent/18'
              : 'bg-surface border-line hover:border-line-strong'
          }`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              i === 0 ? 'bg-accent-soft border border-accent/18' : 'bg-subtle border border-line'
            }`}>
              <svg className={`w-5 h-5 ${i === 0 ? 'text-accent/60' : 'text-ink-muted'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-medium text-sm ${i === 0 ? 'text-ink' : 'text-ink-soft'}`}>
                  Informe {fDate(r.periodStart)} — {fDate(r.periodEnd)}
                </span>
                {i === 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-soft border border-accent/18 text-accent/62">
                    Darrer
                  </span>
                )}
              </div>
              <p className="text-ink-muted text-xs mt-0.5">
                Publicat: {fDate(r.createdAt)}{r.sentAt ? ' · Enviat per email' : ''}
              </p>
            </div>
          </div>
          <a href={`/client/informes/${encodeURIComponent(r.id)}`}
            className="flex items-center gap-1.5 text-ink-soft text-xs border border-line-strong px-3 py-1.5 rounded-lg hover:border-line-strong hover:text-ink transition-all flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Veure
          </a>
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
      <div className="w-12 h-12 rounded-lg bg-subtle flex items-center justify-center">
        <div className="w-5 h-5 rounded-full bg-subtle" />
      </div>
      <p className="text-ink-muted text-sm">{text}</p>
      {sub && <p className="text-ink-muted text-xs text-center max-w-xs">{sub}</p>}
    </div>
  );
}

function EmptyPortfolio({ name }: { name: string }) {
  return (
    <div className="theme-client min-h-screen bg-canvas">
      <ClientNav name={name} />
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-ink font-bold text-xl mb-2">Encara no hi ha cap inversió</h1>
        <p className="text-ink-muted text-sm leading-relaxed mb-6">
          Quan compris els fons de la teva proposta i el teu assessor ho registri, aquí veuràs quant val la teva cartera i com evoluciona.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/client/informe-inicial"
            className="inline-flex justify-center text-sm px-5 py-2.5 rounded-lg bg-accent text-accent-ink font-semibold hover:bg-accent-hover transition-colors">
            Veure el meu informe inicial
          </a>
          <a href="/client/guia"
            className="inline-flex justify-center text-sm px-5 py-2.5 rounded-lg border border-line text-ink-soft hover:border-line-strong transition-colors">
            Com funciona
          </a>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'posicions' | 'moviments' | 'informes' | 'fiscal' | 'notes';

export default function ClientCarteraPage() {
  const { data: session, status } = useSession();
  const router                    = useRouter();
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('overview');
  const [panelOpen, setPanelOpen] = useState(false);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [period, setPeriod]       = useState<Period>('month');   // agrupació del gràfic i de l'Excel
  const [history, setHistory]     = useState<Record<string, MixHistory | null> | null>(null);
  const [drawdowns, setDrawdowns] = useState<{ items: FundDD[]; profile: string | null }>({ items: [], profile: null });

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated') {
      fetch('/api/client/portfolio')
        .then(r => r.json())
        .then((d: { portfolio: ClientPortfolio | null; valuation?: Valuation | null; history?: Record<string, MixHistory | null> | null; drawdowns?: FundDD[]; profile?: string | null }) => {
          setPortfolio(d.portfolio ?? null);
          setValuation(d.valuation ?? null);
          setHistory(d.history ?? null);
          setDrawdowns({ items: d.drawdowns ?? [], profile: d.profile ?? null });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [status, router]);

  const name = useClientName((session?.user as { name?: string } | undefined)?.name) || 'Client';

  if (status === 'loading' || loading) return <SkeletonPage />;
  if (!portfolio) return <EmptyPortfolio name={name} />;

  const metrics         = computeMetrics(portfolio);
  const isPending       = (h: ClientHolding) =>
    h.priceSource === 'pending' || (h.currentPrice === 0 && h.quantity === 0);
  const activeHoldings  = portfolio.holdings.filter(h => !isPending(h) && h.quantity > 0);   // les venudes del tot no surten
  const pendingHoldings = portfolio.holdings.filter(h => isPending(h) && !isSoldOut(h, portfolio.transactions));
  const visibleNotes    = portfolio.advisorNotes.filter(n => n.isVisibleToClient);

  const TABS: { id: Tab; label: string; cnt?: number }[] = [
    { id: 'overview',  label: 'Resum'                                         },
    { id: 'posicions', label: 'Posicions',  cnt: activeHoldings.length        },
    { id: 'moviments', label: 'Moviments',  cnt: portfolio.transactions.length || undefined },
    { id: 'informes',  label: 'Informes'                                       },
    // Fiscalitat: visible per defecte, amb avís d'orientatiu (es pot apagar per variable)
    ...(CLIENT_TAX_REPORT_ENABLED ? [{ id: 'fiscal' as Tab, label: 'Fiscalitat' }] : []),
    { id: 'notes',     label: 'Notes',      cnt: visibleNotes.length || undefined },
  ];

  return (
    <div className="theme-client min-h-screen bg-canvas">

      {/* ── Navbar ── */}
      <ClientNav name={name} actions={<>
            {portfolio.nextFollowup && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-accent/52 border border-accent/12 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Seg.: {portfolio.nextFollowup}
              </span>
            )}
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 text-xs text-ink-muted border border-line px-2.5 py-1 rounded-lg hover:border-line-strong hover:text-ink-muted transition-all">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="hidden sm:inline">Fonts de dades</span>
            </button>
          </>} />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* ── Hero ── */}
        <HeroSection portfolio={portfolio} metrics={metrics} name={name} valuation={valuation} />

        {/* ── Tabs ── */}
        <div className="flex border-b border-line mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all relative ${
                tab === t.id
                  ? 'text-accent border-b-2 border-accent -mb-px'
                  : 'text-ink-muted hover:text-ink-soft'
              }`}>
              {t.label}
              {(t.cnt ?? 0) > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-tight ${
                  tab === t.id ? 'bg-accent/14 text-accent' : 'bg-subtle text-ink-muted'
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
                <EvolutionChart portfolio={portfolio} metrics={metrics} valuation={valuation} period={period} onPeriod={setPeriod} />
                <PortfolioExcelButton baseUrl="/api/client/portfolio/excel" className="justify-end -mt-2" period={period} />
                <DistributionPanel portfolio={portfolio} total={metrics.currentValue} />
                {activeHoldings.length > 0 && (
                  <div className="bg-surface border border-line rounded-lg p-5">
                    <h3 className="text-ink font-semibold text-sm">Repartiment de la cartera</h3>
                    <p className="text-ink-muted text-xs mt-0.5 mb-4">Renda variable i fixa, i fons de gestió activa o passiva, segons el valor d&apos;avui</p>
                    <AllocationSummary items={holdingMixItems(activeHoldings)} />
                  </div>
                )}
              </div>
              <div className="space-y-5">
                <ExecutiveSummary portfolio={portfolio} metrics={metrics} valuation={valuation} />
              </div>
            </div>

            <MixHistoryPanel history={history} />

            <FundDrawdowns items={drawdowns.items} defaultOpen={showDrawdownsByDefault(drawdowns.profile)}
              title="Caigudes històriques dels teus fons" />

            {/* Latest note preview */}
            {visibleNotes.length > 0 && (
              <div className="bg-surface border border-accent/10 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-ink font-semibold text-sm">Última nota de l&apos;assessor</h3>
                  {visibleNotes.length > 1 && (
                    <button onClick={() => setTab('notes')}
                      className="text-accent/42 hover:text-accent/72 text-xs transition-colors">
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
              <div className="bg-warning/[0.04] border border-warning/18 rounded-lg p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning/10 border border-warning/18 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-warning/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-warning/85 font-semibold text-sm mb-1">
                    {pendingHoldings.length} posicion{pendingHoldings.length > 1 ? 's' : ''} pendent{pendingHoldings.length > 1 ? 's' : ''} de confirmar
                  </p>
                  <p className="text-ink-muted text-xs leading-relaxed">
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
                      <div className="h-px flex-1 bg-subtle" />
                      <span className="text-warning/40 text-[9px]">Propostes pendents</span>
                      <div className="h-px flex-1 bg-subtle" />
                    </div>
                    {pendingHoldings.map(h => (
                      <div key={h.id} className="bg-surface border border-warning/10 rounded-xl p-4 opacity-55">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-ink-muted font-medium text-sm">{h.assetName}</span>
                            <p className="text-ink-muted text-xs mt-0.5">
                              {h.assetCategory}{h.broker ? ` · ${h.broker}` : ''}
                            </p>
                            {h.notes && <p className="text-ink-muted text-xs mt-1 italic">{h.notes}</p>}
                          </div>
                          <span className="text-warning/60 text-xs px-2.5 py-1.5 rounded-xl bg-warning/6 border border-warning/12 flex-shrink-0">
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
                      className="bg-surface border border-line rounded-xl p-4 flex items-center justify-between gap-4 hover:border-line transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                          style={{ background: m.bg, border: `1px solid ${m.color}18`, color: m.color }}>
                          {m.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</span>
                            <span className="text-ink-soft text-sm truncate">{tx.assetName || tx.ticker || '—'}</span>
                          </div>
                          <div className="text-ink-muted text-xs mt-0.5">
                            {fDate(tx.date)}{tx.broker ? ` · ${tx.broker}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-ink font-semibold text-sm tabular-nums">{fEur(tx.totalEur)}</div>
                        {tx.quantity > 0 && (
                          <div className="text-ink-muted text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>
                        )}
                        {tx.commission > 0 && (
                          <div className="text-ink-muted text-xs">Com. {fEur(tx.commission)}</div>
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

        {/* FISCALITAT */}
        {tab === 'fiscal' && CLIENT_TAX_REPORT_ENABLED && <TaxReportView url="/api/client/tax-report" />}

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
