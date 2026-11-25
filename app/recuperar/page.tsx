'use client';

// "He oblidat la contrasenya": demana un enllaç al correu del compte.
import { useState } from 'react';
import Link from 'next/link';
import AuthCard, { inputCls, buttonCls } from '@/components/auth/AuthCard';

export default function RecuperarPage() {
  const [login, setLogin]   = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setMsg(null);
    try {
      const r = await fetch('/api/password-link/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login }) });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? { ok: true, text: d.message } : { ok: false, text: d.error ?? 'Massa intents. Espera uns minuts.' });
    } catch {
      setMsg({ ok: false, text: 'Error de connexió. Torna-ho a provar.' });
    } finally { setSending(false); }
  };

  return (
    <AuthCard title="He oblidat la contrasenya"
      subtitle="Escriu el teu usuari o el correu amb què et vam donar d'alta. T'enviarem un enllaç per triar-ne una de nova."
      footer={<Link href="/login" className="hover:text-accent">← Tornar a entrar</Link>}>
      {msg?.ok ? (
        <p role="status" className="text-ink-soft text-sm bg-subtle border border-line rounded-lg px-4 py-3">{msg.text}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="login" className="block text-ink-soft text-xs mb-1.5">Usuari o correu</label>
            <input id="login" value={login} onChange={e => setLogin(e.target.value)} autoComplete="username" required minLength={3} className={inputCls} />
          </div>
          {msg && <p role="alert" className="text-negative text-xs bg-negative/10 border border-negative/20 rounded-lg px-3 py-2">{msg.text}</p>}
          <button type="submit" disabled={sending} className={buttonCls}>{sending ? 'Enviant…' : 'Enviar l\'enllaç'}</button>
        </form>
      )}
    </AuthCard>
  );
}
