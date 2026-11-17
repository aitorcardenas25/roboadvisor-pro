'use client';
// components/MonthlyReportView.tsx — cos de l'informe mensual (pantalla i impressió).
// El fan servir l'assessor (Generador d'informe mensual) i el client (els seus informes).
import type { MonthlyReportData } from '@/lib/portfolioReport';
import MonthlyReportOfficialView from '@/components/admin/MonthlyReportOfficial';

export default function MonthlyReportView({ report }: { report: MonthlyReportData }) {
  const pnlColor = report.metrics.pnlEur >= 0 ? 'text-green-400' : 'text-red-400';
  return (
    <div id="monthly-report" className="bg-[#0d1f1a] border border-white/10 rounded-2xl p-8 print:bg-white print:text-black print:border-none print:rounded-none print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/10 print:border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-[#c9a84c]/20 border border-[#c9a84c]/40 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-xs print:hidden">F</span>
            </div>
            <span className="text-white font-black tracking-wider print:text-black">FACTOR OTC</span>
          </div>
          <h1 className="text-white font-bold text-2xl mb-1 print:text-black">Informe Mensual de Cartera</h1>
          <p className="text-white/50 text-sm print:text-gray-500">{report.clientName} · {report.portfolioName}</p>
        </div>
        <div className="text-right">
          <p className="text-white/30 text-xs print:text-gray-400">ID: {report.reportId}</p>
          <p className="text-white/40 text-sm mt-1 print:text-gray-600">
            {new Date(report.periodStart).toLocaleDateString('ca-ES')} – {new Date(report.periodEnd).toLocaleDateString('ca-ES')}
          </p>
          <p className="text-white/20 text-xs mt-1 print:text-gray-400">
            Generat: {new Date(report.generatedAt).toLocaleString('ca-ES')}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Valor actual',     value: `${report.metrics.currentValue.toFixed(2)} €` },
          { label: 'Aportació neta',   value: `${report.metrics.netContributions.toFixed(2)} €` },
          { label: 'Rendiment (€)',    value: `${report.metrics.pnlEur >= 0 ? '+' : ''}${report.metrics.pnlEur.toFixed(2)} €`, colored: true },
          { label: 'Rendiment (%)',    value: `${report.metrics.pnlPct >= 0 ? '+' : ''}${report.metrics.pnlPct.toFixed(2)}%`, colored: true },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/5 rounded-xl p-4 print:bg-gray-50 print:rounded-none print:border print:border-gray-200">
            <p className="text-white/40 text-xs mb-1 print:text-gray-500">{kpi.label}</p>
            <p className={`font-bold text-lg ${kpi.colored ? pnlColor : 'text-white'} print:text-black`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Resultat, evolució, pesos i operacions amb valors liquidatius oficials */}
      {report.official && <MonthlyReportOfficialView data={report.official} />}

      {/* Top holdings */}
      {report.topHoldings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide print:text-black">Principals posicions</h2>
          <div className="space-y-2">
            {report.topHoldings.map(h => (
              <div key={h.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/70 text-xs truncate print:text-gray-700">{h.name}</span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-white/40 text-xs print:text-gray-500">{h.value.toFixed(0)} €</span>
                      <span className={`text-xs font-mono ${h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                      </span>
                      <span className="text-white/30 text-xs w-10 text-right print:text-gray-400">{h.weight.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden print:bg-gray-200">
                    <div className="h-full bg-[#c9a84c]/60 rounded-full" style={{ width: `${Math.min(h.weight, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advisor comments */}
      {report.advisorComments && (
        <div className="mb-6">
          <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide print:text-black">Comentaris de l&apos;assessor</h2>
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 print:bg-gray-50 print:border-gray-200">
            <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap print:text-gray-700">{report.advisorComments}</p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-8 pt-6 border-t border-white/5 print:border-gray-200">
        <p className="text-white/20 text-xs leading-relaxed print:text-gray-400">
          Aquest informe és una eina de suport a la decisió i no constitueix assessorament financer regulat.
          Les dades de rendiment passades no garanteixen rendiments futurs. Factor OTC no executa operacions reals.
        </p>
      </div>
    </div>
  );
}
