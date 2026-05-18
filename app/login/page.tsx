'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

function LoginForm() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/client/cartera';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showLead, setShowLead] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      if (session.user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace(callbackUrl.startsWith('/admin') ? '/client/cartera' : callbackUrl);
      }
    }
  }, [session, status, router, callbackUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await signIn('credentials', { username, password, redirect: false });
    if (result?.error) {
      setError('Credencials incorrectes. Torna-ho a intentar.');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080e0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e0b] flex items-center justify-center px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.4) 0%, transparent 70%)' }}>

      {showLead && <LeadForm onClose={() => setShowLead(false)} />}

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-sm leading-none">F</span>
            </div>
            <span className="text-white font-black text-xl tracking-wider">FACTOR</span>
            <span className="text-[#2d6a4f] font-light text-xl tracking-widest">OTC</span>
          </Link>
          <p className="text-white/30 text-xs uppercase tracking-[0.3em]">Zona de clients</p>
        </div>

        <div className="bg-white/[0.03] border border-[#1a3a2a]/60 rounded-2xl p-8"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.1)' }}>
          <h1 className="text-white font-bold text-xl mb-1">Accés clients</h1>
          <p className="text-white/40 text-sm mb-7">
            Introdueix les teves credencials per accedir a la zona privada.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">Usuari</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required
                className="w-full bg-[#0d1a14] border border-[#1a3a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2d6a4f]/70 transition-colors placeholder-white/20" />
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">Contrasenya</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full bg-[#0d1a14] border border-[#1a3a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2d6a4f]/70 transition-colors" />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-xl disabled:opacity-40 transition-colors mt-2">
              {loading ? 'Verificant...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-4">
          Encara no ets client?{' '}
          <button onClick={() => setShowLead(true)} className="text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors">
            Sol·licita accés
          </button>
        </p>

        <p className="text-center text-white/20 text-xs mt-3">
          <Link href="/" className="hover:text-white/40 transition-colors">← Tornar a l&apos;inici</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080e0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
