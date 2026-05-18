'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ─── Lead capture form ────────────────────────────────────────────────────────

function LeadForm({ onClose }: { onClose: () => void }) {
  const [form, setForm]       = useState({ name: '', email: '', phone: '', interest: '', message: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'login-form' }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
      setDone(true);
    } catch { setError('Error de connexió.'); }
    finally { setSending(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0d1f1a] border border-[#1a3a2a] rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-[#c9a84c]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-[#c9a84c] text-xl">✓</span>
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Sol·licitud enviada</h3>
            <p className="text-white/50 text-sm mb-6">Ens posarem en contacte amb tu en breu.</p>
            <button onClick={onClose} className="text-[#c9a84c] text-sm hover:underline">Tornar al login</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Vull ser client de Factor OTC</h3>
              <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl">×</button>
            </div>
            <p className="text-white/50 text-sm mb-6 leading-relaxed">
              Deixa&apos;ns les teves dades i t&apos;expliquem com funciona el servei d&apos;assessorament financer.
            </p>
            {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4 text-red-400 text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1.5">Nom *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required placeholder="Joan García"
                    className="w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20" />
                </div>
                <div>
                  <label className="block text-white/40 text-xs uppercase tracking-wide mb-1.5">Telèfon</label>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+34 6XX XXX XXX"
                    className="w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20" />
                </div>
              </div>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wide mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required placeholder="joan@exemple.com"
                  className="w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20" />
              </div>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wide mb-1.5">Quin servei t&apos;interessa? *</label>
                <select value={form.interest} onChange={e => setForm(p => ({ ...p, interest: e.target.value }))} required
                  className="w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40">
                  <option value="">Selecciona...</option>
                  <option value="Informe financer inicial (20€)">Informe financer inicial (20€)</option>
                  <option value="Assessorament mensual + seguiment cartera">Assessorament mensual + seguiment cartera</option>
                  <option value="Crear cartera d'inversió personalitzada">Crear cartera d&apos;inversió personalitzada</option>
                  <option value="Informació general">Informació general</option>
                </select>
              </div>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wide mb-1.5">Missatge (opcional)</label>
                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  rows={2} placeholder="Explica'ns breument la teva situació o dubtes..."
                  className="w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20 resize-none" />
              </div>
              <button type="submit" disabled={sending}
                className="w-full py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-xl disabled:opacity-50 transition-colors">
                {sending ? 'Enviant...' : 'Enviar sol·licitud'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const { data: session, status } = useSession();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/client/seguiment-accions';

  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      if (session.user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace(callbackUrl.startsWith('/admin') ? '/client/seguiment-accions' : callbackUrl);
      }
    }
  }, [session, status, router, callbackUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
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

      {showLeadForm && <LeadForm onClose={() => setShowLeadForm(false)} />}

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
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">
                Usuari
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full bg-[#0d1a14] border border-[#1a3a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2d6a4f]/70 transition-colors placeholder-white/20"
              />
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-2">
                Contrasenya
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full bg-[#0d1a14] border border-[#1a3a2a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#2d6a4f]/70 transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] font-semibold text-sm rounded-xl hover:bg-[#1f4432] disabled:opacity-40 transition-colors mt-2">
              {loading ? 'Verificant...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-4">
          Encara no ets client?{' '}
          <button onClick={() => setShowLeadForm(true)} className="text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors">
            Sol·licita accés
          </button>
        </p>

        <p className="text-center text-white/20 text-xs mt-3">
          Ets administrador?{' '}
          <Link href="/admin" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">
            Panell admin
          </Link>
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
