'use client';

// Com hauria anat la cartera d'avui els últims 1, 3, 5 o 10 anys, i cada fons sol.
// Si l'assessor ha enviat una proposta diferent, també la proposta (mateixos mesos).
// Els càlculs es fan al servidor (lib/mixHistory.ts); aquí només es dibuixen.

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MixHistory } from '@/lib/mixHistory';

const WINDOWS = ['1', '3', '5', '10'] as const;
type W = typeof WINDOWS[number];

const PORTFOLIO_COLOR = '#1e4d3f';
const PROPOSAL_COLOR = '#a8661a';
const FUND_COLORS = ['#1f5d8c', '#8a5a00', '#5b5f7a', '#b04a7a', '#3a7d8c', '#7a6a3a', '#6b4fa0', '#4a7a3a'];

const eur = (n: number) => n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const eur0 = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 0 }) + ' €';
const pct = (n: number | null, sign = true) => n === null ? '—'
  : `${sign && n >= 0 ? '+' : ''}${n.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const tone = (n: number | null) => n === null ? 'text-ink-muted' : n >= 0 ? 'text-positive' : 'text-negative';
const fDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fMonth = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.toLocaleDateString('ca-ES', { month: 'short', timeZone: 'UTC' }).replace(/^de |^d’|^d'/, '')} ${String(d.getUTCFullYear()).slice(2)}`;
};
const years = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} ${n === 1 ? 'any' : 'anys'}`;

export interface ProposalMix { version: number; sharedAt?: string; history: Record<string, MixHistory | null> }

export default function MixHistoryPanel({ history, proposal }: { history: Record<string, MixHistory | null> | null; proposal?: ProposalMix | null }) {
  const available = WINDOWS.filter(w => history?.[w]);
  const [win, setWin] = useState<W>(available.at(-1) ?? '5');
  const [shown, setShown] = useState<Set<string>>(new Set());
  const h = history?.[win] ?? null;
  const ph = proposal?.history[win] ?? null;   // mateixos mesos que la cartera (calculat al servidor)

  const data = useMemo(() => {
    const prop = new Map(ph?.points.map(p => [p.date.slice(0, 7), p.value]) ?? []);
    return h?.points.map(p => ({ date: p.date, cartera: p.value, proposta: prop.get(p.date.slice(0, 7)), ...p.funds })) ?? [];
  }, [h, ph]);
  if (!available.length || !h) return null;
  const propLabel = proposal ? `Proposta de l'assessor (versió ${proposal.version})` : '';

  const colorOf = (isin: string) => FUND_COLORS[h.funds.findIndex(f => f.isin === isin) % FUND_COLORS.length];
  const toggle = (isin: string) => setShown(s => { const n = new Set(s); if (n.has(isin)) n.delete(isin); else n.add(isin); return n; });
  const final = h.points.at(-1)!.value;
  const p = h.portfolio;

  return (
    <div className="bg-surface border border-line rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="max-w-xl">
          <h3 className="text-ink font-semibold text-sm">
            {ph ? 'La teva cartera i la proposta de l\u2019assessor en el passat' : 'Com hauria anat la teva cartera d\u2019avui'}
          </h3>
          <p className="text-ink-muted text-xs mt-0.5">
            {ph
              ? `Simulació: si fa ${years(h.years)} haguessis posat ${eur0(h.initial)} en el repartiment que tens avui, o en el de la proposta, i no l'haguessis tocat. Mateixos mesos per a les dues, amb els valors liquidatius oficials de cada fons.`
              : `Simulació: si fa ${years(h.years)} haguessis comprat ${eur0(h.initial)} amb el mateix repartiment que tens avui i no l'haguessis tocat. Amb els valors liquidatius oficials de cada fons.`}
          </p>
        </div>
        <div role="group" aria-label="Anys" className="flex rounded-lg border border-line overflow-hidden text-xs">
          {WINDOWS.map(w => (
            <button key={w} type="button" disabled={!history?.[w]} onClick={() => setWin(w)} aria-pressed={win === w}
              className={`px-3 py-1.5 transition-colors disabled:opacity-40 ${win === w ? 'bg-accent text-accent-ink font-semibold' : 'text-ink-soft hover:bg-subtle'}`}>
              {w} {w === '1' ? 'any' : 'anys'}
            </button>
          ))}
        </div>
      </div>

      {ph && <p className="text-ink-soft text-xs font-medium mb-2">La teva cartera</p>}
      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${ph ? 'mb-4' : 'mb-5'}`}>
        <Stat label={`${eur0(h.initial)} s'haurien convertit en`} value={eur(final)} cls={tone(final - h.initial)} />
        <Stat label="Rendibilitat anual" value={pct(p.annualReturn)} cls={tone(p.annualReturn)} />
        <Stat label="Pitjor caiguda" value={pct(p.maxDrawdown)} cls="text-negative" hint="Des d'un màxim fins al punt més baix" />
        <Stat label="Pitjor any" value={pct(p.worst12M)} cls={tone(p.worst12M)} hint="Pitjors 12 mesos seguits" />
      </div>
      {ph && (
        <>
          <p className="text-ink-soft text-xs font-medium mb-2">{propLabel}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <Stat label={`${eur0(ph.initial)} s'haurien convertit en`} value={eur(ph.points.at(-1)!.value)} cls={tone(ph.points.at(-1)!.value - ph.initial)} />
            <Stat label="Rendibilitat anual" value={pct(ph.portfolio.annualReturn)} cls={tone(ph.portfolio.annualReturn)} />
            <Stat label="Pitjor caiguda" value={pct(ph.portfolio.maxDrawdown)} cls="text-negative" hint="Des d'un màxim fins al punt més baix" />
            <Stat label="Pitjor any" value={pct(ph.portfolio.worst12M)} cls={tone(ph.portfolio.worst12M)} hint="Pitjors 12 mesos seguits" />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-subtle text-ink font-medium">
          <span className="w-3 h-0.5 rounded" style={{ background: PORTFOLIO_COLOR }} /> La teva cartera
        </span>
        {ph && (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-subtle text-ink font-medium">
            <span className="w-3 h-0.5 rounded" style={{ background: PROPOSAL_COLOR }} /> {propLabel}
          </span>
        )}
        {h.funds.map(f => (
          <button key={f.isin} type="button" onClick={() => toggle(f.isin)} aria-pressed={shown.has(f.isin)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${shown.has(f.isin) ? 'border-line-strong text-ink' : 'border-line text-ink-muted hover:text-ink-soft'}`}>
            <span className="w-3 h-0.5 rounded" style={{ background: shown.has(f.isin) ? colorOf(f.isin) : '#c4cbc7' }} />
            {f.name}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="#e6e9e7" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#7a8681', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={fMonth} minTickGap={24} />
          <YAxis tick={{ fill: '#7a8681', fontSize: 10 }} axisLine={false} tickLine={false} width={52} domain={['auto', 'auto']}
            tickFormatter={(v: number) => `${(v / 1000).toLocaleString('ca-ES', { maximumFractionDigits: 1 })}K`} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e6e9e7', borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => fDate(String(v))}
            formatter={(v, key) => [eur(Number(v)), key === 'cartera' ? 'La teva cartera' : key === 'proposta' ? propLabel : h.funds.find(f => f.isin === key)?.name ?? String(key)]} />
          {h.funds.filter(f => shown.has(f.isin)).map(f => (
            <Line key={f.isin} type="linear" dataKey={f.isin} stroke={colorOf(f.isin)} strokeWidth={1.25} dot={false} isAnimationActive={false} />
          ))}
          {ph && <Line type="linear" dataKey="proposta" stroke={PROPOSAL_COLOR} strokeWidth={2.5} strokeDasharray="6 3" dot={false} connectNulls isAnimationActive={false} />}
          <Line type="linear" dataKey="cartera" stroke={PORTFOLIO_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-ink-muted text-[11px] mt-2">
        Toca un fons per veure&apos;l al gràfic, com si hi haguessis posat tots els {eur0(h.initial)}.
      </p>

      <p className="mt-5 text-ink-muted text-[11px]">Del {fDate(h.start)} al {fDate(h.end)}</p>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-muted border-b border-line">
              <th className="text-left font-medium py-2 pr-3">Fons</th>
              <th className="text-right font-medium py-2 px-2">Pes avui</th>
              <th className="hidden sm:table-cell text-right font-medium py-2 px-2">Total</th>
              <th className="text-right font-medium py-2 px-2">Anual</th>
              <th className="text-right font-medium py-2 px-2">Pitjor caiguda</th>
              <th className="hidden sm:table-cell text-right font-medium py-2 pl-2">Pitjor any</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <Row name="La teva cartera" weight={100} s={p} strong />
            {ph && <Row name={propLabel} weight={100} s={ph.portfolio} strong />}
            {h.funds.map(f => <Row key={f.isin} name={f.name} weight={f.weight} s={f} />)}
          </tbody>
        </table>
      </div>

      <p className="text-ink-muted text-[11px] mt-3 leading-relaxed">
        {h.limitedBy && `Només es poden mostrar ${years(h.years)} perquè ${h.limitedBy} no té preus oficials d'abans. `}
        {!history?.['10'] && '10 anys només surt quan tots els fons tenen preus oficials de 10 anys. '}
        {ph && <>El detall dels fons de la proposta és a <a href="/client/informe-inicial" className="text-accent hover:underline">l&apos;informe</a>. </>}
        És una simulació amb preus passats: no és el que has guanyat tu (això és el gràfic d&apos;evolució de dalt)
        i no vol dir que en el futur passi el mateix. No inclou comissions de compra ni impostos.
      </p>
    </div>
  );
}

function Stat({ label, value, cls, hint }: { label: string; value: string; cls: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-subtle px-3 py-2.5" title={hint}>
      <p className="text-ink-muted text-[11px] leading-tight">{label}</p>
      <p className={`text-base font-semibold mt-1 ${cls}`}>{value}</p>
    </div>
  );
}

function Row({ name, weight, s, strong }: { name: string; weight: number; s: { totalReturn: number | null; annualReturn: number | null; maxDrawdown: number | null; worst12M: number | null }; strong?: boolean }) {
  return (
    <tr className={strong ? 'font-semibold' : ''}>
      <td className="py-2 pr-3 text-ink">{name}</td>
      <td className="py-2 px-2 text-right text-ink-soft whitespace-nowrap">{pct(weight, false)}</td>
      <td className={`hidden sm:table-cell py-2 px-2 text-right whitespace-nowrap ${tone(s.totalReturn)}`}>{pct(s.totalReturn)}</td>
      <td className={`py-2 px-2 text-right whitespace-nowrap ${tone(s.annualReturn)}`}>{pct(s.annualReturn)}</td>
      <td className="py-2 px-2 text-right whitespace-nowrap text-negative">{pct(s.maxDrawdown)}</td>
      <td className={`hidden sm:table-cell py-2 pl-2 text-right whitespace-nowrap ${tone(s.worst12M)}`}>{pct(s.worst12M)}</td>
    </tr>
  );
}
