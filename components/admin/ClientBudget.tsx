'use client';

// Pas 1 de la fitxa: pressupost i fons d'emergència abans de la cartera.
// Tot el càlcul és a lib/budget.ts; aquí només es pinta.
import { analyzeBudget, NEXT_STEP_TEXT, type BudgetInput, type BudgetStatus } from '@/lib/budget';

interface Goal { horizon: string; description: string; amount?: number; targetYear?: number }

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const DOT: Record<BudgetStatus, string> = { verd: 'bg-green-400', ambre: 'bg-amber-300', vermell: 'bg-red-400' };
const BAR: Record<string, string> = { fixes: 'bg-sky-400', deutes: 'bg-red-400', variables: 'bg-amber-300', marge: 'bg-green-400' };
const HORIZON: Record<string, string> = { curt: 'Curt termini (0-12 mesos)', mitja: 'Mitjà termini (1-5 anys)', llarg: 'Llarg termini (+5 anys)' };
const card = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export default function ClientBudget({ data }: { data?: Record<string, unknown> }) {
  const q = data ?? {};
  const input: BudgetInput = {
    monthlyNetIncome:        num(q.monthlyNetIncome),
    monthlyFixedExpenses:    num(q.monthlyFixedExpenses),
    monthlyVariableExpenses: num(q.monthlyVariableExpenses),
    monthlyDebtPayments:     num(q.monthlyDebtPayments),
    monthlyExpenses:         num(q.monthlyExpenses),
    currentSavings:          num(q.currentSavings),
    employmentType:          typeof q.employmentType === 'string' ? q.employmentType : undefined,
  };
  const a = analyzeBudget(input);
  const goals = Array.isArray(q.goals) ? (q.goals as Goal[]) : [];

  return (
    <div className="space-y-6">
      {a ? <BudgetBlock a={a} /> : (
        <div className={`${card} text-center py-12`}>
          <p className="text-white/60 mb-2">Encara no hi ha prou dades per fer el pressupost.</p>
          <p className="text-white/30 text-sm">Cal com a mínim els ingressos nets mensuals i les despeses (fixes i variables, o el total).
            Descarrega la plantilla a &quot;Importar Excel&quot;: el client pot omplir només &quot;Dades personals&quot; i &quot;Objectius&quot;.</p>
        </div>
      )}
      <div className={card}>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Objectius del client</h3>
        {goals.length === 0 ? (
          <p className="text-white/30 text-sm">Sense objectius. Es poden omplir a la pestanya &quot;Objectius&quot; de la plantilla.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li key={i} className="text-sm">
                <span className="text-white/40 text-xs block">{HORIZON[g.horizon] ?? g.horizon}</span>
                <span className="text-white">{g.description}</span>
                {g.amount ? <span className="text-white/60"> · {eur(g.amount)}</span> : null}
                {g.targetYear ? <span className="text-white/60"> · {g.targetYear}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function BudgetBlock({ a }: { a: NonNullable<ReturnType<typeof analyzeBudget>> }) {
  const step = NEXT_STEP_TEXT[a.nextStep];
  const positive = a.lines.filter(l => l.amount > 0);
  const barTotal = positive.reduce((s, l) => s + l.amount, 0) || 1;
  const e = a.emergency;

  return (
    <>
      <div className={`${card} border-[#c9a84c]/40`}>
        <p className="text-[#c9a84c] text-xs uppercase tracking-widest mb-1">On és ara</p>
        <h3 className="text-white font-bold text-lg">{step.title}</h3>
        <p className="text-white/60 text-sm mt-1">{step.detail}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={card}>
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Pressupost mensual · {eur(a.income)} nets</h3>
          <div className="flex h-3 rounded-full overflow-hidden mb-4" aria-hidden>
            {positive.map(l => <div key={l.key} className={BAR[l.key]} style={{ width: `${(l.amount / barTotal) * 100}%` }} />)}
          </div>
          <dl className="space-y-2">
            {a.lines.filter(l => l.key !== 'deutes' || l.amount > 0).map(l => (
              <div key={l.key} className="flex items-center justify-between gap-4 text-sm">
                <dt className="text-white/60 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${BAR[l.key]}`} />{l.label}</dt>
                <dd className={l.amount < 0 ? 'text-red-400' : 'text-white'}>{eur(l.amount)} <span className="text-white/30 text-xs">({l.pct}%)</span></dd>
              </div>
            ))}
          </dl>
          {!a.hasBreakdown && (
            <p className="text-amber-200/70 text-xs mt-3">Només hi ha la despesa total. Amb fixes i variables per separat es pot veure on retallar.</p>
          )}
        </div>

        <div className={card}>
          <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Referència 50/30/20</h3>
          <ul className="space-y-3">
            {a.checks.map(c => (
              <li key={c.key} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-white/70 flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${DOT[c.status]}`} />{c.label}</span>
                <span className="text-white">{c.value} <span className="text-white/30 text-xs">ref. {c.reference}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-white/30 text-xs mt-4">Regla orientativa (Warren i Tyagi, 2005). No és una norma: serveix per veure on és el client.</p>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Fons d&apos;emergència</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><p className="text-white/30 text-xs">Objectiu</p><p className="text-white font-bold">{eur(e.targetAmount)}</p><p className="text-white/30 text-xs">{e.monthsTarget} mesos de despeses</p></div>
          <div><p className="text-white/30 text-xs">Té ara</p><p className="text-white font-bold">{e.current === null ? '—' : eur(e.current)}</p></div>
          <div><p className="text-white/30 text-xs">Falta</p><p className="text-white font-bold">{e.gap === null ? '—' : eur(e.gap)}</p></div>
          <div><p className="text-white/30 text-xs">Temps per arribar-hi</p><p className="text-white font-bold">
            {e.monthsToTarget === null ? '—' : e.monthsToTarget === 0 ? 'Complet' : `${e.monthsToTarget} mesos`}</p>
            <p className="text-white/30 text-xs">si hi destina tot el marge</p></div>
        </div>
        {e.progressPct !== null && (
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
            <div className="h-full bg-[#c9a84c]" style={{ width: `${e.progressPct}%` }} />
          </div>
        )}
        <p className="text-white/40 text-xs">{e.basis}{e.current === null ? ' Falten els estalvis en efectiu per calcular el progrés.' : ''}</p>
      </div>
    </>
  );
}
