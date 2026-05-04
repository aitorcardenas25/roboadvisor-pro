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
      router.replace('/accions');
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
      <div className="min-h-screen bg-[#0d1f1a] flex items-center justify-center">
        <div className="text-[#c9a84c] text-sm uppercase tracking-widest animate-pulse">
          Carregant...
        </div>
      </div>
    );
  }

  if (session) {
    return <AdminDashboard onLogout={() => signOut({ callbackUrl: '/' })} />;
  }

  return (
    <div className="min-h-screen bg-[#0d1f1a] flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#c9a84c]" />
            </div>
            <span className="text-white font-black text-2xl">FACTOR</span>
            <span className="text-[#c9a84c] font-light text-2xl tracking-widest">OTC</span>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-[0.3em]">
            Panell d'administració
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <h2 className="text-white font-bold text-xl mb-2">Accés restringit</h2>
          <p className="text-white/40 text-sm mb-8">
            Introdueix les teves credencials per accedir al panell.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
                Usuari
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a84c]/60 transition-all text-sm"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs uppercase tracking-widest mb-2">
                Contrasenya
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a84c]/60 transition-all text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-red-400 text-sm">⚠️ {error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold py-3 rounded-lg transition-all text-sm uppercase tracking-widest disabled:opacity-50">
              {loading ? 'Verificant...' : 'Accedir'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Accés restringit · Factor OTC Admin
        </p>
      </div>
    </div>
  );
}