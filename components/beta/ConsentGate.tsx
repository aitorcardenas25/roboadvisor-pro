'use client';

// Consentiment de la beta al primer accés. Només als clients amb sessió:
// mentre no l'acceptin, la pàgina queda tapada i el servidor no desa dades seves.
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

interface ConsentPayload {
  required: boolean;
  text: { version: string; title: string; sections: { title: string; body: string }[]; dataLabel: string; surveyLabel: string };
}

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [payload, setPayload] = useState<ConsentPayload | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [survey, setSurvey]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || role !== 'client') return;
    fetch('/api/client/consent', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((j: ConsentPayload | null) => { if (j) setPayload(j); })
      .catch(() => {});
  }, [status, role]);

  async function accept() {
    if (!payload) return;
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/client/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: payload.text.version, accepted: true, surveyOptIn: survey }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'No s\'ha pogut desar.');
      setPayload({ ...payload, required: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No s\'ha pogut desar.');
    } finally {
      setSaving(false);
    }
  }

  const show = role === 'client' && payload?.required;
  const pathname = usePathname();
  const tracking = role === 'client' && payload !== null && !payload.required;

  // Temps connectat: un ping per minut mentre la pàgina és visible (i només amb consentiment).
  useEffect(() => {
    if (!tracking) return;
    const page = pathname?.startsWith('/client/finances') ? 'finances' : pathname?.startsWith('/client/cartera') ? 'cartera' : 'altres';
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/client/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }), keepalive: true }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    return () => window.clearInterval(id);
  }, [tracking, pathname]);

  return (
    <>
      <div aria-hidden={show ? true : undefined} className={show ? 'pointer-events-none select-none blur-sm' : undefined}>{children}</div>
      {show && payload && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="bg-[#0d1f1a] border border-white/10 sm:rounded-xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <h2 id="consent-title" className="text-white font-bold text-lg mb-1">Abans de començar</h2>
            <p className="text-white/50 text-sm mb-4">{payload.text.title}</p>
            <dl className="space-y-3 text-sm">
              {payload.text.sections.map(s => (
                <div key={s.title}>
                  <dt className="text-[#c9a84c] text-xs uppercase tracking-wide">{s.title}</dt>
                  <dd className="text-white/70 leading-relaxed">{s.body}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 space-y-3">
              <label className="flex gap-3 items-start text-sm text-white/80">
                <input type="checkbox" className="mt-1" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                <span>{payload.text.dataLabel}</span>
              </label>
              <label className="flex gap-3 items-start text-sm text-white/60">
                <input type="checkbox" className="mt-1" checked={survey} onChange={e => setSurvey(e.target.checked)} />
                <span>{payload.text.surveyLabel}</span>
              </label>
            </div>
            {error && <p className="text-red-400 text-sm mt-3" role="alert">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={!accepted || saving} onClick={accept}
                className="px-5 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm disabled:opacity-40">
                {saving ? 'Desant…' : 'Accepto i entro'}
              </button>
              <button type="button" onClick={() => signOut({ callbackUrl: '/' })}
                className="px-5 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10">
                No accepto, sortir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
