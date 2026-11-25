'use client';
// components/MonthlyReportView.tsx — cos de l'informe mensual (pantalla i impressió).
// El fan servir l'assessor (Generador d'informe mensual) i el client (els seus informes).
import type { MonthlyReportData } from '@/lib/portfolioReport';
import MonthlyReportOfficialView from '@/components/admin/MonthlyReportOfficial';
import AllocationSummary from '@/components/AllocationSummary';
import { allocationBreakdown, assetTypeLabel, classifyFund, managementLabel } from '@/lib/fundClassification';

const eur = (n: number) => n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MonthlyReportView({ report }: { report: MonthlyReportData }) {
  const pnlColor = report.metrics.pnlEur >= 0 ? 'text-positive' : 'text-negative';
  return (
    <div id="monthly-report" className="bg-surface border border-line rounded-2xl p-8 print:bg-white print:text-ink print:border-none print:rounded-none print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-line print:border-line">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-accent-soft border border-accent/40 rounded flex items-center justify-center">
              <span className="text-accent font-black text-xs print:hidden">F</span>
            </div>
            <span className="text-ink font-black print:text-ink">FACTOR OTC</span>
          </div>
          <h1 className="text-ink font-bold text-2xl mb-1 print:text-ink">Informe Mensual de Cartera</h1>
          <p className="text-ink-soft text-sm print:text-ink-muted">{report.clientName} · {report.portfolioName}</p>
        </div>
        <div className="text-right">
          <p className="text-ink-muted text-xs print:text-ink-muted">ID: {report.reportId}</p>
          <p className="text-ink-muted text-sm mt-1 print:text-ink-soft">
            {new Date(report.periodStart).toLocaleDateString('ca-ES')} – {new Date(report.periodEnd).toLocaleDateString('ca-ES')}
          </p>
          <p className="text-ink-muted text-xs mt-1 print:text-ink-muted">
            Generat: {new Date(report.generatedAt).toLocaleString('ca-ES')}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: report.asOf ? `Valor a ${new Date(report.asOf).toLocaleDateString('ca-ES')}` : 'Valor actual', value: `${eur(report.metrics.currentValue)} €` },
          { label: 'Aportació neta',   value: `${eur(report.metrics.netContributions)} €` },
          { label: 'Rendiment (€)',    value: `${report.metrics.pnlEur >= 0 ? '+' : ''}${eur(report.metrics.pnlEur)} €`, colored: true },
          { label: 'Rendiment (%)',    value: `${report.metrics.pnlPct >= 0 ? '+' : ''}${eur(report.metrics.pnlPct)} %`, colored: true },
        ].map(kpi => (
          <div key={kpi.label} className="bg-subtle rounded-xl p-4 print:bg-subtle print:rounded-none print:border print:border-line">
            <p className="text-ink-muted text-xs mb-1 print:text-ink-muted">{kpi.label}</p>
            <p className={`font-bold text-lg ${kpi.colored ? pnlColor : 'text-ink'} print:text-ink`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Resultat, evolució, pesos i operacions amb valors liquidatius oficials */}
      {report.official && <MonthlyReportOfficialView data={report.official} />}

      {/* Repartiment: renda variable / fixa i gestió activa / passiva. Els informes
          antics no el tenen desat: es calcula amb les principals posicions. */}
      {report.topHoldings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-ink font-semibold text-sm mb-3 print:text-ink">
            Repartiment de la cartera{report.asOf ? ` a ${new Date(report.asOf).toLocaleDateString('ca-ES')}` : ''}
          </h2>
          <AllocationSummary breakdown={report.mix ?? allocationBreakdown(report.topHoldings.map(h => ({ isin: h.isin ?? '', name: h.name, category: h.category, weight: h.value })))} />
        </div>
      )}

      {/* Top holdings */}
      {report.topHoldings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-ink font-semibold text-sm mb-3 print:text-ink">
            Principals posicions{report.asOf ? ` a ${new Date(report.asOf).toLocaleDateString('ca-ES')}` : ''}
          </h2>
          <div className="space-y-2">
            {report.topHoldings.map(h => { const cl = classifyFund(h.isin ?? '', h.category, h.name); return (
              <div key={h.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="min-w-0 truncate">
                      <span className="text-ink-soft text-xs print:text-ink-soft">{h.name}</span>
                      <span className="text-ink-muted text-[11px] print:text-ink-muted"> · {assetTypeLabel(cl)} · {managementLabel(cl)}</span>
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-ink-muted text-xs print:text-ink-muted">{h.value.toLocaleString('ca-ES', { maximumFractionDigits: 0 })} €</span>
                      <span className={`text-xs font-mono ${h.pnlPct >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {h.pnlPct >= 0 ? '+' : ''}{eur(h.pnlPct)} %
                      </span>
                      <span className="text-ink-muted text-xs w-10 text-right print:text-ink-muted">{h.weight.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} %</span>
                    </div>
                  </div>
                  <div className="h-1 bg-subtle rounded-full overflow-hidden print:bg-gray-200">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${Math.min(h.weight, 100)}%` }} />
                  </div>
                </div>
              </div>
            ); })}
          </div>
        </div>
      )}

      {/* Advisor comments */}
      {report.advisorComments && (
        <div className="mb-6">
          <h2 className="text-ink font-semibold text-sm mb-3 print:text-ink">Comentaris de l&apos;assessor</h2>
          <div className="bg-subtle border border-line rounded-xl p-4 print:bg-subtle print:border-line">
            <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap print:text-ink-soft">{report.advisorComments}</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 pt-6 border-t border-line print:border-line">
        <p className="text-ink-muted text-xs leading-relaxed print:text-ink-muted">
          Aquest informe és una eina de suport a la decisió i no constitueix assessorament financer regulat.
          Les dades de rendiment passades no garanteixen rendiments futurs. Factor OTC no executa operacions reals.
        </p>
      </div>
    </div>
  );
}
