// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  // Authorized (non-admin) users logged in here by mistake → redirect to client area
  useEffect(() => {
    if (session && session.user.role !== 'admin') {
      router.replace('/client/seguiment-accions');
    }
  }, [session, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Credencials incorrectes. Torna-ho a intentar.');
    }
    setLoading(false);
  };

  if (status === 'loading') {
    return (
      <div className="theme-admin min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-accent text-sm font-medium animate-pulse">
          Carregant...
        </div>
      </div>
    );
  }

  if (session) {
    return <AdminDashboard onLogout={() => signOut({ callbackUrl: '/' })} />;
  }

  return (
    <div className="theme-admin min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <p className="text-ink font-semibold text-2xl tracking-tight mb-1">
            Factor <span className="text-ink-muted font-normal">OTC</span>
          </p>
          <p className="text-ink-muted text-xs font-medium">
            Panell d'administració
          </p>
        </div>

        <div className="bg-surface border border-line rounded-lg p-8 shadow-sm">
          <h2 className="text-ink font-bold text-xl mb-2">Accés restringit</h2>
          <p className="text-ink-muted text-sm mb-8">
            Introdueix les teves credencials per accedir al panell.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-ink-soft text-xs font-medium mb-2">
                Usuari
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-subtle-strong border border-line-strong rounded-lg px-4 py-3 text-ink placeholder-ink-muted focus:outline-none focus:border-accent/60 transition-all text-sm"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="block text-ink-soft text-xs font-medium mb-2">
                Contrasenya
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-subtle-strong border border-line-strong rounded-lg px-4 py-3 text-ink placeholder-ink-muted focus:outline-none focus:border-accent/60 transition-all text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-negative/10 border border-negative/30 rounded-lg px-4 py-3">
                <p className="text-negative text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-accent-ink font-bold py-3 rounded-lg transition-all text-sm font-medium disabled:opacity-50">
              {loading ? 'Verificant...' : 'Accedir'}
            </button>
          </form>
        </div>

        <p className="text-center text-ink-muted text-xs mt-6">
          Accés restringit · Factor OTC Admin
        </p>
      </div>
    </div>
  );
}