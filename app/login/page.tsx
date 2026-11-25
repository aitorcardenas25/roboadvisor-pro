'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LeadForm from '@/components/LeadForm';
import { TWO_FACTOR_REQUIRED, loginErrorText } from '@/lib/authMessages';

function LoginForm() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/client/patrimoni';

  const [username, setUsername] = useState(searchParams.get('usuari') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode]         = useState('');
  const [showLead, setShowLead] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      if (session.user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace(callbackUrl.startsWith('/admin') ? '/client/patrimoni' : callbackUrl);
      }
    }
  }, [session, status, router, callbackUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await signIn('credentials', { username, password, code, redirect: false });
    if (result?.error) {
      if (result.error === TWO_FACTOR_REQUIRED) setNeedCode(true);
      else setError(loginErrorText(result.error));
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="theme-client min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="theme-client min-h-screen bg-canvas flex items-center justify-center px-4">

      {showLead && <LeadForm onClose={() => setShowLead(false)} />}

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center">
              <span className="text-accent font-semibold text-sm leading-none">F</span>
            </div>
            <span className="text-ink font-semibold text-xl">FACTOR</span>
            <span className="text-accent font-light text-xl">OTC</span>
          </Link>
          <p className="text-ink-muted text-xs">Zona de clients</p>
        </div>

        <div className="bg-subtle border border-line rounded-lg p-8"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.1)' }}>
          <h1 className="text-ink font-bold text-xl mb-1">Accés clients</h1>
          <p className="text-ink-muted text-sm mb-7">
            Introdueix les teves credencials per accedir a la zona privada.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-ink-soft text-xs mb-2">Usuari</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required
                className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-accent/70 transition-colors placeholder-ink-muted" />
            </div>
            <div>
              <label className="block text-ink-soft text-xs mb-2">Contrasenya</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-ink text-sm focus:outline-none focus:border-accent/70 transition-colors" />
            </div>

            {needCode && (
              <div>
                <label htmlFor="code" className="block text-ink-soft text-xs mb-2">Codi de l&apos;app d&apos;autenticació (6 xifres)</label>
                <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus
                  value={code} onChange={e => setCode(e.target.value)} required
                  className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-ink text-lg tracking-[0.3em] text-center focus:outline-none focus:border-accent/70" />
              </div>
            )}
            {error && (
              <p className="text-negative text-xs bg-negative/10 border border-negative/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm rounded-xl disabled:opacity-40 transition-colors mt-2">
              {loading ? 'Verificant...' : 'Entrar'}
            </button>
          </form>
          <p className="text-center text-xs mt-4">
            <Link href="/recuperar" className="text-accent hover:underline">He oblidat la contrasenya</Link>
          </p>
        </div>

        <p className="text-center text-ink-muted text-xs mt-4">
          Encara no ets client?{' '}
          <button onClick={() => setShowLead(true)} className="text-accent/70 hover:text-accent transition-colors">
            Sol·licita accés
          </button>
        </p>

        <p className="text-center text-ink-muted text-xs mt-3">
          <Link href="/" className="hover:text-ink-muted transition-colors">← Tornar a l&apos;inici</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="theme-client min-h-screen bg-canvas flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
