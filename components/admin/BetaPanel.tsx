'use client';

// Ús de la beta: quants dies entra cada client per setmana. Per a la decisió del mes 3.
import { useEffect, useState } from 'react';
import type { UsageSummary } from '@/lib/betaActivity';

const card = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' }) : '—');
const DIAG: Record<string, { label: string; dot: string }> = {
  vermell: { label: 'Cal actuar', dot: 'bg-red-400' }, ambre: { label: 'En camí', dot: 'bg-amber-300' },
  verd: { label: 'Base sòlida', dot: 'bg-green-400' }, incomplet: { label: 'Falten dades', dot: 'bg-white/30' },
};
const fmtWeek = (d: string) => { const [, m, day] = d.split('-'); return `${day}/${m}`; };

const fmtMin = (m: number) => (m === 0 ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());
function ago(iso: string | null, now: number): { text: string; stale: boolean } {
  if (!iso) return { text: 'Mai', stale: true };
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  return { text: days <= 0 ? 'Avui' : days === 1 ? 'Ahir' : `Fa ${days} dies`, stale: days >= 14 };
}

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
  const nowMs     = Date.now();
  const min7      = data.clients.reduce((s, c) => s + c.minutes.week, 0);
  const active7   = data.clients.filter(c => c.minutes.week > 0).length;
  const stale     = data.clients.filter(c => ago(c.lastSeen, nowMs).stale).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-bold text-xl">Beta · seguiment de clients</h2>
        <p className="text-white/40 text-sm">Quant temps es connecta cada client, on el passa i com està la seva situació.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Clients a la beta', `${total} (${consented} amb consentiment)`],
          ['Actius aquesta setmana', `${thisWeek}${lastFull !== null ? ` (setm. passada: ${lastFull})` : ''}`],
          ['Temps total, darrers 7 dies', `${fmtMin(min7)}${active7 ? ` · ${fmtMin(Math.round(min7 / active7))} per client actiu` : ''}`],
          ['Sense entrar fa 14 dies o més', `${stale} de ${total}`],
        ].map(([l, v]) => (
          <div key={l} className={card}><p className="text-white/40 text-xs">{l}</p><p className="text-white text-lg font-bold mt-1">{v}</p></div>
        ))}
      </div>

      {total > 0 && (
        <div className={`${card} overflow-x-auto`}>
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">Temps connectat</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs text-left">
                <th className="py-1 pr-3 font-normal">Client</th>
                <th className="py-1 px-2 font-normal text-right">Avui</th>
                <th className="py-1 px-2 font-normal text-right">7 dies</th>
                <th className="py-1 px-2 font-normal text-right">30 dies</th>
                <th className="py-1 px-2 font-normal text-right">Dies actius (30)</th>
                <th className="py-1 px-2 font-normal text-right">Entrades (30)</th>
                <th className="py-1 px-2 font-normal">On passa el temps</th>
                <th className="py-1 px-2 font-normal">Darrer accés</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map(c => {
                const a = ago(c.lastSeen, nowMs);
                const tot = c.byPage30.finances + c.byPage30.cartera + c.byPage30.altres;
                const pct = (n: number) => (tot ? Math.round((n / tot) * 100) : 0);
                return (
                  <tr key={c.id} className="border-t border-white/5 text-white/70">
                    <td className="py-2 pr-3 text-white">{c.name}</td>
                    <td className="py-2 px-2 text-right">{fmtMin(c.minutes.today)}</td>
                    <td className="py-2 px-2 text-right">{fmtMin(c.minutes.week)}</td>
                    <td className="py-2 px-2 text-right text-white font-semibold">{fmtMin(c.minutes.month)}</td>
                    <td className="py-2 px-2 text-right">{c.daysActive30}</td>
                    <td className="py-2 px-2 text-right">{c.logins30}</td>
                    <td className="py-2 px-2 text-xs">{tot ? `Finances ${pct(c.byPage30.finances)}% · Cartera ${pct(c.byPage30.cartera)}%` : '—'}</td>
                    <td className={`py-2 px-2 ${a.stale ? 'text-amber-300/90' : ''}`}>{a.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-white/25 text-xs mt-3">Minuts amb la pàgina oberta i visible (es compta un minut per cada minut actiu). En groc, clients que fa 14 dies o més que no entren.</p>
        </div>
      )}

      {total === 0 ? (
        <div className={`${card} text-center text-white/40`}>Encara no hi ha cap client actiu. Crea&apos;ls a &quot;Clients&quot;.</div>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-3">Setmanes i situació · dies actius per setmana</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs text-left">
                <th className="py-1 pr-3 font-normal">Client</th>
                <th className="py-1 pr-3 font-normal">Diagnòstic</th>
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
                  <td className="py-2 pr-3 max-w-[16rem]">
                    {c.diagnosis && (
                      <div title={c.diagnosis.headline}>
                        <span className="flex items-center gap-1.5 text-white/80 text-xs"><span className={`w-2 h-2 rounded-full ${DIAG[c.diagnosis.status].dot}`} />{DIAG[c.diagnosis.status].label}</span>
                        <span className="text-white/35 text-xs line-clamp-2">{c.diagnosis.headline}</span>
                      </div>
                    )}
                  </td>
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
                <td className="py-2 pr-3" colSpan={2}>Clients actius</td>
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
