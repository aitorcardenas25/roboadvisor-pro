'use client';

// Simulador d'estalvi. Tot el càlcul és a lib/savingsSimulator.ts.
import { useMemo, useState } from 'react';
import { simulateSavings, requiredMonthly, RETURN_SCENARIOS, ECB_INFLATION_TARGET } from '@/lib/savingsSimulator';

interface Goal { horizon: string; description: string; amount?: number; targetYear?: number }

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const card = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
const input = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/60';

function NumberField({ label, value, onChange, min = 0, max, step = 1, suffix }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-white/40 text-xs">{label}{suffix ? ` (${suffix})` : ''}</span>
      <input type="number" inputMode="decimal" className={input} value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
        onChange={e => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
    </label>
  );
}

export default function SavingsSimulator({ initialSavings, monthlyMargin, goals = [] }: {
  initialSavings?: number; monthlyMargin?: number; goals?: Goal[];
}) {
  const [initial, setInitial] = useState(Math.max(0, Math.round(initialSavings ?? 0)));
  const [monthly, setMonthly] = useState(Math.max(0, Math.round(monthlyMargin && monthlyMargin > 0 ? monthlyMargin : 100)));
  const [years, setYears]     = useState(20);
  const [rate, setRate]       = useState<number>(2);

  const sim = useMemo(() => simulateSavings({ initial, monthly, years, annualReturnPct: rate }), [initial, monthly, years, rate]);
  const milestones = sim ? sim.rows.filter(r => r.year % 5 === 0 || r.year === sim.rows.length) : [];
  const thisYear = new Date().getFullYear();
  const goalsWithTarget = goals.filter(g => g.amount && g.targetYear && g.targetYear > thisYear);

  return (
    <div className={card}>
      <h3 className="text-white/50 text-xs uppercase tracking-widest mb-1">Simulador d&apos;estalvi</h3>
      <p className="text-white/40 text-xs mb-4">Quant pot sumar el que estalvies cada mes. Canvia les xifres per provar.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <NumberField label="Ja tinc" suffix="€" value={initial} onChange={setInitial} step={100} />
        <NumberField label="Aporto cada mes" suffix="€" value={monthly} onChange={setMonthly} step={10} />
        <NumberField label="Durant" suffix="anys" value={years} onChange={setYears} min={1} max={60} />
        <div>
          <span className="text-white/40 text-xs">Rendiment anual (hipòtesi)</span>
          <div className="flex gap-1 mt-1" role="group" aria-label="Rendiment anual hipotètic">
            {RETURN_SCENARIOS.map(r => (
              <button key={r} type="button" onClick={() => setRate(r)} aria-pressed={rate === r}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${rate === r ? 'bg-[#c9a84c] text-[#0d1f1a] font-bold' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {!sim ? (
        <p className="text-amber-200/80 text-sm">Revisa les xifres: han de ser positives i entre 1 i 60 anys.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><p className="text-white/30 text-xs">Hauràs aportat</p><p className="text-white font-bold">{eur(sim.contributed)}</p></div>
            <div><p className="text-white/30 text-xs">Tindries</p><p className="text-[#c9a84c] font-bold text-lg">{eur(sim.nominal)}</p></div>
            <div><p className="text-white/30 text-xs">Guany per rendiment</p><p className="text-white font-bold">{eur(sim.gain)}</p></div>
            <div><p className="text-white/30 text-xs">En euros d&apos;avui</p><p className="text-white font-bold">{eur(sim.real)}</p>
              <p className="text-white/30 text-xs">amb inflació del {ECB_INFLATION_TARGET}%</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-white/30 text-xs text-left">
                <th className="py-1 pr-4 font-normal">Any</th><th className="py-1 pr-4 font-normal">Aportat</th>
                <th className="py-1 pr-4 font-normal">Valor</th><th className="py-1 font-normal">En euros d&apos;avui</th>
              </tr></thead>
              <tbody>{milestones.map(r => (
                <tr key={r.year} className="border-t border-white/5 text-white/70">
                  <td className="py-1.5 pr-4">{r.year}</td><td className="py-1.5 pr-4">{eur(r.contributed)}</td>
                  <td className="py-1.5 pr-4 text-white">{eur(r.nominal)}</td><td className="py-1.5">{eur(r.real)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>
      )}

      {goalsWithTarget.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Per arribar als objectius (amb un {rate}% anual)</p>
          <ul className="space-y-1.5">
            {goalsWithTarget.map((g, i) => {
              const m = requiredMonthly(g.amount!, (g.targetYear! - thisYear) * 12, 0, rate);
              return (
                <li key={i} className="text-sm text-white/70">
                  {g.description}: <span className="text-white">{eur(g.amount!)}</span> el {g.targetYear}
                  {m !== null && <> → cal estalviar <span className="text-[#c9a84c] font-semibold">{eur(m)}/mes</span></>}
                </li>
              );
            })}
          </ul>
          <p className="text-white/30 text-xs mt-2">Calculat des de zero per a cada objectiu, sense comptar l&apos;estalvi que ja tens.</p>
        </div>
      )}

      <p className="text-white/30 text-xs mt-4">
        El rendiment és una hipòtesi per comparar escenaris, no una previsió. Les inversions poden perdre valor;
        un compte remunerat o un dipòsit tenen menys risc i menys rendiment. No és una recomanació.
      </p>
    </div>
  );
}
