'use client';

// Activar o desactivar la verificació en dos passos de l'administrador.
import { useEffect, useState } from 'react';

const card = 'bg-surface border border-line rounded-lg p-5';
const input = 'w-40 bg-subtle border border-line-strong rounded-lg px-3 py-2 text-ink text-lg tracking-[0.3em] text-center focus:outline-none focus:border-accent/60';
const btn = 'px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg disabled:opacity-50';

export default function TwoFactorSetup() {
  const [status, setStatus] = useState<{ enabled: boolean; bypass: boolean } | null>(null);
  const [setup, setSetup]   = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => fetch('/api/admin/2fa', { cache: 'no-store' }).then(r => r.json()).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); }, []);

  const post = async (body: object) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, d };
    } finally { setBusy(false); }
  };

  const start = async () => { const { ok, d } = await post({ action: 'start' }); if (ok) { setSetup(d); setCode(''); } else setMsg({ ok: false, text: d.error ?? 'Error' }); };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, d } = await post({ action: 'confirm', secret: setup!.secret, code });
    if (!ok) { setMsg({ ok: false, text: d.error ?? 'Error' }); return; }
    setSetup(null); setCode('');
    setMsg({ ok: true, text: 'Verificació en dos passos activada. A partir d\'ara, per entrar a l\'admin et demanarem el codi del mòbil.' });
    load();
  };
  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, d } = await post({ action: 'disable', code });
    if (!ok) { setMsg({ ok: false, text: d.error ?? 'Error' }); return; }
    setCode(''); setMsg({ ok: true, text: 'Verificació en dos passos desactivada.' }); load();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className={card}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-ink font-semibold">Verificació en dos passos</h3>
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.enabled ? 'bg-positive/15 text-positive' : 'bg-warning/15 text-warning'}`}>
              {status.enabled ? 'Activada' : 'Desactivada'}
            </span>
          )}
        </div>
        <p className="text-ink-muted text-sm mb-4">
          A més de la contrasenya, per entrar a l&apos;admin caldrà un codi de 6 xifres que canvia cada 30 segons a
          l&apos;app del teu mòbil (Google Authenticator, Microsoft Authenticator o similar). Si algú et robés la contrasenya, sense el mòbil no podria entrar.
        </p>
        {status?.bypass && (
          <p className="text-warning text-xs mb-4">Ara mateix està desactivada per la variable ADMIN_2FA_DISABLE de Vercel. Treu-la quan puguis.</p>
        )}

        {status && !status.enabled && !setup && <button onClick={start} disabled={busy} className={btn}>Activar-la</button>}

        {setup && (
          <form onSubmit={confirm} className="space-y-4">
            <ol className="text-ink-soft text-sm space-y-1 list-decimal pl-5">
              <li>Instal·la Google Authenticator al mòbil (App Store o Google Play), si no el tens.</li>
              <li>Prem «+» → «Escaneja un codi QR» i enfoca aquest codi.</li>
              <li>Escriu aquí el codi de 6 xifres que et surt.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Codi QR per a l'app d'autenticació" width={220} height={220} className="border border-line rounded" />
            <p className="text-ink-muted text-xs">Si no pots escanejar-lo, escriu aquesta clau a l&apos;app: <code className="font-mono text-ink break-all">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code></p>
            <div className="flex items-center gap-3">
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} required className={input} placeholder="000000" />
              <button type="submit" disabled={busy} className={btn}>Confirmar</button>
              <button type="button" onClick={() => setSetup(null)} className="text-ink-muted text-sm">Cancel·lar</button>
            </div>
          </form>
        )}

        {status?.enabled && (
          <form onSubmit={disable} className="flex items-center gap-3 flex-wrap">
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} required className={input} placeholder="000000" />
            <button type="submit" disabled={busy} className="px-4 py-2 border border-line text-ink-soft text-sm rounded-lg hover:border-line-strong disabled:opacity-50">Desactivar-la</button>
          </form>
        )}

        {msg && <p role="status" className={`mt-4 text-sm ${msg.ok ? 'text-positive' : 'text-negative'}`}>{msg.text}</p>}
      </div>
      <p className="text-ink-muted text-xs">
        Si perds el mòbil: a Vercel, afegeix la variable ADMIN_2FA_DISABLE amb el valor true i torna a desplegar. Entraràs només amb la contrasenya; després torna-la a activar aquí i esborra la variable.
      </p>
    </div>
  );
}
