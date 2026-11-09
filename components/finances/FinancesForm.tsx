'use client';

// Formulari perquè el client ompli el pressupost i els objectius des del portal,
// sense haver de baixar i omplir l'Excel. Desa a PUT /api/client/finances.
import { useState } from 'react';

type Horizon = 'curt' | 'mitja' | 'llarg';
interface GoalRow { horizon: Horizon; description: string; amount: string; targetYear: string }

const MONEY_FIELDS = [
  { key: 'monthlyNetIncome',        label: 'Ingressos nets al mes',        hint: 'El que cobres a final de mes, després d\'impostos.' },
  { key: 'monthlyFixedExpenses',    label: 'Despeses fixes al mes',        hint: 'Lloguer o hipoteca, subministraments, assegurances, transport…' },
  { key: 'monthlyVariableExpenses', label: 'Despeses variables al mes',    hint: 'Menjar fora, oci, compres, viatges… (una mitjana).' },
  { key: 'monthlyDebtPayments',     label: 'Quotes de préstecs al mes',    hint: 'Cotxe, targetes, préstecs personals. Si no en tens, 0.' },
  { key: 'currentSavings',          label: 'Estalvi que ja tens',          hint: 'Diners al compte o en dipòsits que podries fer servir demà.' },
] as const;

const EMPLOYMENT = [
  { value: '',            label: 'Tria una opció' },
  { value: 'indefinit',   label: 'Contracte indefinit' },
  { value: 'temporal',    label: 'Contracte temporal' },
  { value: 'autonom',     label: 'Autònom' },
  { value: 'sense-feina', label: 'Sense feina ara mateix' },
];

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 'curt',  label: 'Curt (0-12 mesos)' },
  { value: 'mitja', label: 'Mitjà (1-5 anys)' },
  { value: 'llarg', label: 'Llarg (+5 anys)' },
];

const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60';
const card  = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';

const str = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

function toGoalRows(v: unknown): GoalRow[] {
  if (!Array.isArray(v)) return [];
  return v.map((g: Record<string, unknown>) => ({
    horizon:     (['curt', 'mitja', 'llarg'].includes(g?.horizon as string) ? g.horizon : 'mitja') as Horizon,
    description: typeof g?.description === 'string' ? g.description : '',
    amount:      str(g?.amount),
    targetYear:  str(g?.targetYear),
  }));
}

export default function FinancesForm({ data, onSaved, onCancel }: {
  data: Record<string, unknown>;
  onSaved: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(MONEY_FIELDS.map(f => [f.key, str(data[f.key])])));
  const [employment, setEmployment] = useState(typeof data.employmentType === 'string' ? data.employmentType : '');
  const [goals, setGoals]   = useState<GoalRow[]>(() => toGoalRows(data.goals));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const hasOldTotal = typeof data.monthlyExpenses === 'number' && data.monthlyFixedExpenses === undefined;

  function setGoal(i: number, patch: Partial<GoalRow>) {
    setGoals(gs => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body: Record<string, unknown> = {};
    for (const f of MONEY_FIELDS) {
      const raw = values[f.key].trim().replace(',', '.');
      if (raw === '') { body[f.key] = null; continue; }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) { setError(`${f.label}: ha de ser un número de 0 o més.`); return; }
      body[f.key] = n;
    }
    body.employmentType = employment || null;
    const cleanGoals = [];
    for (const g of goals) {
      if (!g.description.trim()) continue;
      const amount = g.amount.trim() === '' ? undefined : Number(g.amount.replace(',', '.'));
      const year   = g.targetYear.trim() === '' ? undefined : Number(g.targetYear);
      if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) { setError(`Objectiu "${g.description}": l'import no és vàlid.`); return; }
      if (year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100)) { setError(`Objectiu "${g.description}": l'any no és vàlid.`); return; }
      cleanGoals.push({ horizon: g.horizon, description: g.description.trim(), amount, targetYear: year });
    }
    body.goals = cleanGoals;

    setSaving(true);
    try {
      const r = await fetch('/api/client/finances', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.issues?.[0]?.message ?? j.error ?? 'No s\'han pogut desar les dades.');
      onSaved(j.data ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No s\'han pogut desar les dades.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-5`}>
      <div>
        <h2 className="text-white font-semibold">Les meves dades</h2>
        <p className="text-white/40 text-xs mt-1">Xifres aproximades i mensuals. Si no saps alguna dada, deixa-la en blanc.</p>
      </div>

      {hasOldTotal && (
        <p className="text-amber-200/80 text-xs">
          Ara tens només la despesa total ({str(data.monthlyExpenses)} €). Si separes fixes i variables, el pressupost serà més precís.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {MONEY_FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="text-white/60 text-sm">{f.label} (€)</span>
            <input type="number" inputMode="decimal" min={0} step="any" className={`${input} mt-1`}
              value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
            <span className="text-white/30 text-xs">{f.hint}</span>
          </label>
        ))}
        <label className="block">
          <span className="text-white/60 text-sm">Situació laboral</span>
          <select className={`${input} mt-1`} value={employment} onChange={e => setEmployment(e.target.value)}>
            {EMPLOYMENT.map(o => <option key={o.value} value={o.value} className="bg-[#0d1f1a]">{o.label}</option>)}
          </select>
          <span className="text-white/30 text-xs">Serveix per calcular quants mesos ha de cobrir el fons d&apos;emergència.</span>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white/70 text-sm font-semibold">Objectius</h3>
          {goals.length < 10 && (
            <button type="button" onClick={() => setGoals(gs => [...gs, { horizon: 'mitja', description: '', amount: '', targetYear: '' }])}
              className="text-[#c9a84c] text-xs hover:underline">+ Afegir objectiu</button>
          )}
        </div>
        {goals.length === 0 && <p className="text-white/30 text-xs">Per exemple: entrada d&apos;un pis, un cotxe, un viatge, la jubilació.</p>}
        <div className="space-y-3">
          {goals.map((g, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[9rem_1fr_7rem_6rem_auto] gap-2 items-end">
              <label className="block col-span-2 sm:col-span-1">
                <span className="text-white/40 text-xs">Termini</span>
                <select className={input} value={g.horizon} onChange={e => setGoal(i, { horizon: e.target.value as Horizon })}>
                  {HORIZONS.map(h => <option key={h.value} value={h.value} className="bg-[#0d1f1a]">{h.label}</option>)}
                </select>
              </label>
              <label className="block col-span-2 sm:col-span-1">
                <span className="text-white/40 text-xs">Què vols aconseguir</span>
                <input className={input} maxLength={200} value={g.description} onChange={e => setGoal(i, { description: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-white/40 text-xs">Import (€)</span>
                <input type="number" inputMode="decimal" min={0} className={input} value={g.amount} onChange={e => setGoal(i, { amount: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-white/40 text-xs">Any</span>
                <input type="number" inputMode="numeric" min={2000} max={2100} className={input} value={g.targetYear} onChange={e => setGoal(i, { targetYear: e.target.value })} />
              </label>
              <button type="button" onClick={() => setGoals(gs => gs.filter((_, j) => j !== i))}
                className="col-span-2 sm:col-span-1 text-white/40 hover:text-red-400 text-xs py-2" aria-label={`Treure l'objectiu ${i + 1}`}>
                Treure
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-5 py-2 rounded-lg bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm disabled:opacity-50">
          {saving ? 'Desant…' : 'Desar'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-5 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10">
            Cancel·lar
          </button>
        )}
      </div>
    </form>
  );
}
