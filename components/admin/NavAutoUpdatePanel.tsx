// components/admin/NavAutoUpdatePanel.tsx
// Resum de l'actualització automàtica diària dels preus (13:00) i botó per fer-la ara.
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AutoUpdateSummary, FundUpdate } from '@/lib/navAutoUpdate';

const card  = 'bg-surface border border-line rounded-lg p-5';
const ghost = 'px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 border border-line-strong text-ink-soft hover:text-ink hover:bg-subtle';

const when = (iso: string) => new Date(iso).toLocaleString('ca-ES', {
  timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const day = (d: string | null) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—';

const GROUPS: { status: FundUpdate['status']; title: string; cls: string; hint: string }[] = [
  { status: 'failed', title: 'No s\'han pogut actualitzar', cls: 'text-negative', hint: 'Entra\'ls a mà a «Afegir un preu» o espera la propera execució.' },
  { status: 'stale',  title: 'La gestora encara no ha publicat preus nous', cls: 'text-warning', hint: 'Normalment es resol sol en un o dos dies.' },
  { status: 'manual', title: 'Sense descàrrega automàtica (cal entrar-los a mà)', cls: 'text-ink-soft', hint: '' },
];

export default function NavAutoUpdatePanel({ onUpdated }: { onUpdated?: () => void }) {
  const [last, setLast] = useState<AutoUpdateSummary | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');
  const [cronOk, setCronOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/fund-navs/auto');
      const d = await res.json();
      if (res.ok) { setLast(d.last); setCronOk(d.cronConfigured !== false); } else setErr(d.error ?? 'No s\'ha pogut carregar');
    } catch { setErr('Error de connexió'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/fund-navs/auto', { method: 'POST' });
      const d = await res.json();
      if (res.ok) { setLast(d.last); onUpdated?.(); } else setErr(d.error ?? 'No s\'ha pogut actualitzar');
    } catch { setErr('Error de connexió'); }
    setBusy(false);
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-ink font-semibold">Actualització automàtica</h3>
          <p className="text-ink-muted text-xs mt-1 max-w-2xl">
            Cada dia a les 13:00 l&apos;app descarrega de la web de cada gestora el valor liquidatiu oficial del dia anterior
            i actualitza les carteres dels clients. Alguns fons de Luxemburg i Irlanda publiquen amb un o dos dies de retard.
          </p>
        </div>
        <button onClick={runNow} disabled={busy} className={ghost}>{busy ? 'Actualitzant… (pot trigar un minut)' : 'Actualitzar ara'}</button>
      </div>

      {!cronOk && (
        <p className="text-warning text-sm mt-3">
          L&apos;actualització de les 13:00 encara no funciona: falta afegir la variable <b>CRON_SECRET</b> a Vercel
          (Settings → Environment Variables, entorn Production) i tornar a publicar. El botó «Actualitzar ara» sí que funciona.
        </p>
      )}
      {err && <p className="text-negative text-sm mt-3">{err}</p>}
      {last === null && <p className="text-ink-muted text-sm mt-3">Encara no s&apos;ha fet cap actualització automàtica.</p>}
      {last && (
        <div className="mt-4 space-y-4">
          <p className="text-ink-soft text-sm">
            Última: <b className="text-ink">{when(last.finishedAt)}</b>{last.trigger === 'admin' ? ' (manual)' : ''} ·{' '}
            <span className="text-positive">{last.counts.updated} actualitzats</span> ·{' '}
            {last.counts.up_to_date} ja estaven al dia ·{' '}
            <span className={last.counts.failed ? 'text-negative font-semibold' : ''}>{last.counts.failed} amb errors</span>
            {last.holdingsUpdated ? ` · ${last.holdingsUpdated} posicions de clients actualitzades` : ''}
          </p>
          {last.crypto?.map(c => (
            <p key={c.symbol} className="text-sm">
              <span className={c.status === 'failed' ? 'text-negative font-semibold' : 'text-ink-soft'}>
                Bitcoin (BTC/EUR, tancament diari): {c.status === 'failed' ? 'error' : c.status === 'updated' ? `+${c.added} dies` : 'al dia'}
              </span>
              <span className="text-ink-muted text-xs"> · Últim preu: {day(c.lastDate)} · {c.source}{c.message ? ` · ${c.message}` : ''}</span>
            </p>
          ))}
          {GROUPS.map(g => {
            const list = last.funds.filter(f => f.status === g.status);
            if (!list.length) return null;
            return (
              <div key={g.status}>
                <p className={`text-sm font-semibold ${g.cls}`}>{g.title} ({list.length})</p>
                {g.hint && <p className="text-ink-muted text-xs mb-1">{g.hint}</p>}
                <ul className="text-sm divide-y divide-line">
                  {list.map(f => (
                    <li key={f.isin} className="py-1.5 flex flex-col sm:flex-row sm:gap-3">
                      <span className="text-ink sm:w-1/2">{f.name} <span className="text-ink-muted font-mono text-xs">{f.isin}</span></span>
                      <span className="text-ink-muted text-xs sm:w-1/2">Últim preu: {day(f.lastDate)} · {f.source}{f.message ? ` · ${f.message}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
