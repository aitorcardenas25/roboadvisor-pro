'use client';
// Caigudes històriques de cada fons: caiguda màxima i les 3 més grans, amb
// el període de dades de cada fons i l'avís que són dades passades.
// Es fa servir a l'informe inicial, a «La meva cartera» i a l'admin.
import { useState } from 'react';
import {
  DRAWDOWN_DISCLAIMER, durationLabel, monthLabel, recoveryLabel, type FundDrawdowns as FundDD,
} from '@/lib/drawdowns';

const pct = (n: number) => `${n.toLocaleString('ca-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export function FundDrawdownCard({ d }: { d: FundDD }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">{d.name}</p>
          <p className="text-ink-muted text-[11px]">
            {d.isin}
            {d.windowStart && d.windowEnd && <> · Dades de {monthLabel(d.windowStart)} a {monthLabel(d.windowEnd)} ({d.years.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} anys, preu de final de mes)</>}
          </p>
        </div>
        {d.maxDrawdown !== null && (
          <p className="text-sm whitespace-nowrap">
            <span className="text-ink-muted text-xs">Caiguda màxima </span>
            <span className="text-negative font-semibold">{d.maxDrawdown === 0 ? 'cap' : pct(d.maxDrawdown)}</span>
          </p>
        )}
      </div>

      {d.episodes.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-muted border-b border-line text-left">
                <th className="font-medium py-1.5 pr-2">#</th>
                <th className="font-medium py-1.5 px-2">Màxim previ</th>
                <th className="font-medium py-1.5 px-2">Punt més baix</th>
                <th className="font-medium py-1.5 px-2 text-right">Caiguda</th>
                <th className="font-medium py-1.5 px-2">Temps caient</th>
                <th className="font-medium py-1.5 pl-2">Temps per recuperar-se</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.episodes.map((e, i) => (
                <tr key={e.peakDate} className="text-ink-soft">
                  <td className="py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{monthLabel(e.peakDate)}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{monthLabel(e.troughDate)}</td>
                  <td className="py-1.5 px-2 text-right text-negative font-medium whitespace-nowrap">{pct(e.depthPct)}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">{durationLabel(e.monthsToTrough)}</td>
                  <td className={`py-1.5 pl-2 ${e.recoveryDate ? '' : 'text-warning'}`}>{recoveryLabel(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.episodes.length < 3 && d.maxDrawdown !== null && (
            <p className="text-ink-muted text-[11px] mt-1">En aquest període no hi ha hagut {d.episodes.length === 1 ? 'cap altra caiguda' : 'més caigudes'} de més del 0,5 %.</p>
          )}
        </div>
      )}
      {d.maxDrawdown === 0 && <p className="text-ink-muted text-[11px] mt-1">En aquest període el fons no ha baixat mai més d&apos;un 0,5 % des d&apos;un màxim (amb preus de final de mes).</p>}

      {d.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {d.warnings.map(w => <li key={w} className="text-warning text-[11px]">{w}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Secció plegable amb les caigudes de diversos fons. */
export default function FundDrawdowns({ items, title = 'Caigudes històriques dels fons', intro, defaultOpen = false, className = '' }: {
  items: FundDD[]; title?: string; intro?: string; defaultOpen?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;
  return (
    <section className={`bg-surface border border-line rounded-lg p-5 sm:p-6 ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-ink font-semibold text-sm">{title}</span>
          <span className="block text-ink-muted text-xs mt-0.5">
            {intro ?? 'Quant ha arribat a baixar cada fons des d’un màxim, quan, i quant va tardar a recuperar-se.'}
          </span>
        </span>
        <span className="text-ink-muted text-xs whitespace-nowrap">{open ? 'Amagar' : 'Veure-les'}</span>
      </button>
      {open && (
        <>
          <div className="mt-4 divide-y divide-line">
            {items.map(d => <FundDrawdownCard key={d.isin} d={d} />)}
          </div>
          <p className="text-ink-muted text-[11px] mt-4 leading-relaxed">
            <span className="font-semibold">Important.</span>{' '}{DRAWDOWN_DISCLAIMER}
          </p>
        </>
      )}
    </section>
  );
}
