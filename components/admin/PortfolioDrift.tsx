'use client';

import { useEffect, useState } from 'react';
import type { PortfolioAlert } from '@/lib/portfolioAlertsServer';

const pct = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} %`;

/** Pes objectiu (proposta aprovada) vs. pes actual de cada fons, i revisions pendents. */
export default function PortfolioDrift({ clientId }: { clientId: string }) {
  const [alert, setAlert] = useState<PortfolioAlert | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/portfolio-alerts?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d: { alerts: PortfolioAlert[]; threshold: number }) => {
        if (!alive) return;
        setAlert(d.alerts[0] ?? null); setThreshold(d.threshold); setState('ok');
      })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [clientId]);

  if (state === 'loading') return <div className="bg-surface border border-line rounded-lg p-5 mb-4 text-ink-muted text-xs">Calculant la desviació…</div>;
  if (state === 'error') return <div className="bg-surface border border-line rounded-lg p-5 mb-4 text-negative text-xs">No s&apos;ha pogut calcular la desviació.</div>;
  if (!alert) return null;

  const { drift, review } = alert;
  return (
    <div className="bg-surface border border-line rounded-lg p-5 mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ink font-semibold text-sm">Pes objectiu vs. pes actual</h3>
        {alert.targetVersion !== null
          ? <span className="text-ink-muted text-xs">Objectiu: proposta v{alert.targetVersion} · llindar ±{threshold} pp</span>
          : <span className="text-ink-muted text-xs">No hi ha cap proposta aprovada per comparar</span>}
      </div>

      {review.due && (
        <ul className="text-warning text-xs space-y-0.5">
          {review.detail.filter((_, i) => review.reasons[i] !== 'no_followup').map(d => <li key={d}>⚠ {d}</li>)}
        </ul>
      )}

      {drift && (
        <>
          <p className={`text-xs ${drift.outOfBand.length ? 'text-warning' : 'text-positive'}`}>
            {drift.outOfBand.length
              ? `${drift.outOfBand.length} fons fora del llindar. Desviació màxima: ${pct(drift.maxAbsDiff)}.`
              : 'Tots els fons són dins del llindar: no cal rebalancejar.'}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-muted text-[11px] font-medium">
                  <th className="text-left font-medium pb-2 pr-2">Fons</th>
                  <th className="text-right font-medium pb-2 pr-2">Objectiu</th>
                  <th className="text-right font-medium pb-2 pr-2">Actual</th>
                  <th className="text-right font-medium pb-2">Diferència</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {drift.rows.map(r => {
                  const out = Math.abs(r.diff) >= threshold;
                  return (
                    <tr key={r.isin}>
                      <td className="py-1.5 pr-2 text-ink">{r.name}<span className="text-ink-muted"> · {r.isin}</span></td>
                      <td className="py-1.5 pr-2 text-right text-ink-soft">{pct(r.target)}</td>
                      <td className="py-1.5 pr-2 text-right text-ink">{pct(r.current)}</td>
                      <td className={`py-1.5 text-right font-semibold ${out ? 'text-warning' : 'text-ink-soft'}`}>
                        {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} pp
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-ink-muted text-[11px]">Pes actual segons el valor de mercat (participacions × últim preu de cada posició).</p>
        </>
      )}
    </div>
  );
}
