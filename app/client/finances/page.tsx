'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BudgetOverview from '@/components/finances/BudgetOverview';

export default function ClientFinancesPage() {
  const { data: session } = useSession();
  const [data, setData]       = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch('/api/client/finances')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Cal iniciar sessió.' : 'No s\'han pogut carregar les dades.');
        return r.json();
      })
      .then(j => setData(j.data ?? {}))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const name = session?.user?.name ?? '';

  return (
    <div className="min-h-screen bg-[#0a0f0d]"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% -8%,rgba(26,58,42,0.3) 0%,transparent 60%)' }}>
      <nav className="border-b border-white/[0.055] bg-[#0a0f0d]/95 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[#c9a84c] font-black text-[9px] leading-none">F</span>
            </div>
            <span className="text-white/30 text-sm hidden sm:inline">Factor OTC</span>
            <span className="text-white/15 text-sm hidden sm:inline">/</span>
            <span className="text-white/60 text-sm truncate">Les meves finances</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-xs">
            <Link href="/client/cartera" className="text-white/40 hover:text-[#c9a84c] transition-colors">La meva cartera</Link>
            {name && <span className="text-white/30 hidden sm:inline">{name}</span>}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-white font-bold text-2xl mb-1">{name ? `Hola, ${name.split(' ')[0]}` : 'Les meves finances'}</h1>
        <p className="text-white/40 text-sm mb-6">Primer, ordenar el pressupost i el fons d&apos;emergència. Després, invertir.</p>

        {loading && (
          <div className="flex items-center justify-center py-24" role="status" aria-label="Carregant">
            <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && error && <p className="text-red-400 text-center py-24">{error}</p>}
        {!loading && !error && <BudgetOverview data={data ?? {}} goalsTitle="Els meus objectius" />}

        <p className="text-white/25 text-xs mt-8 leading-relaxed">
          Informació descriptiva calculada amb les dades que has facilitat. No és una recomanació d&apos;inversió.
        </p>
      </main>
    </div>
  );
}
