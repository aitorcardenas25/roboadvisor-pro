'use client';

// Drets RGPD des del portal: descarregar les dades (art. 15 i 20) i demanar-ne
// l'eliminació (art. 17). L'eliminació no és automàtica: l'assessor la revisa.
import { useState } from 'react';

const card = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';

export default function MyDataCard() {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason]         = useState('');
  const [state, setState]           = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [notified, setNotified]     = useState(true);

  async function requestDeletion() {
    setState('sending');
    try {
      const r = await fetch('/api/client/data/deletion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setNotified(Boolean(j.notified));
      setState('sent');
      setConfirming(false);
    } catch {
      setState('error');
    }
  }

  return (
    <section className={card} aria-labelledby="my-data-title">
      <h2 id="my-data-title" className="text-white/50 text-xs uppercase tracking-widest mb-3">Les teves dades</h2>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <a href="/api/client/data" download
          className="inline-block text-center px-4 py-2 rounded-lg bg-white/5 text-white/80 text-sm hover:bg-white/10">
          Descarregar les meves dades (JSON)
        </a>
        {state !== 'sent' && !confirming && (
          <button type="button" onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-lg text-red-300/80 text-sm hover:bg-red-500/10 border border-red-400/20">
            Demanar que s&apos;esborrin les meves dades
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-4 space-y-3">
          <p className="text-white/60 text-sm">
            L&apos;assessor rebrà la sol·licitud i et respondrà en un termini màxim d&apos;un mes. Si alguna llei obliga
            a conservar part de les dades, t&apos;ho explicarà. Un cop esborrades, no es poden recuperar.
          </p>
          <label className="block">
            <span className="text-white/40 text-xs">Motiu (opcional)</span>
            <textarea maxLength={500} rows={2} value={reason} onChange={e => setReason(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60" />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={requestDeletion} disabled={state === 'sending'}
              className="px-4 py-2 rounded-lg bg-red-500/80 text-white text-sm font-semibold disabled:opacity-50">
              {state === 'sending' ? 'Enviant…' : 'Confirmar la sol·licitud'}
            </button>
            <button type="button" onClick={() => { setConfirming(false); setState('idle'); }}
              className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10">Cancel·lar</button>
          </div>
        </div>
      )}

      {state === 'sent' && (
        <p className="text-green-300/80 text-sm mt-3" role="status">
          Sol·licitud registrada. Et respondrem en un termini màxim d&apos;un mes.
          {!notified && <> Si no tens resposta, escriu a <a className="underline" href="mailto:privacitat@factorotc.com">privacitat@factorotc.com</a>.</>}
        </p>
      )}
      {state === 'error' && (
        <p className="text-red-400 text-sm mt-3" role="alert">
          No s&apos;ha pogut enviar. Escriu a <a className="underline" href="mailto:privacitat@factorotc.com">privacitat@factorotc.com</a>.
        </p>
      )}
    </section>
  );
}
