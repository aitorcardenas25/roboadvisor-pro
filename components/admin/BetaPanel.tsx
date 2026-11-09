'use client';

// Ús de la beta: quants dies entra cada client per setmana. Per a la decisió del mes 3.
import { useEffect, useState } from 'react';
import type { UsageSummary } from '@/lib/betaActivity';

const card = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' }) : '—');
const fmtWeek = (d: string) => { const [, m, day] = d.split('-'); return `${day}/${m}`; };

function cellClass(n: number) {
  if (n === 0) return 'bg-white/[0.04] text-white/20';
  if (n === 1) return 'bg-emerald-500/25 text-emerald-200';
  if (n <= 3)  return 'bg-emerald-500/50 text-white';
  return 'bg-emerald-400/80 text-[#0d1f1a] font-semibold';
}

export default function BetaPanel() {
  const [data, setData]       = useState<UsageSummary | null>(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/beta', { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error('No s\'han pogut carregar les dades d\'ús.'); return r.json(); })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16" role="status" aria-label="Carregant"><div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" /></div>;
  if (error || !data) return <p className="text-red-400 py-16 text-center">{error || 'Sense dades'}</p>;

  const total     = data.clients.length;
  const consented = data.clients.filter(c => c.consentAt).length;
  const thisWeek  = data.weeklyActive[data.weeklyActive.length - 1] ?? 0;
  const lastFull  = data.weeklyActive.length > 1 ? data.weeklyActive[data.weeklyActive.length - 2] : null;
  const regular   = data.clients.filter(c => c.weeksActive >= Math.ceil(data.weeks.length / 2)).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-bold text-xl">Beta · ús setmanal</h2>
        <p className="text-white/40 text-sm">Un client és actiu una setmana si entra almenys un dia. Les xifres de la graella són dies diferents amb activitat.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Clients a la beta', String(total)],
          ['Han acceptat el consentiment', `${consented} de ${total}`],
          ['Actius aquesta setmana', `${thisWeek}${lastFull !== null ? ` (setm. passada: ${lastFull})` : ''}`],
          [`Actius ≥ ${Math.ceil(data.weeks.length / 2)} de ${data.weeks.length} setmanes`, String(regular)],
        ].map(([l, v]) => (
          <div key={l} className={card}><p className="text-white/40 text-xs">{l}</p><p className="text-white text-lg font-bold mt-1">{v}</p></div>
        ))}
      </div>

      {total === 0 ? (
        <div className={`${card} text-center text-white/40`}>Encara no hi ha cap client actiu. Crea&apos;ls a &quot;Clients&quot;.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs text-left">
                <th className="py-1 pr-3 font-normal">Client</th>
                {data.weeks.map(w => <th key={w} className="py-1 px-1 font-normal text-center">{fmtWeek(w)}</th>)}
                <th className="py-1 px-2 font-normal">Darrer accés</th>
                <th className="py-1 px-2 font-normal">Consentiment</th>
                <th className="py-1 px-2 font-normal text-right">Canvis de dades</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map(c => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="py-2 pr-3"><div className="text-white">{c.name}</div><div className="text-white/30 text-xs">{c.email}</div></td>
                  {c.activeDays.map((n, i) => (
                    <td key={i} className="py-2 px-1 text-center">
                      <span className={`inline-flex w-7 h-7 items-center justify-center rounded ${cellClass(n)}`} title={`${n} dia(es) la setmana del ${fmtWeek(data.weeks[i])}`}>{n || ''}</span>
                    </td>
                  ))}
                  <td className="py-2 px-2 text-white/60">{fmtDate(c.lastSeen)}</td>
                  <td className="py-2 px-2">{c.consentAt ? <span className="text-emerald-300/80">{fmtDate(c.consentAt)}</span> : <span className="text-amber-300/80">Pendent</span>}</td>
                  <td className="py-2 px-2 text-right text-white/60">{c.updates}</td>
                </tr>
              ))}
              <tr className="border-t border-white/10 text-white/50 text-xs">
                <td className="py-2 pr-3">Clients actius</td>
                {data.weeklyActive.map((n, i) => <td key={i} className="py-2 px-1 text-center">{n}</td>)}
                <td colSpan={3} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-white/25 text-xs">Es registra l&apos;entrada i les pàgines que consulta el client (finances, cartera, informes), mai les xifres. L&apos;activitat anterior a aquesta versió no hi surt.</p>
    </div>
  );
}
