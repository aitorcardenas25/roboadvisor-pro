// components/admin/NavBackfillPanel.tsx
// Carrega l'històric diari complet de cada fons des de la seva font oficial
// (lib/navBackfill.ts), d'un fons en un, amb el resultat de cadascun.
'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/navMath';
import type { BackfillResult } from '@/lib/navBackfill';

interface Candidate { isin: string; name: string; source: string; firstDate: string }

const STATUS: Record<BackfillResult['status'], { label: string; cls: string }> = {
  loaded:      { label: 'Carregat', cls: 'text-positive' },
  nothing_new: { label: 'Ja era complet', cls: 'text-ink-soft' },
  failed:      { label: 'No s\'ha carregat', cls: 'text-negative' },
  no_source:   { label: 'Sense font', cls: 'text-warning' },
};

export default function NavBackfillPanel({ onDone }: { onDone?: () => void }) {
  const [list, setList]       = useState<Candidate[] | null>(null);
  const [results, setResults] = useState<BackfillResult[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [err, setErr]         = useState('');

  async function loadList(): Promise<Candidate[] | null> {
    setErr('');
    const res = await fetch('/api/admin/fund-navs/backfill').catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (!res?.ok) { setErr(d?.error ?? 'No s\'ha pogut llegir la llista de fons'); return null; }
    setList(d.funds); return d.funds;
  }

  async function runAll() {
    const funds = list ?? await loadList();
    if (!funds?.length) return;
    if (!confirm(`Carregar l'històric diari complet de ${funds.length} fons des de les webs oficials? Pot trigar uns minuts. Els preus que ja tens no es toquen.`)) return;
    setResults([]);
    for (const f of funds) {
      setRunning(f.name);
      try {
        const res = await fetch('/api/admin/fund-navs/backfill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isin: f.isin }) });
        const d = await res.json().catch(() => ({}));
        const r: BackfillResult = d.result ?? { isin: f.isin, name: f.name, source: f.source, status: 'failed', added: 0, firstDate: null, checked: 0, skipped: 0, message: d.error ?? `error ${res.status}` };
        setResults(prev => [...prev, r]);
      } catch {
        setResults(prev => [...prev, { isin: f.isin, name: f.name, source: f.source, status: 'failed', added: 0, firstDate: null, checked: 0, skipped: 0, message: 'error de connexió' }]);
      }
    }
    setRunning(null);
    onDone?.();
  }

  const loaded = results.filter(r => r.status === 'loaded');
  const failed = results.filter(r => r.status === 'failed');

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="text-ink font-semibold">Històric complet</h3>
          <p className="text-ink-muted text-xs mt-1">
            Baixa tots els preus diaris de cada fons des que existeix, de la web oficial de la gestora (la mateixa font que l&apos;actualització diària).
            Abans de desar, comprova que coincideixen amb els preus que ja tens; si no, no desa res d&apos;aquell fons. Serveix per calcular les caigudes
            des de l&apos;inici. Cobas, Polar, Pictet i Amundi no ho permeten des del servidor.
          </p>
        </div>
        <button onClick={runAll} disabled={!!running}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent hover:bg-accent-hover text-accent-ink disabled:opacity-40">
          {running ? 'Carregant…' : 'Carregar l\'històric complet'}
        </button>
      </div>
      {err && <p className="text-negative text-sm mt-3">{err}</p>}
      {(running || results.length > 0) && (
        <div className="mt-4">
          <p className="text-ink-soft text-xs">
            {results.length}{list ? ` de ${list.length}` : ''} fons · {loaded.length} carregats ({loaded.reduce((s, r) => s + r.added, 0).toLocaleString('ca-ES')} preus nous){failed.length ? ` · ${failed.length} amb problemes` : ''}
            {running && <> · ara: {running}</>}
          </p>
          <div className="max-h-72 overflow-y-auto mt-2">
            <table className="w-full text-xs">
              <tbody className="divide-y divide-line">
                {results.map(r => (
                  <tr key={r.isin} className="text-ink-soft">
                    <td className="py-1.5 pr-2"><span className="text-ink">{r.name}</span> <span className="text-ink-muted font-mono">{r.isin}</span></td>
                    <td className={`py-1.5 px-2 whitespace-nowrap ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{r.firstDate ? `des del ${fmtDate(r.firstDate)}` : ''}</td>
                    <td className="py-1.5 pl-2">{r.status === 'loaded' ? `+${r.added.toLocaleString('ca-ES')} preus${r.replaced ? ' (sèrie ajustada pels dividends, reescrita)' : ''}${r.holdingsUpdated ? ` · ${r.holdingsUpdated} posicions de clients al preu nou` : ''}` : r.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
