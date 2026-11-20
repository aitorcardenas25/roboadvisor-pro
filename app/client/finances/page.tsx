'use client';

import ClientNav from '@/components/client/ClientNav';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BudgetOverview from '@/components/finances/BudgetOverview';
import FinancesForm from '@/components/finances/FinancesForm';
import MyDataCard from '@/components/finances/MyDataCard';
import PasswordCard from '@/components/finances/PasswordCard';
import OneOffExpenses from '@/components/finances/OneOffExpenses';
import { analyzeBudget } from '@/lib/budget';
import { useClientName } from '@/components/client/ClientPreview';

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

  const name = useClientName(session?.user?.name);

  return (
    <div className="theme-client min-h-screen bg-canvas">
      <ClientNav name={name} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-ink font-bold text-2xl mb-1">{name ? `Hola, ${name.split(' ')[0]}` : 'Les meves finances'}</h1>
        <p className="text-ink-muted text-sm mb-2">Primer, ordenar el pressupost i el fons d&apos;emergència. Després, invertir.</p>
        <Link href="/client/informe-inicial" className="inline-block text-accent text-sm hover:underline mb-6">Veure el meu informe inicial (punt de partida i objectius) →</Link>

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
