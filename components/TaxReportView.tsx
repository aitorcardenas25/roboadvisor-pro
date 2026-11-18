'use client';
// components/TaxReportView.tsx — informe fiscal (IRPF) de les vendes i traspassos de fons.
// El fan servir l'assessor (fitxa del client) i el client (la seva cartera).
import { useEffect, useMemo, useState } from 'react';
import type { TaxReport } from '@/lib/taxReport';

const eur = (n: number) => n.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString('ca-ES', { maximumFractionDigits: 6 });
const fdate = (d: string) => new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('ca-ES');
const col = (n: number) => n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-white/70';

const CARD = 'bg-[#0d1f1a] border border-white/10 rounded-xl p-5';
const TH = 'text-left text-white/30 text-[11px] uppercase tracking-wide font-medium pb-2 pr-3 whitespace-nowrap';
const TD = 'py-1.5 pr-3 text-white/75 text-xs';

export default function TaxReportView({ url }: { url: string }) {
  const [report, setReport] = useState<TaxReport | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    fetch(url, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<{ report: TaxReport | null }>; })
      .then(d => { setReport(d.report); setYear(d.report?.years.at(-1)?.year ?? null); setState('ok'); })
      .catch(() => setState('error'));
  }, [url]);

  const y = useMemo(() => report?.years.find(x => x.year === year) ?? null, [report, year]);

  if (state === 'loading') return <div className={`${CARD} animate-pulse h-40`} />;
  if (state === 'error') return <div className={CARD}><p className="text-red-400 text-sm">No s&apos;ha pogut carregar l&apos;informe fiscal.</p></div>;

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h3 className="text-white font-semibold">Informe fiscal (IRPF)</h3>
          {report && report.years.length > 0 && (
            <select value={year ?? ''} onChange={e => setYear(Number(e.target.value))} aria-label="Exercici"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
              {report.years.map(x => <option key={x.year} value={x.year}>Exercici {x.year}</option>)}
            </select>
          )}
        </div>
        <p className="text-white/40 text-xs">Guanys i pèrdues de les vendes de fons, calculats pel mètode FIFO. Els traspassos entre fons no tributen.</p>
        <p role="note" className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200 text-xs leading-relaxed">
          Càlcul orientatiu, encara no revisat per un expert fiscal. Per fer la declaració, fes servir les dades que la teva entitat comunica a Hisenda.
        </p>

        {!report || report.years.length === 0 ? (
          <p className="text-white/50 text-sm mt-4">Encara no hi ha cap venda ni cap traspàs: no hi ha res a declarar.</p>
        ) : y && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { l: 'Guanys', v: eur(y.gains), c: col(y.gains) },
              { l: 'Pèrdues', v: eur(y.losses), c: col(y.losses) },
              { l: 'Resultat net', v: eur(y.net), c: col(y.net) },
              { l: 'Impost estimat', v: eur(y.estimatedTax), c: 'text-white' },
            ].map(k => (
              <div key={k.l} className="bg-white/5 rounded-xl p-3">
                <p className="text-white/40 text-[11px] mb-1">{k.l}</p>
                <p className={`font-bold ${k.c}`}>{k.v}</p>
              </div>
            ))}
          </div>
        )}
        {!!report?.warnings.length && (
          <ul className="mt-3 list-disc pl-5 text-amber-300/90 text-xs space-y-0.5">{report.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        )}
      </div>

      {y && y.sales.length > 0 && (
        <div className={`${CARD} overflow-x-auto`}>
          <h4 className="text-white/80 text-sm font-semibold mb-3">Vendes (guanys i pèrdues patrimonials)</h4>
          <table className="w-full min-w-[640px]">
            <thead><tr>
              <th className={TH}>Data</th><th className={TH}>Fons</th><th className={`${TH} text-right`}>Particip.</th>
              <th className={TH}>Adquirides</th><th className={`${TH} text-right`}>Valor de transmissió</th>
              <th className={`${TH} text-right`}>Valor d&apos;adquisició</th><th className={`${TH} text-right`}>Guany / pèrdua</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {y.sales.map((s, i) => (
                <tr key={i}>
                  <td className={TD}>{fdate(s.date)}</td>
                  <td className={TD}>
                    {s.name}<span className="text-white/30"> · {s.isin}</span>
                    {s.partialTransfer && <span className="block text-white/40 text-[11px]">Part d&apos;un traspàs no reinvertida</span>}
                    {s.washSale && <span className="block text-amber-300/90 text-[11px]">Recompra del mateix fons en menys d&apos;un any: la pèrdua es pot haver de diferir</span>}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{qty(s.quantity)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{s.acquiredFrom === s.acquiredTo ? fdate(s.acquiredFrom) : `${fdate(s.acquiredFrom)} – ${fdate(s.acquiredTo)}`}</td>
                  <td className={`${TD} text-right tabular-nums`}>{eur(s.transmissionValue)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{eur(s.acquisitionValue)}</td>
                  <td className={`${TD} text-right tabular-nums font-semibold ${col(s.gain)}`}>{eur(s.gain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {y && y.transfers.length > 0 && (
        <div className={CARD}>
          <h4 className="text-white/80 text-sm font-semibold mb-3">Traspassos (no tributen)</h4>
          <div className="space-y-3">
            {y.transfers.map((t, i) => (
              <div key={i} className="text-xs text-white/70">
                <p className="text-white/50 mb-1">{fdate(t.date)} · guany ajornat {eur(t.deferredGain)}</p>
                <p>De: {t.from.map(f => `${f.name} (${eur(f.value)}, cost ${eur(f.cost)})`).join(' · ')}</p>
                <p>A: {t.to.map(f => `${f.name} (${eur(f.value)}, cost heretat ${eur(f.inheritedCost)})`).join(' · ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report && report.open.length > 0 && (
        <div className={`${CARD} overflow-x-auto`}>
          <h4 className="text-white/80 text-sm font-semibold mb-1">Cost fiscal de les participacions actuals</h4>
          <p className="text-white/40 text-xs mb-3">Per lots, en l&apos;ordre en què es vendrien (FIFO). Inclou el cost i la data heretats dels traspassos.</p>
          <table className="w-full min-w-[480px]">
            <thead><tr>
              <th className={TH}>Fons</th><th className={TH}>Data d&apos;adquisició</th>
              <th className={`${TH} text-right`}>Participacions</th><th className={`${TH} text-right`}>Cost</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {report.open.map((l, i) => (
                <tr key={i}>
                  <td className={TD}>{l.name}<span className="text-white/30"> · {l.isin}</span></td>
                  <td className={TD}>{fdate(l.date)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{qty(l.quantity)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{eur(l.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-white/30 text-[11px] leading-relaxed">
        Estimació orientativa per a la base de l&apos;estalvi (escala 2025: 19 % fins a 6.000 €, 21 % fins a 50.000 €, 23 % fins a 200.000 €,
        27 % fins a 300.000 € i 30 % a partir d&apos;aquí). No inclou altres rendiments (dividends, interessos…) ni pèrdues d&apos;anys anteriors,
        i les dades fiscals que valen són les que comunica l&apos;entitat a Hisenda. No és assessorament fiscal.
      </p>
    </div>
  );
}
