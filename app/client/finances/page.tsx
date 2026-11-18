'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BudgetOverview from '@/components/finances/BudgetOverview';
import FinancesForm from '@/components/finances/FinancesForm';
import MyDataCard from '@/components/finances/MyDataCard';
import PasswordCard from '@/components/finances/PasswordCard';
import OneOffExpenses from '@/components/finances/OneOffExpenses';
import { analyzeBudget } from '@/lib/budget';

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
function hasBudget(d: Record<string, unknown>): boolean {
  return analyzeBudget({
    monthlyNetIncome: n(d.monthlyNetIncome), monthlyFixedExpenses: n(d.monthlyFixedExpenses),
    monthlyVariableExpenses: n(d.monthlyVariableExpenses), monthlyExpenses: n(d.monthlyExpenses),
  }) !== null;
}

export default function ClientFinancesPage() {
  const { data: session } = useSession();
  const [data, setData]       = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch('/api/client/finances')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Cal iniciar sessió.' : 'No s\'han pogut carregar les dades.');
        return r.json();
      })
      .then(j => {
        const d = j.data ?? {};
        setData(d);
        // Sense dades suficients per al pressupost: el formulari s'obre directament.
        if (!hasBudget(d)) setEditing(true);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const name = session?.user?.name ?? '';

  return (
    <div className="theme-client min-h-screen bg-canvas">
      <nav className="border-b border-line bg-surface sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-semibold text-[9px] leading-none">F</span>
            </div>
            <span className="text-ink-muted text-sm hidden sm:inline">Factor OTC</span>
            <span className="text-ink-muted text-sm hidden sm:inline">/</span>
            <span className="text-ink-soft text-sm truncate">Les meves finances</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-xs">
            <Link href="/client/cartera" className="text-ink-muted hover:text-accent transition-colors">La meva cartera</Link>
            {name && <span className="text-ink-muted hidden sm:inline">{name}</span>}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-ink font-bold text-2xl mb-1">{name ? `Hola, ${name.split(' ')[0]}` : 'Les meves finances'}</h1>
        <p className="text-ink-muted text-sm mb-6">Primer, ordenar el pressupost i el fons d&apos;emergència. Després, invertir.</p>

        {loading && (
          <div className="flex items-center justify-center py-24" role="status" aria-label="Carregant">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && error && <p className="text-negative text-center py-24">{error}</p>}
        {!loading && !error && (
          <div className="space-y-6">
            {editing ? (
              <FinancesForm data={data ?? {}}
                onSaved={d => { setData(d); setEditing(false); setSaved(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onCancel={hasBudget(data ?? {}) ? () => setEditing(false) : undefined} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => { setEditing(true); setSaved(false); }}
                  className="px-4 py-2 rounded-lg bg-subtle text-ink text-sm hover:bg-subtle-strong">
                  Editar les meves dades
                </button>
                {saved && <span className="text-positive/80 text-sm" role="status">Dades desades.</span>}
              </div>
            )}
            {!editing && hasBudget(data ?? {}) && (
              <OneOffExpenses endpoint="/api/client/expenses" data={data ?? {}} onChange={d => setData(d)} />
            )}
            {!editing && <BudgetOverview data={data ?? {}} goalsTitle="Els meus objectius" />}
            <MyDataCard />
            <PasswordCard />
          </div>
        )}

        <p className="text-ink-muted text-xs mt-8 leading-relaxed">
          Informació descriptiva calculada amb les dades que has facilitat. No és una recomanació d&apos;inversió.
        </p>
      </main>
    </div>
  );
}
