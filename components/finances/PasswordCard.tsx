'use client';

// El client canvia la contrasenya que li ha donat l'assessor.
import { useState } from 'react';

const input = 'w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/60';

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
    <section className="bg-surface border border-line rounded-xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink-soft text-xs uppercase tracking-widest">Contrasenya</h2>
        {!open && <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="text-accent text-sm hover:underline">Canviar la contrasenya</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="mt-4 grid sm:grid-cols-3 gap-3">
          <label className="block"><span className="text-ink-muted text-xs">Actual</span>
            <input type="password" autoComplete="current-password" className={input} value={current} onChange={e => setCurrent(e.target.value)} required /></label>
          <label className="block"><span className="text-ink-muted text-xs">Nova (mín. 10)</span>
            <input type="password" autoComplete="new-password" className={input} value={next} onChange={e => setNext(e.target.value)} required /></label>
          <label className="block"><span className="text-ink-muted text-xs">Repeteix la nova</span>
            <input type="password" autoComplete="new-password" className={input} value={repeat} onChange={e => setRepeat(e.target.value)} required /></label>
          <div className="sm:col-span-3 flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-accent text-accent-ink font-semibold text-sm disabled:opacity-50">{saving ? 'Desant…' : 'Desar'}</button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-subtle text-ink-soft text-sm hover:bg-subtle-strong">Cancel·lar</button>
          </div>
        </form>
      )}
      {msg && <p className={`text-sm mt-3 ${msg.ok ? 'text-positive/80' : 'text-negative'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  );
}
