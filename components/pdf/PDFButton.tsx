// components/pdf/PDFButton.tsx
'use client';

import { useState } from 'react';
import { pdf }      from '@react-pdf/renderer';
import { FactorOTCReport } from './FactorOTCReport';
import { captureAllCharts } from './ChartCapture';
import { ScoringResult }    from '@/lib/scoring';
import { Portfolio }         from '@/lib/portfolio';
import { PortfolioMetrics }  from '@/lib/metrics';
import { MonteCarloResult }  from '@/lib/monteCarlo';
import { FinancialReport }   from '@/lib/report';
import { InvestorQuestionnaire } from '@/lib/scoring';
import { HistoricalChartPoint }  from '@/lib/metrics';

interface Props {
  questionnaire: InvestorQuestionnaire;
  scoring:       ScoringResult;
  portfolio:     Portfolio;
  metrics:       PortfolioMetrics;
  monteCarlo:    MonteCarloResult;
  report:        FinancialReport;
  historical:    HistoricalChartPoint[];
}

const CHART_IDS = [
  'chart-allocation',
  'chart-radar',
  'chart-historical',
  'chart-montecarlo',
  'chart-rolling',
  'chart-risk',
  'chart-scoring',
  'chart-risk-donut',
  'chart-frontier',
  'chart-heatmap',
];

type Step = 'idle' | 'charts' | 'pdf' | 'done' | 'error';

export default function PDFButton({
  questionnaire, scoring, portfolio,
  metrics, monteCarlo, report, historical,
}: Props) {
  const [step, setStep] = useState<Step>('idle');

  const handleGenerate = async () => {
    setStep('charts');

    try {
      // 1. Capturar tots els gràfics
      const charts = await captureAllCharts(CHART_IDS);

      setStep('pdf');

      // 2. Generar el PDF amb els gràfics
      const blob = await pdf(
        <FactorOTCReport
          questionnaire={questionnaire}
          scoring={scoring}
          portfolio={portfolio}
          metrics={metrics}
          monteCarlo={monteCarlo}
          report={report}
          charts={charts}
          historical={historical}
        />
      ).toBlob();

      // 3. Descarregar
      const url     = URL.createObjectURL(blob);
      const link    = document.createElement('a');
      link.href     = url;
      link.download = `Factor_OTC_Informe_${scoring.profile}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setStep('done');
      setTimeout(() => setStep('idle'), 3000);

    } catch (error) {
      console.error('Error generant PDF:', error);
      setStep('error');
      setTimeout(() => setStep('idle'), 3000);
    }
  };

  const labels: Record<Step, string> = {
    idle:   '📄 Descarregar Informe PDF (12 pàgines)',
    charts: '📊 Capturant gràfics...',
    pdf:    '⚙️ Generant PDF...',
    done:   '✅ PDF descarregat!',
    error:  '❌ Error. Torna-ho a intentar',
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={step !== 'idle' && step !== 'error'}
      className={`flex items-center gap-2 px-8 py-3 font-bold rounded-lg text-sm transition-all shadow-md ${
        step === 'done'  ? 'bg-emerald-500 text-white' :
        step === 'error' ? 'bg-red-500 text-white cursor-pointer' :
        step !== 'idle'  ? 'bg-[#c9a84c]/60 text-[#0d1f1a] cursor-wait' :
        'bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] cursor-pointer'
      }`}>
      {(step === 'charts' || step === 'pdf') && (
        <span className="animate-spin">⏳</span>
      )}
      <span>{labels[step]}</span>
    </button>
  );
}