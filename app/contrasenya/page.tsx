'use client';

// Crear o canviar la contrasenya amb l'enllaç rebut per correu (o per WhatsApp).
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AuthCard, { inputCls, buttonCls } from '@/components/auth/AuthCard';

type Info = { ok: true; purpose: 'activar' | 'recuperar'; username: string; name: string } | { ok: false; error: string };

function SetPassword() {
  const t = useSearchParams().get('t') ?? '';
  const [info, setInfo]       = useState<Info | null>(null);
  const [pw, setPw]           = useState('');
  const [pw2, setPw2]         = useState('');
  const [show, setShow]       = useState(false);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState<string | null>(null);

  useEffect(() => {
    if (!t) { setInfo({ ok: false, error: 'Falta l\'enllaç. Obre el botó del correu que has rebut.' }); return; }
    fetch(`/api/password-link?t=${encodeURIComponent(t)}`, { cache: 'no-store' })
      .then(r => r.json()).then(setInfo)
      .catch(() => setInfo({ ok: false, error: 'No s\'ha pogut comprovar l\'enllaç. Torna-ho a provar.' }));
  }, [t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw !== pw2) { setError('Les dues contrasenyes no coincideixen.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/password-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t, password: pw }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'No s\'ha pogut desar.'); return; }
      setDone(d.username);
    } finally { setSaving(false); }
  };

  if (!info) return <AuthCard title="Un moment…"><div className="h-24 bg-subtle rounded animate-pulse" /></AuthCard>;

  if (!info.ok) return (
    <AuthCard title="Enllaç no vàlid" subtitle={info.error}>
      <Link href="/recuperar" className={`${buttonCls} block text-center`}>Demanar un enllaç nou</Link>
    </AuthCard>
  );

  if (done) return (
    <AuthCard title="Contrasenya desada" subtitle="Ja pots entrar amb el teu usuari i la contrasenya nova, des de l'ordinador o el mòbil.">
      <Link href={`/login?usuari=${encodeURIComponent(done)}`} className={`${buttonCls} block text-center`}>Entrar</Link>
    </AuthCard>
  );

  const first = info.name.split(' ')[0];
  return (
    <AuthCard
      title={info.purpose === 'activar' ? `Hola, ${first}` : 'Contrasenya nova'}
      subtitle={info.purpose === 'activar'
        ? 'Tria la contrasenya per entrar a Factor OTC. Només la sabràs tu.'
        : 'Tria una contrasenya nova per al teu compte.'}
      footer="Consell: una frase de 3 o 4 paraules és fàcil de recordar i difícil d'endevinar. No la facis servir en cap altre lloc.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-ink-soft text-xs mb-1.5">Usuari</label>
          <input value={info.username} readOnly autoComplete="username" className={`${inputCls} bg-subtle text-ink-muted`} />
        </div>
        <div>
          <label htmlFor="pw" className="block text-ink-soft text-xs mb-1.5">Contrasenya nova (mínim 10 caràcters)</label>
          <input id="pw" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
            autoComplete="new-password" required minLength={10} className={inputCls} />
        </div>
        <div>
          <label htmlFor="pw2" className="block text-ink-soft text-xs mb-1.5">Repeteix-la</label>
          <input id="pw2" type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)}
            autoComplete="new-password" required minLength={10} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-ink-muted text-xs">
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Mostrar la contrasenya
        </label>
        {error && <p role="alert" className="text-negative text-xs bg-negative/10 border border-negative/20 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={saving} className={buttonCls}>{saving ? 'Desant…' : 'Desar la contrasenya'}</button>
      </form>
    </AuthCard>
  );
}

export default function ContrasenyaPage() {
  return <Suspense fallback={null}><SetPassword /></Suspense>;
}
