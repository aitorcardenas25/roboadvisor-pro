// components/admin/MonthlyReportOfficial.tsx
// Seccions de l'informe mensual calculades amb els valors liquidatius oficials:
// resultat del període, evolució, pesos objectiu vs. actuals, operacions i revisions.
// Pensat per a pantalla (fons fosc) i impressió (fons blanc).
import type { MonthlyReportOfficial } from '@/lib/portfolioReport';

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number, sign = true) => `${sign && n > 0 ? '+' : ''}${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const fdate = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('ca-ES');
const mon = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleString('ca-ES', { month: 'short' }).replace(/^de |^d’|^d'/, '') + ' ' + d.slice(2, 4);

const H2 = 'text-ink font-semibold text-sm mb-3 font-medium print:text-ink';
const TH = 'text-left text-ink-muted text-[11px] font-medium font-medium pb-2 pr-2 print:text-ink-muted';
const TD = 'py-1.5 pr-2 text-ink text-xs print:text-ink';

/** Gràfic de línia en SVG (s'imprimeix bé, sense dependències). */
function EvolutionSvg({ points }: { points: { date: string; value: number; invested: number }[] }) {
  const W = 640, H = 160, L = 48, B = 22, T = 8;
  const max = Math.max(...points.map(p => Math.max(p.value, p.invested)));
  const min = Math.min(...points.map(p => Math.min(p.value, p.invested)));
  const lo = Math.max(0, min - (max - min) * 0.15), hi = max + (max - min) * 0.1 || max + 1;
  const x = (i: number) => L + (points.length === 1 ? 0 : i * (W - L - 8) / (points.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const line = (k: 'value' | 'invested') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolució del valor de la cartera">
      {ticks.map(t => (
        <g key={t}>
          <line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.45}>{(t / 1000).toFixed(t >= 10000 ? 0 : 1)}K</text>
        </g>
      ))}
      <path d={line('invested')} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" strokeWidth={1.2} />
      <path d={line('value')} fill="none" stroke="#2d9d6a" strokeWidth={2} />
      {points.map((p, i) => (i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) && (
        <text key={p.date} x={x(i)} y={H - 6} textAnchor={i === points.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={10} fill="currentColor" fillOpacity={0.45}>{mon(p.date)}</text>
      ))}
    </svg>
  );
}

export default function MonthlyReportOfficialView({ data }: { data: MonthlyReportOfficial }) {
  const p = data.performance;
  const col = (n: number) => n >= 0 ? 'text-positive print:text-positive' : 'text-negative print:text-negative';
  return (
    <>
      {/* Resultat del període */}
      <div className="mb-8">
        <h2 className={H2}>Resultat del període</h2>
        {p ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { l: `Valor a ${fdate(new Date(Date.parse(p.start) - 86_400_000).toISOString())}`, v: eur(p.valueStart) },
                { l: `Valor a ${fdate(p.end)}`, v: eur(p.valueEnd) },
                { l: 'Aportacions netes del període', v: eur(p.netFlows) },
                { l: 'Guany del període', v: eur(p.gain), c: col(p.gain) },
                { l: 'Rendibilitat del període', v: pct(p.periodReturn), c: col(p.periodReturn) },
                { l: 'Rendibilitat acumulada', v: pct(p.cumulativeReturn), c: col(p.cumulativeReturn) },
              ].map(k => (
                <div key={k.l} className="bg-subtle rounded-lg p-3 print:bg-subtle print:rounded-none print:border print:border-line">
                  <p className="text-ink-muted text-[11px] mb-1 print:text-ink-muted">{k.l}</p>
                  <p className={`font-bold ${k.c ?? 'text-ink print:text-ink'}`}>{k.v}</p>
                </div>
              ))}
            </div>
            <p className="text-ink-muted text-[11px] mt-2 print:text-ink-muted">
              Valor = participacions × valor liquidatiu oficial de cada fons a la data (o l&apos;últim dia anterior amb preu).
              La rendibilitat del període descompta les aportacions (mètode Modified Dietz).
            </p>
          </>
        ) : (
          <p className="text-warning/80 text-sm print:text-warning">{data.note ?? 'No hi ha prou dades per calcular el resultat del període.'}</p>
        )}
      </div>

      {/* Evolució */}
      {data.evolution.length >= 2 && (
        <div className="mb-8 text-ink print:text-ink">
          <h2 className={H2}>Evolució (finals de mes)</h2>
          <EvolutionSvg points={data.evolution} />
          <p className="text-ink-muted text-[11px] mt-1 print:text-ink-muted">Línia contínua: valor de la cartera. Línia discontínua: capital aportat.</p>
        </div>
      )}

      {/* Pesos */}
      {data.allocation && (
        <div className="mb-8">
          <h2 className={H2}>Pes objectiu vs. pes actual</h2>
          <table className="w-full">
            <thead><tr>
              <th className={TH}>Fons</th><th className={`${TH} text-right`}>Objectiu (v{data.allocation.targetVersion})</th>
              <th className={`${TH} text-right`}>Actual</th><th className={`${TH} text-right`}>Diferència</th>
            </tr></thead>
            <tbody className="divide-y divide-line print:divide-line">
              {data.allocation.rows.map(r => (
                <tr key={r.isin}>
                  <td className={TD}>{r.name}</td>
                  <td className={`${TD} text-right tabular-nums`}>{pct(r.target, false)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{pct(r.current, false)}</td>
                  <td className={`${TD} text-right tabular-nums ${Math.abs(r.diff) >= data.allocation!.threshold ? 'text-warning print:text-warning font-semibold' : ''}`}>
                    {r.diff > 0 ? '+' : ''}{r.diff.toLocaleString('ca-ES', { maximumFractionDigits: 2 })} pp
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink-muted text-[11px] mt-2 print:text-ink-muted">
            {data.allocation.rows.some(r => Math.abs(r.diff) >= data.allocation!.threshold)
              ? `Algun fons s'ha desviat ${data.allocation.threshold} punts o més del pes objectiu: es valorarà reequilibrar la cartera.`
              : `Tots els fons són a menys de ${data.allocation.threshold} punts del pes objectiu.`}
          </p>
        </div>
      )}

      {/* Operacions */}
      <div className="mb-8">
        <h2 className={H2}>Operacions del període</h2>
        {data.operations.length === 0 ? (
          <p className="text-ink-muted text-sm print:text-ink-soft">Cap operació en aquest període.</p>
        ) : (
          <table className="w-full">
            <thead><tr>
              <th className={TH}>Data</th><th className={TH}>Tipus</th><th className={TH}>Fons</th>
              <th className={`${TH} text-right`}>Participacions</th><th className={`${TH} text-right`}>Preu</th><th className={`${TH} text-right`}>Import</th>
            </tr></thead>
            <tbody className="divide-y divide-line print:divide-line">
              {data.operations.map((o, i) => (
                <tr key={i}>
                  <td className={TD}>{fdate(o.date)}</td><td className={TD}>{o.type}</td><td className={TD}>{o.name}</td>
                  <td className={`${TD} text-right tabular-nums`}>{o.quantity.toLocaleString('ca-ES', { maximumFractionDigits: 6 })}</td>
                  <td className={`${TD} text-right tabular-nums`}>{eur(o.price)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{eur(o.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Revisions */}
      {data.review.due && (
        <div className="mb-8 p-3 rounded-lg border border-warning/25 bg-warning/5 print:border-warning print:bg-warning">
          <h2 className={H2}>Revisió pendent</h2>
          <ul className="list-disc pl-5 text-warning/90 text-sm print:text-warning">
            {data.review.detail.map(d => <li key={d}>{d}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
