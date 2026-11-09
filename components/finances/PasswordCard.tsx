'use client';

// El client canvia la contrasenya que li ha donat l'assessor.
import { useState } from 'react';

const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60';

export default function PasswordCard() {
  const [open, setOpen]       = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [repeat, setRepeat]   = useState('');
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 10) { setMsg({ ok: false, text: 'La contrasenya nova ha de tenir com a mínim 10 caràcters.' }); return; }
    if (next !== repeat)  { setMsg({ ok: false, text: 'Les dues contrasenyes noves no coincideixen.' }); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/client/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current, next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? 'No s\'ha pogut canviar.');
      setMsg({ ok: true, text: 'Contrasenya canviada.' });
      setCurrent(''); setNext(''); setRepeat(''); setOpen(false);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'No s\'ha pogut canviar.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-white/50 text-xs uppercase tracking-widest">Contrasenya</h2>
        {!open && <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="text-[#c9a84c] text-sm hover:underline">Canviar la contrasenya</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid sm:grid-cols-3 gap-3">
          <label className="block"><span className="text-white/40 text-xs">Actual</span>
            <input type="password" autoComplete="current-password" className={input} value={current} onChange={e => setCurrent(e.target.value)} required /></label>
          <label className="block"><span className="text-white/40 text-xs">Nova (mín. 10)</span>
            <input type="password" autoComplete="new-password" className={input} value={next} onChange={e => setNext(e.target.value)} required /></label>
          <label className="block"><span className="text-white/40 text-xs">Repeteix la nova</span>
            <input type="password" autoComplete="new-password" className={input} value={repeat} onChange={e => setRepeat(e.target.value)} required /></label>
          <div className="sm:col-span-3 flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm disabled:opacity-50">{saving ? 'Desant…' : 'Desar'}</button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10">Cancel·lar</button>
          </div>
        </form>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? 'text-green-300/80' : 'text-red-400'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  );
}
