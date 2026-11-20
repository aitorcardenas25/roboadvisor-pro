'use client';

// Progrés cap als objectius del client. El càlcul és al servidor
// (lib/goalProgress.ts, via /api/client/goals); aquí només es mostra.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GoalsSummary, GoalStatus } from '@/lib/goalProgress';

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const STATUS: Record<GoalStatus, { label: string; cls: string; bar: string }> = {
  'assolit':     { label: 'Aconseguit',      cls: 'text-positive bg-positive/10 border-positive/20', bar: 'bg-positive' },
  'va-be':       { label: 'Vas bé',          cls: 'text-positive bg-positive/10 border-positive/20', bar: 'bg-accent' },
  'cal-ajustar': { label: 'Cal ajustar',     cls: 'text-warning bg-warning/10 border-warning/30',    bar: 'bg-warning' },
  'vencut':      { label: 'Data passada',    cls: 'text-ink-muted bg-subtle border-line',            bar: 'bg-ink-muted' },
  'sense-dades': { label: 'Falten dades',    cls: 'text-ink-muted bg-subtle border-line',            bar: 'bg-ink-muted' },
};

export default function GoalsProgress({ endpoint = '/api/client/goals' }: { endpoint?: string }) {
  const [data, setData]   = useState<GoalsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(endpoint, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError('No s\'han pogut carregar els objectius.'); });
    return () => { alive = false; };
  }, [endpoint]);

  if (error) return <p className="text-negative text-sm mb-6">{error}</p>;
  if (!data) return (
    <div className="bg-surface border border-line rounded-lg p-5 mb-6" role="status" aria-label="Carregant objectius">
      <div className="h-4 w-40 bg-subtle rounded animate-pulse" />
    </div>
  );

  return (
    <section className="bg-surface border border-line rounded-lg p-5 mb-6" aria-labelledby="goals-title">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id="goals-title" className="text-ink font-semibold text-base">Els teus objectius</h2>
        <Link href="/client/finances" className="text-xs text-ink-muted hover:text-accent">Editar objectius</Link>
      </div>

      {data.goals.length === 0 ? (
        <p className="text-ink-muted text-sm">
          Encara no tens cap objectiu. Afegeix-ne un (per exemple, l&apos;entrada d&apos;un pis) a{' '}
          <Link href="/client/finances" className="text-accent hover:underline">Les meves finances</Link> i aquí veuràs com vas.
        </p>
      ) : (
        <ul className="space-y-5">
          {data.goals.map((g, i) => {
            const s = STATUS[g.status];
            return (
              <li key={`${g.description}-${i}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium truncate">
                      {g.description}{g.targetYear ? <span className="text-ink-muted font-normal"> · {g.targetYear}</span> : null}
                    </p>
                    {g.amount !== null && (
                      <p className="text-ink-soft text-sm tabular-nums">
                        {eur(g.saved)} <span className="text-ink-muted">de {eur(g.amount)}</span>
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${s.cls}`}>{s.label}</span>
                </div>
                {g.progressPct !== null && (
                  <div className="mt-2 h-2 bg-subtle rounded-full overflow-hidden" role="progressbar"
                    aria-valuenow={g.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.description}: ${g.progressPct} %`}>
                    <div className={`h-full ${s.bar}`} style={{ width: `${g.progressPct}%` }} />
                  </div>
                )}
                <p className="text-ink-muted text-xs mt-1.5">{g.message}</p>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-5 text-xs text-ink-muted">
        <summary className="cursor-pointer hover:text-ink-soft">Com ho calculem</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          {data.assumptions.map(a => <li key={a}>{a}</li>)}
          {data.monthlyMargin !== null && <li>El teu marge per estalviar ara és de {eur(data.monthlyMargin)} al mes.</li>}
        </ul>
      </details>
    </section>
  );
}
