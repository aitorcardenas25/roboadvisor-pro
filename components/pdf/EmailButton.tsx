// components/pdf/EmailButton.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pdf }           from '@react-pdf/renderer';
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
  'chart-allocation', 'chart-radar', 'chart-historical',
  'chart-montecarlo', 'chart-rolling', 'chart-risk',
  'chart-scoring', 'chart-risk-donut',
];

type Step =
  | 'idle'
  | 'input'
  | 'charts'
  | 'pdf'
  | 'sending'
  | 'success'
  | 'error';

export default function EmailButton({
  questionnaire, scoring, portfolio,
  metrics, monteCarlo, report, historical,
}: Props) {
  const [step, setStep]   = useState<Step>('idle');
  const [email, setEmail] = useState(questionnaire.clientEmail ?? '');
  const [error, setError] = useState('');

  const handleSend = async () => {
    // Validació email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Introdueix un email vàlid.');
      return;
    }
    setError('');

    try {
      // 1. Capturar gràfics
      setStep('charts');
      const charts = await captureAllCharts(CHART_IDS);

      // 2. Generar PDF
      setStep('pdf');
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

      // 3. Enviar per email
      setStep('sending');
      const formData = new FormData();
      formData.append('pdf',     blob, 'informe.pdf');
      formData.append('email',   email);
      formData.append('name',    questionnaire.clientName);
      formData.append('profile', scoring.profile);
      formData.append('score',   `${scoring.scorePercentage}%`);
      formData.append('date',    report.metadata.generatedDate);

      const res = await fetch('/api/send-report', {
        method: 'POST',
        body:   formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Error enviant l\'email');
      }

      setStep('success');
      setTimeout(() => setStep('idle'), 4000);

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error desconegut');
      setStep('error');
      setTimeout(() => { setStep('input'); setError(''); }, 4000);
    }
  };

  // ── IDLE: botó inicial ──────────────────────────────────────────────────────
  if (step === 'idle') {
    return (
      <motion.button
        onClick={() => setStep('input')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-6 py-3 border border-[#c9a84c]/40 text-[#c9a84c] rounded-lg text-sm font-medium hover:bg-[#c9a84c]/10 transition-all">
        <span>✉️</span>
        <span>Enviar per email</span>
      </motion.button>
    );
  }

  // ── INPUT: formulari email ──────────────────────────────────────────────────
  if (step === 'input') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-md">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>✉️</span> Enviar informe per email
          </p>

          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="correu@exemple.com"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] bg-white"
              autoFocus
            />
            <motion.button
              onClick={handleSend}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 bg-[#c9a84c] text-[#0d1f1a] font-bold rounded-lg text-sm hover:bg-[#b8963f] transition-all">
              Enviar
            </motion.button>
            <motion.button
              onClick={() => { setStep('idle'); setError(''); }}
              whileHover={{ scale: 1.03 }}
              className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition-all">
              ✕
            </motion.button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-500 text-xs mt-2">
              ⚠️ {error}
            </motion.p>
          )}

          <p className="text-xs text-gray-400 mt-2">
            S'enviarà el PDF complet de 10 pàgines adjunt a l'email.
          </p>
        </div>
      </motion.div>
    );
  }

  // ── PROCESSING: estats de progrés ───────────────────────────────────────────
  const stepLabels: Partial<Record<Step, { icon: string; text: string; sub: string }>> = {
    charts:  { icon: '📊', text: 'Capturant gràfics...',    sub: 'Generant les imatges del PDF' },
    pdf:     { icon: '📄', text: 'Generant PDF...',          sub: 'Creant el document de 10 pàgines' },
    sending: { icon: '✉️', text: 'Enviant per email...',     sub: `Destinatari: ${email}` },
    success: { icon: '✅', text: 'Email enviat!',            sub: `Informe enviat a ${email}` },
    error:   { icon: '❌', text: 'Error en l\'enviament',    sub: error },
  };

  const current = stepLabels[step];
  const isError   = step === 'error';
  const isSuccess = step === 'success';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${
        isSuccess ? 'bg-emerald-50 border-emerald-200' :
        isError   ? 'bg-red-50 border-red-200' :
        'bg-blue-50 border-blue-200'
      }`}>
      <motion.span
        className="text-xl"
        animate={!isSuccess && !isError ? { rotate: [0, 360] } : {}}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
        {current?.icon}
      </motion.span>
      <div>
        <p className={`text-sm font-semibold ${
          isSuccess ? 'text-emerald-700' :
          isError   ? 'text-red-700'     :
          'text-blue-700'
        }`}>
          {current?.text}
        </p>
        <p className={`text-xs ${
          isSuccess ? 'text-emerald-500' :
          isError   ? 'text-red-500'     :
          'text-blue-500'
        }`}>
          {current?.sub}
        </p>
      </div>

      {/* Barra de progrés */}
      {!isSuccess && !isError && (
        <div className="ml-auto w-20 bg-blue-100 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-1.5 rounded-full bg-blue-500"
            animate={{ width: ['0%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      )}
    </motion.div>
  );
}