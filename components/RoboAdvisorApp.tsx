'use client';
const EmailButton = dynamic(
  () => import('@/components/pdf/EmailButton'),
  { ssr: false }
);
import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  InvestorQuestionnaire, validateQuestionnaire, calculateScore,
  getProfileLabel, getProfileDescription, getProfileColor,
  getProfileIcon, ValidationResult, ScoringResult,
} from '@/lib/scoring';
import { buildPortfolio, Portfolio } from '@/lib/portfolio';
import {
  calculatePortfolioMetrics, generateSimulatedHistoricalData,
  calculateDrawdownSeries, getMetricsStatusLabel,
  PortfolioMetrics, HistoricalChartPoint,
} from '@/lib/metrics';
import {
  runPortfolioMonteCarlo, buildScenarioAnalysis,
  formatMonteCarloValue, MonteCarloResult,
} from '@/lib/monteCarlo';
import { generateReport, FinancialReport, LEGAL_DISCLAIMER } from '@/lib/report';
import { getDataStatusColor } from '@/lib/products';
import HiddenCharts from '@/components/pdf/HiddenCharts';
import {
  AnimatedKpi, AnimatedProgressBar, LoadingSpinner,
  StepTransition, AnimatedCard,
} from '@/components/animations';

const PDFButton = dynamic(
  () => import('@/components/pdf/PDFButton'),
  { ssr: false }
);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PROFILE_COLORS = {
  conservador: '#10b981', moderat: '#3b82f6',
  dinamic:     '#f59e0b', agressiu: '#ef4444',
};
const ASSET_COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];
const STEPS = [
  { id: 1, label: 'Dades personals' }, { id: 2, label: 'Objectiu' },
  { id: 3, label: 'Coneixement' },     { id: 4, label: 'Risc' },
  { id: 5, label: 'Preferències' },    { id: 6, label: 'Resultats' },
];

const DEFAULT_Q: InvestorQuestionnaire = {
  clientName:           '',
  clientEmail:          '',
  age:                  35,
  annualIncome:         40000,
  monthlyExpenses:      1800,
  currentSavings:       25000,
  netWorth:             50000,
  totalDebt:            5000,
  financialGoal:        'creixement-moderat',
  investmentHorizon:    10,
  targetAmount:         100000,
  initialInvestment:    15000,
  monthlyContribution:  300,
  percentageToInvest:   60,
  financialKnowledge:   'intermedi',
  investmentExperience: '1-3-anys',
  lossTolerance:        'fins-10',
  reactionToDrops:      'no-fer-res',
  worstAcceptableLoss:  10,
  esgPreference:        'no-importa',
  liquidityNeed:        'potser-3-anys',
};

interface Props {
  onBack: () => void;
}

export default function RoboAdvisorApp({ onBack }: Props) {
  const [step, setStep]             = useState(1);
  const [prevStep, setPrevStep]     = useState(1);
  const [q, setQ]                   = useState<InvestorQuestionnaire>(DEFAULT_Q);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [scoring, setScoring]       = useState<ScoringResult | null>(null);
  const [portfolio, setPortfolio]   = useState<Portfolio | null>(null);
  const [metrics, setMetrics]       = useState<PortfolioMetrics | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [report, setReport]         = useState<FinancialReport | null>(null);
  const [historical, setHistorical] = useState<HistoricalChartPoint[]>([]);
  const [activeTab, setActiveTab]   = useState('resum');
  const [loading, setLoading]       = useState(false);

  const update = useCallback((field: keyof InvestorQuestionnaire, value: unknown) => {
    setQ(prev => ({ ...prev, [field]: value }));
  }, []);

  const num = (val: string) => parseFloat(val) || 0;

  const goToStep = (newStep: number) => {
    setPrevStep(step);
    setStep(newStep);
  };

  const calculate = useCallback(() => {
    const val = validateQuestionnaire(q);
    setValidation(val);
    if (!val.isValid) return;
    setLoading(true);
    setTimeout(() => {
      const sc   = calculateScore(q);
      const port = buildPortfolio(sc.profile, q);
      const met  = calculatePortfolioMetrics(port);
      const mc   = runPortfolioMonteCarlo(port, {
        initialInvestment:   q.initialInvestment,
        monthlyContribution: q.monthlyContribution,
        investmentHorizon:   q.investmentHorizon,
        targetAmount:        q.targetAmount,
      });
      const hist = generateSimulatedHistoricalData(port, 5);
      const rep  = generateReport(q, sc, port, met, mc);
      setScoring(sc); setPortfolio(port); setMetrics(met);
      setMonteCarlo(mc); setHistorical(hist); setReport(rep);
      setPrevStep(5);
      setStep(6);
      setLoading(false);
    }, 1200);
  }, [q]);

  const reset = () => {
    setPrevStep(1);
    setStep(1);
    setQ(DEFAULT_Q);
    setValidation(null);
    setScoring(null);
    setPortfolio(null);
    setMetrics(null);
    setMonteCarlo(null);
    setReport(null);
    setHistorical([]);
    setActiveTab('resum');
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('ca-ES', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    }).format(n);

  // ─── SUBCOMPONENTS ──────────────────────────────────────────────────────────

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#c9a84c] bg-white transition-all duration-200";

  const Field = ({ label, hint, children }: {
    label: string; hint?: string; children: React.ReactNode;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );

  const RadioCard = ({ selected, onClick, label, desc }: {
    selected: boolean; onClick: () => void; label: string; desc: string;
  }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
        selected
          ? 'border-[#c9a84c] bg-amber-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}>
      {selected && (
        <motion.div
          layoutId="radioSelected"
          className="absolute inset-0 rounded-xl border-2 border-[#c9a84c] -z-10"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <span className="font-medium text-sm text-gray-800">{label}</span>
      <span className="ml-2 text-xs text-gray-500">{desc}</span>
    </motion.button>
  );

  const MiniStat = ({ label, value, good }: {
    label: string; value: string; good: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}>
      <p className={`text-lg font-bold ${good ? 'text-emerald-700' : 'text-amber-600'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-600">{label}</p>
    </motion.div>
  );

  const KpiCard = ({ label, value, sub, icon, color }: {
    label: string; value: string; sub?: string; icon: string; color: string;
  }) => {
    const colors: Record<string, string> = {
      blue:   'bg-blue-50 border-blue-200',
      green:  'bg-emerald-50 border-emerald-200',
      amber:  'bg-amber-50 border-amber-200',
      purple: 'bg-purple-50 border-purple-200',
    };
    return (
      <div className={`rounded-xl p-4 border ${colors[color] ?? colors.blue}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{icon}</span>
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    );
  };

  const Card = ({ title, badge, children }: {
    title: string; badge?: string; children: React.ReactNode;
  }) => (
    <motion.div
      className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            {badge}
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );

  const CompareRow = ({ label, portfolio: p, benchmark: b, positive }: {
    label: string; portfolio: string; benchmark: string; positive: boolean;
  }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex gap-4">
        <span className={`text-sm font-bold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>{p}</span>
        <span className="text-sm text-gray-400">{b}</span>
      </div>
    </div>
  );
  // ─── STEPS ───────────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <motion.h2
        className="text-xl font-semibold text-gray-800"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}>
        Dades personals i financeres
      </motion.h2>

      {/* Identificació del client */}
      <motion.div
        className="bg-[#0d1f1a]/5 rounded-xl p-4 border border-[#c9a84c]/30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}>
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>👤</span> Identificació del client
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nom complet *" hint="Apareixerà a l'informe PDF">
            <input type="text" value={q.clientName}
              placeholder="Ex: Joan Garcia Martínez"
              onChange={e => update('clientName', e.target.value)}
              className={inputCls} />
          </Field>
          <Field label="Email (opcional)" hint="Per rebre l'informe per correu">
            <input type="email" value={q.clientEmail ?? ''}
              placeholder="Ex: joan@email.com"
              onChange={e => update('clientEmail', e.target.value)}
              className={inputCls} />
          </Field>
        </div>
      </motion.div>

      {/* Dades financeres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          { label: 'Edat', hint: 'Entre 18 i 100 anys', field: 'age', value: q.age, min: 18, max: 100 },
          { label: 'Ingressos anuals bruts (€)', field: 'annualIncome', value: q.annualIncome, min: 0 },
          { label: 'Despeses mensuals (€)', field: 'monthlyExpenses', value: q.monthlyExpenses, min: 0 },
          { label: 'Estalvis actuals (€)', field: 'currentSavings', value: q.currentSavings, min: 0 },
          { label: 'Patrimoni net total (€)', field: 'netWorth', value: q.netWorth, min: 0 },
          { label: 'Deute total (€)', field: 'totalDebt', value: q.totalDebt, min: 0 },
        ].map((f, i) => (
          <motion.div
            key={f.field}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}>
            <Field label={f.label} hint={f.hint}>
              <input type="number" value={f.value} min={f.min} max={f.max}
                onChange={e => update(f.field as keyof InvestorQuestionnaire, num(e.target.value))}
                className={inputCls} />
            </Field>
          </motion.div>
        ))}
      </div>

      {q.annualIncome > 0 && (
        <motion.div
          className="bg-blue-50 rounded-xl p-4 border border-blue-100"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}>
          <p className="text-sm font-medium text-blue-800 mb-2">📊 Diagnòstic ràpid</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <MiniStat
              label="Taxa estalvi"
              value={`${Math.max(0, ((q.annualIncome / 12 - q.monthlyExpenses) / (q.annualIncome / 12)) * 100).toFixed(1)}%`}
              good={((q.annualIncome / 12 - q.monthlyExpenses) / (q.annualIncome / 12)) >= 0.15}
            />
            <MiniStat
              label="Fons emergència"
              value={`${(q.currentSavings / Math.max(1, q.monthlyExpenses)).toFixed(1)} m`}
              good={q.currentSavings / Math.max(1, q.monthlyExpenses) >= 3}
            />
            <MiniStat
              label="Deute/Ingressos"
              value={`${((q.totalDebt / Math.max(1, q.annualIncome)) * 100).toFixed(0)}%`}
              good={(q.totalDebt / Math.max(1, q.annualIncome)) < 0.35}
            />
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <motion.h2 className="text-xl font-semibold text-gray-800"
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        Objectiu i horitzó d'inversió
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Field label="Objectiu financer principal">
            <select value={q.financialGoal}
              onChange={e => update('financialGoal', e.target.value)} className={inputCls}>
              <option value="preservar-capital">Preservar el capital</option>
              <option value="fons-emergencia">Crear fons d'emergència</option>
              <option value="generar-ingressos">Generar ingressos passius</option>
              <option value="compra-immoble">Compra d'immoble</option>
              <option value="educacio-fills">Educació dels fills</option>
              <option value="jubilacio">Planificació de la jubilació</option>
              <option value="creixement-moderat">Creixement moderat del capital</option>
              <option value="creixement-alt">Creixement alt del capital</option>
              <option value="maxima-rendibilitat">Màxima rendibilitat</option>
            </select>
          </Field>
        </motion.div>
        {[
          { label: 'Horitzó temporal (anys)', field: 'investmentHorizon', value: q.investmentHorizon, min: 1, max: 50 },
          { label: 'Import objectiu (€)',     field: 'targetAmount',      value: q.targetAmount,      min: 1 },
          { label: 'Inversió inicial (€)',    field: 'initialInvestment', value: q.initialInvestment, min: 0 },
          { label: 'Aportació mensual (€)',   field: 'monthlyContribution', value: q.monthlyContribution, min: 0 },
          { label: '% estalvis a invertir',   field: 'percentageToInvest', value: q.percentageToInvest, min: 1, max: 100 },
        ].map((f, i) => (
          <motion.div key={f.field}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}>
            <Field label={f.label}>
              <input type="number" value={f.value} min={f.min} max={f.max}
                onChange={e => update(f.field as keyof InvestorQuestionnaire, num(e.target.value))}
                className={inputCls} />
            </Field>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="bg-emerald-50 rounded-xl p-4 border border-emerald-100"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}>
        <p className="text-sm font-medium text-emerald-800 mb-1">💡 Import a invertir</p>
        <motion.p
          className="text-2xl font-bold text-emerald-700"
          key={q.currentSavings * q.percentageToInvest}
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}>
          {fmtCurrency(q.currentSavings * q.percentageToInvest / 100)}
        </motion.p>
      </motion.div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <motion.h2 className="text-xl font-semibold text-gray-800"
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        Coneixement i experiència financera
      </motion.h2>
      <Field label="Nivell de coneixement financer">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'cap',      label: '❌ Cap',      desc: 'No tinc cap coneixement financer' },
            { val: 'basic',    label: '📚 Bàsic',    desc: 'Conec conceptes bàsics d\'estalvi' },
            { val: 'intermedi',label: '📊 Intermedi', desc: 'Entenc fons, borsa i renda fixa' },
            { val: 'avançat',  label: '🎯 Avançat',  desc: 'Analitzo carteres i estratègies' },
            { val: 'expert',   label: '🏆 Expert',   desc: 'Professional del sector financer' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <RadioCard
                selected={q.financialKnowledge === opt.val}
                onClick={() => update('financialKnowledge', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
      <Field label="Experiència inversora">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'cap',         label: '🔰 Cap experiència',  desc: 'Mai he invertit' },
            { val: 'menys-1-any', label: '📅 Menys d\'1 any',   desc: 'Soc inversor novell' },
            { val: '1-3-anys',    label: '📈 Entre 1 i 3 anys', desc: 'Tinc experiència bàsica' },
            { val: '3-5-anys',    label: '💼 Entre 3 i 5 anys', desc: 'Tinc experiència moderada' },
            { val: 'mes-5-anys',  label: '🏛️ Més de 5 anys',   desc: 'Soc inversor experimentat' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <RadioCard
                selected={q.investmentExperience === opt.val}
                onClick={() => update('investmentExperience', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <motion.h2 className="text-xl font-semibold text-gray-800"
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        Tolerància al risc
      </motion.h2>
      <Field label="Pèrdua màxima acceptable">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'no-accepto-perdues',    label: '🔒 No accepto pèrdues', desc: 'Qualsevol pèrdua em genera angoixa' },
            { val: 'fins-5',                label: '🟢 Fins al -5%',        desc: 'Accepto pèrdues molt petites' },
            { val: 'fins-10',               label: '🟡 Fins al -10%',       desc: 'Pèrdues moderades temporalment' },
            { val: 'fins-20',               label: '🟠 Fins al -20%',       desc: 'Puc aguantar caigudes significatives' },
            { val: 'fins-30',               label: '🔴 Fins al -30%',       desc: 'Accepto caigudes importants' },
            { val: 'mes-30',                label: '⚡ Més del -30%',       desc: 'Soc inversor de molt alt risc' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <RadioCard
                selected={q.lossTolerance === opt.val}
                onClick={() => update('lossTolerance', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
      <Field label="Reacció davant d'una caiguda del 20%">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'vendre-tot',            label: '🚨 Vendria tot',       desc: 'No puc suportar veure pèrdues' },
            { val: 'vendre-part',           label: '⚠️ Vendria una part',  desc: 'Reduiria l\'exposició' },
            { val: 'no-fer-res',            label: '⏸️ No faria res',       desc: 'Esperaria la recuperació' },
            { val: 'comprar-mes',           label: '📈 Compraria més',     desc: 'Una caiguda és oportunitat' },
            { val: 'comprar-agressivament', label: '🚀 Compraria molt més',desc: 'Aprofitaria la caiguda al màxim' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <RadioCard
                selected={q.reactionToDrops === opt.val}
                onClick={() => update('reactionToDrops', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <motion.h2 className="text-xl font-semibold text-gray-800"
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        Preferències d'inversió
      </motion.h2>
      <Field label="Preferència ESG / Sostenibilitat">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'no-importa', label: '⚪ No m\'importa', desc: 'Prioritzo la rendibilitat' },
            { val: 'preferible', label: '🌿 Preferible',    desc: 'M\'agradaria però no és determinant' },
            { val: 'important',  label: '♻️ Important',     desc: 'Vull incorporar criteris ESG' },
            { val: 'essencial',  label: '🌍 Essencial',     desc: 'Només invertiré en productes sostenibles' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}>
              <RadioCard
                selected={q.esgPreference === opt.val}
                onClick={() => update('esgPreference', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
      <Field label="Necessitat de liquiditat">
        <div className="grid grid-cols-1 gap-2 mt-1">
          {[
            { val: 'no-necessito',   label: '🔒 No necessito liquiditat', desc: 'Capital exclusivament per invertir' },
            { val: 'potser-3-anys',  label: '📅 Potser en 3+ anys',       desc: 'Possible necessitat a mig termini' },
            { val: 'potser-1-any',   label: '⏰ Potser en 1-2 anys',      desc: 'Possible necessitat a curt termini' },
            { val: 'potser-6-mesos', label: '⚡ Potser en 6 mesos',       desc: 'Alta probabilitat de necessitar-lo' },
            { val: 'necessito-ja',   label: '🚨 Podria necessitar-ho ja', desc: 'Liquiditat immediata prioritària' },
          ].map((opt, i) => (
            <motion.div key={opt.val}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}>
              <RadioCard
                selected={q.liquidityNeed === opt.val}
                onClick={() => update('liquidityNeed', opt.val)}
                label={opt.label} desc={opt.desc} />
            </motion.div>
          ))}
        </div>
      </Field>
    </div>
  );
  // ─── RESULTS ─────────────────────────────────────────────────────────────────

  const renderResults = () => {
    if (!scoring || !portfolio || !metrics || !monteCarlo || !report) return null;
    const profileColor = PROFILE_COLORS[scoring.profile];
    const drawdownData = calculateDrawdownSeries(historical);
    const scenarios    = buildScenarioAnalysis(
      portfolio, q.initialInvestment, q.monthlyContribution, q.investmentHorizon
    );

    const TABS = [
      { id: 'resum',      label: '📋 Resum' },
      { id: 'perfil',     label: '👤 Perfil' },
      { id: 'cartera',    label: '💼 Cartera' },
      { id: 'benchmark',  label: '📊 Benchmark' },
      { id: 'metriques',  label: '📈 Mètriques' },
      { id: 'montecarlo', label: '🎲 Monte Carlo' },
      { id: 'costos',     label: '💰 Costos' },
      { id: 'riscos',     label: '⚠️ Riscos' },
    ];

    return (
      <div className="space-y-6">

        {/* Gràfics ocults per al PDF */}
        <HiddenCharts
          portfolio={portfolio} metrics={metrics}
          monteCarlo={monteCarlo} report={report}
          scoring={scoring} historical={historical}
        />

        {/* ── Header perfil ANIMAT ─────────────────────────────────────────── */}
        <motion.div
          className="rounded-2xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${profileColor}, ${profileColor}cc)` }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <motion.p
                className="text-white/60 text-xs font-medium uppercase tracking-widest mb-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}>
                {q.clientName && `👤 ${q.clientName} ·`} Perfil inversor
              </motion.p>
              <motion.h2
                className="text-3xl font-bold mt-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}>
                {getProfileIcon(scoring.profile)} {getProfileLabel(scoring.profile)}
              </motion.h2>
              <motion.p
                className="text-white/90 mt-2 text-sm max-w-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}>
                {getProfileDescription(scoring.profile)}
              </motion.p>
            </div>
            <motion.div
              className="text-right"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}>
              <div className="text-5xl font-black">{scoring.scorePercentage}%</div>
              <div className="text-white/80 text-sm">puntuació global</div>
            </motion.div>
          </div>
        </motion.div>

        {/* ── KPIs ANIMATS ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Import a invertir', value: fmtCurrency(q.currentSavings * q.percentageToInvest / 100), icon: '💶', color: 'blue' },
            { label: 'Rendibilitat esp.', value: `${portfolio.expectedReturn}%`,    sub: 'anual estimat', icon: '📈', color: 'green' },
            { label: 'Volatilitat esp.',  value: `${portfolio.expectedVolatility}%`, sub: 'anual estimat', icon: '📉', color: 'amber' },
            { label: 'Cost total (TER)',  value: `${portfolio.totalTER.toFixed(2)}%`, sub: 'anual ponderat', icon: '💰', color: 'purple' },
          ].map((kpi, i) => (
            <AnimatedKpi key={i} index={i}>
              <KpiCard {...kpi} />
            </AnimatedKpi>
          ))}
        </div>

        {/* Warnings */}
        {scoring.warnings.length > 0 && (
          <motion.div
            className="bg-amber-50 border border-amber-200 rounded-xl p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}>
            <p className="font-semibold text-amber-800 mb-2">⚠️ Avisos</p>
            {scoring.warnings.map((w, i) => (
              <motion.p key={i} className="text-sm text-amber-700"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}>
                • {w}
              </motion.p>
            ))}
          </motion.div>
        )}

        {/* Fortaleses */}
        {scoring.strengths.length > 0 && (
          <motion.div
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}>
            <p className="font-semibold text-emerald-800 mb-2">✅ Punts forts</p>
            {scoring.strengths.map((s, i) => (
              <motion.p key={i} className="text-sm text-emerald-700"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05 }}>
                • {s}
              </motion.p>
            ))}
          </motion.div>
        )}

        {/* ── TABS ANIMATS ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {TABS.map((tab, i) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-[#c9a84c] rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {tab.label}
            </motion.button>
          ))}
        </div>

        {/* ── TAB CONTENT ANIMAT ──────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>

            {/* ── TAB RESUM ────────────────────────────────────────────────── */}
            {activeTab === 'resum' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card title="Perfil inversor — Radar">
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={report.investorProfile.radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                        <Radar name="Puntuació" dataKey="value"
                          stroke={profileColor} fill={profileColor} fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Cada eix representa una dimensió del perfil inversor.
                    </p>
                  </Card>
                  <Card title="Asset Allocation">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={report.portfolioSection.assetAllocation}
                          dataKey="weight" nameKey="category"
                          cx="50%" cy="50%" outerRadius={80}
                          label={({ category, weight }) => `${category} ${weight}%`}>
                          {report.portfolioSection.assetAllocation.map((_, i) => (
                            <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Distribució per classe d'actiu.
                    </p>
                  </Card>
                </div>
                <Card title="Evolució Simulada (5 anys)" badge="🔵 Simulat">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={historical}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }}
                        tickFormatter={d => d.slice(0, 7)} interval={5} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="portfolio" name="Cartera"
                        stroke={profileColor} fill={profileColor} fillOpacity={0.15} strokeWidth={2} />
                      <Area type="monotone" dataKey="benchmark" name="Benchmark"
                        stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1}
                        strokeWidth={1.5} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-500 mt-2">
                    ⚠️ Evolució simulada. No representa rendibilitats reals.
                  </p>
                </Card>
                <Card title="Drawdown Màxim" badge="🔵 Simulat">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={drawdownData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }}
                        tickFormatter={d => d.slice(0, 7)} interval={5} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']} />
                      <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                      <Area type="monotone" dataKey="drawdown" name="Drawdown"
                        stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* ── TAB PERFIL ───────────────────────────────────────────────── */}
            {activeTab === 'perfil' && (
              <div className="space-y-6">
                <Card title="Desglossament de la puntuació">
                  <div className="space-y-3">
                    {report.investorProfile.scoreBreakdown.map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{item.dimension}</span>
                          <span className="text-gray-500">{item.score}/{item.maxScore} pts</span>
                        </div>
                        {/* ── PROGRESS BAR ANIMADA ── */}
                        <AnimatedProgressBar
                          percentage={item.percentage}
                          color={profileColor}
                          delay={i * 0.08}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title="Diagnòstic financer">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.financialDiagnostics.diagnosticItems.map((item, i) => (
                      <motion.div
                        key={i}
                        className={`rounded-lg p-3 border ${
                          item.status === 'good'    ? 'bg-emerald-50 border-emerald-200' :
                          item.status === 'warning' ? 'bg-amber-50 border-amber-200'    :
                          item.status === 'alert'   ? 'bg-red-50 border-red-200'        :
                          'bg-gray-50 border-gray-200'
                        }`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ scale: 1.01 }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700">{item.label}</span>
                          <span className="text-lg font-bold text-gray-800">{item.value}</span>
                        </div>
                        <p className="text-xs text-gray-500">{item.explanation}</p>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB CARTERA ──────────────────────────────────────────────── */}
            {activeTab === 'cartera' && (
              <div className="space-y-6">
                <Card title="Fons d'inversió seleccionats">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-400 text-xs uppercase">
                          <th className="pb-2 pr-4">Fons</th>
                          <th className="pb-2 pr-4 text-right">Pes</th>
                          <th className="pb-2 pr-4 text-right">Import</th>
                          <th className="pb-2 pr-4 text-right">TER</th>
                          <th className="pb-2 text-center">Risc</th>
                          <th className="pb-2">Estat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {portfolio.allocations.map((a, i) => (
                          <motion.tr key={i}
                            className="hover:bg-gray-50"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}>
                            <td className="py-2 pr-4">
                              <div className="font-medium text-gray-800 text-xs leading-tight max-w-[180px]">
                                {a.product.name}
                              </div>
                              <div className="text-gray-400 text-xs">{a.product.isin}</div>
                            </td>
                            <td className="py-2 pr-4 text-right font-bold text-gray-800">{a.weight}%</td>
                            <td className="py-2 pr-4 text-right text-gray-700">{fmtCurrency(a.amount)}</td>
                            <td className="py-2 pr-4 text-right text-gray-600">{a.product.ter.toFixed(2)}%</td>
                            <td className="py-2 pr-4 text-center text-gray-500 text-xs">
                              {'⭐'.repeat(a.product.risk)}
                            </td>
                            <td className="py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getDataStatusColor(a.product.dataStatus)}`}>
                                {a.product.dataStatus}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card title="Justificació de cada posició">
                  <div className="space-y-3">
                    {portfolio.allocations.map((a, i) => (
                      <motion.div key={i}
                        className="flex gap-3 p-3 bg-gray-50 rounded-lg"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}>
                        <div className="text-lg font-bold text-gray-300 min-w-[40px]">{a.weight}%</div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{a.product.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{a.rationale}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB BENCHMARK ────────────────────────────────────────────── */}
            {activeTab === 'benchmark' && (
              <div className="space-y-6">
                <Card title={portfolio.benchmark.name}>
                  <p className="text-sm text-gray-600 mb-4">{portfolio.benchmark.description}</p>
                  <div className="space-y-3">
                    {portfolio.benchmark.components.map((c, i) => (
                      <motion.div key={i}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}>
                        <div className="text-sm font-bold text-gray-700 w-12 text-right">{c.weight}%</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="h-2 rounded-full bg-slate-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${c.weight}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 + 0.2 }}
                          />
                        </div>
                        <div className="text-xs text-gray-600 min-w-[160px]">{c.index}</div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card title="Cartera vs Benchmark">
                    <CompareRow label="Rendibilitat esperada"
                      portfolio={`${portfolio.expectedReturn}%`}
                      benchmark={`${portfolio.benchmark.expectedReturn}%`}
                      positive={portfolio.expectedReturn >= portfolio.benchmark.expectedReturn} />
                    <CompareRow label="Volatilitat esperada"
                      portfolio={`${portfolio.expectedVolatility}%`}
                      benchmark={`${portfolio.benchmark.expectedVolatility}%`}
                      positive={portfolio.expectedVolatility <= portfolio.benchmark.expectedVolatility} />
                    <CompareRow label="Sharpe estimat"
                      portfolio={metrics.sharpeRatio.toFixed(2)}
                      benchmark="—" positive={true} />
                  </Card>
                  <Card title="Nota metodològica">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {report.benchmarkSection.comparisonNote}
                    </p>
                  </Card>
                </div>
              </div>
            )}

            {/* ── TAB MÈTRIQUES ────────────────────────────────────────────── */}
            {activeTab === 'metriques' && (
              <div className="space-y-6">
                <motion.div
                  className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="text-sm text-yellow-800">
                    ⚠️ {getMetricsStatusLabel(metrics.status)} — {metrics.dataQuality.dataSourceNote}
                  </span>
                </motion.div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Rendibilitat anual', value: `${metrics.annualizedReturn.toFixed(2)}%`,     good: metrics.annualizedReturn >= 4 },
                    { label: 'Volatilitat anual',  value: `${metrics.annualizedVolatility.toFixed(2)}%`, good: metrics.annualizedVolatility <= 15 },
                    { label: 'Sharpe Ratio',       value: metrics.sharpeRatio.toFixed(2),               good: metrics.sharpeRatio >= 0.5 },
                    { label: 'Sortino Ratio',      value: metrics.sortinoRatio.toFixed(2),              good: metrics.sortinoRatio >= 0.6 },
                    { label: 'Max Drawdown',       value: `${metrics.maxDrawdown.toFixed(2)}%`,         good: metrics.maxDrawdown >= -20 },
                    { label: 'Calmar Ratio',       value: metrics.calmarRatio.toFixed(2),               good: metrics.calmarRatio >= 0.3 },
                    { label: 'Beta',               value: metrics.beta.toFixed(2),                      good: metrics.beta <= 1 },
                    { label: 'Tracking Error',     value: `${metrics.trackingError.toFixed(2)}%`,       good: true },
                  ].map((m, i) => (
                    <motion.div key={i}
                      className={`rounded-xl p-4 border ${m.good ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                      whileHover={{ scale: 1.02 }}>
                      <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                      <p className="text-xl font-bold text-gray-800">{m.value}</p>
                    </motion.div>
                  ))}
                </div>
                <Card title="Rendibilitats per període" badge="⚠️ Estimat">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={metrics.rollingReturns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '']} />
                      <Legend />
                      <Bar dataKey="portfolioReturn" name="Cartera"
                        fill={profileColor} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="benchmarkReturn" name="Benchmark"
                        fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Contribució al risc per fons">
                  <div className="space-y-2">
                    {metrics.riskContributions
                      .sort((a, b) => b.riskContribution - a.riskContribution)
                      .map((rc, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                            <span className="truncate max-w-[200px]">{rc.productName}</span>
                            <span>{rc.riskContribution.toFixed(1)}%</span>
                          </div>
                          <AnimatedProgressBar
                            percentage={rc.riskContribution}
                            color="#ef4444"
                            delay={i * 0.06}
                          />
                        </div>
                      ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB MONTE CARLO ──────────────────────────────────────────── */}
            {activeTab === 'montecarlo' && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {(['p10', 'p50', 'p90'] as const).map((p, i) => (
                    <motion.div key={p}
                      className={`rounded-xl p-5 text-center border ${
                        p === 'p10' ? 'bg-red-50 border-red-200' :
                        p === 'p50' ? 'bg-blue-50 border-blue-200' :
                                     'bg-emerald-50 border-emerald-200'
                      }`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      whileHover={{ scale: 1.02 }}>
                      <p className="text-xs text-gray-500 mb-1 uppercase font-medium">
                        {p === 'p10' ? 'Pessimista (P10)' : p === 'p50' ? 'Central (P50)' : 'Optimista (P90)'}
                      </p>
                      <p className="text-2xl font-black text-gray-800">
                        {formatMonteCarloValue(monteCarlo.percentiles[p])}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">en {q.investmentHorizon} anys</p>
                    </motion.div>
                  ))}
                </div>
                <Card title={`Projecció Monte Carlo — ${(monteCarlo.params.numSimulations ?? 1000).toLocaleString()} simulacions`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monteCarlo.projectionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMonteCarloValue(v)} width={70} />
                      <Tooltip formatter={(v: number) => [fmtCurrency(v), '']}
                        labelFormatter={l => `Any ${l}`} />
                      <Legend />
                      <Area type="monotone" dataKey="p90" name="P90 Optimista"
                        stroke="#10b981" fill="#10b981" fillOpacity={0.1}
                        strokeWidth={1.5} strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="p50" name="P50 Central"
                        stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2.5} />
                      <Area type="monotone" dataKey="p10" name="P10 Pessimista"
                        stroke="#ef4444" fill="#ef4444" fillOpacity={0.1}
                        strokeWidth={1.5} strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-500 mt-2">{monteCarlo.note}</p>
                </Card>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: 'Prob. retorn positiu',   value: `${monteCarlo.probabilityAnalysis.probabilityPositiveReturn}%`,  good: monteCarlo.probabilityAnalysis.probabilityPositiveReturn >= 70 },
                    { label: 'Prob. batre inflació',   value: `${monteCarlo.probabilityAnalysis.probabilityBeatInflation}%`,   good: monteCarlo.probabilityAnalysis.probabilityBeatInflation >= 60 },
                    { label: 'Prob. assolir objectiu', value: `${monteCarlo.probabilityAnalysis.probabilityReachTarget}%`,     good: monteCarlo.probabilityAnalysis.probabilityReachTarget >= 50 },
                    { label: 'Guany mediana',          value: fmtCurrency(monteCarlo.summary.medianGain),                      good: monteCarlo.summary.medianGain > 0 },
                    { label: 'Valor real (P50)',        value: fmtCurrency(monteCarlo.inflationAdjusted.p50RealValue),         good: true },
                    { label: 'Retorn real anual',       value: `${monteCarlo.inflationAdjusted.realAnnualizedReturn.toFixed(2)}%`, good: monteCarlo.inflationAdjusted.realAnnualizedReturn > 0 },
                  ].map((item, i) => (
                    <motion.div key={i}
                      className={`rounded-xl p-4 border text-center ${item.good ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                      whileHover={{ scale: 1.02 }}>
                      <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                      <p className="text-xl font-bold text-gray-800">{item.value}</p>
                    </motion.div>
                  ))}
                </div>
                <Card title="Escenaris d'anàlisi">
                  <div className="space-y-3">
                    {scenarios.scenarios.map((s, i) => (
                      <motion.div key={i}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ x: 4 }}>
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            {s.name}
                            <span className="ml-2 text-xs text-gray-400">{s.probability}</span>
                          </p>
                          <p className="text-xs text-gray-500">{s.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-800">{fmtCurrency(s.finalValue)}</p>
                          <p className="text-xs text-gray-400">{s.returnAssumption.toFixed(1)}% anual</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB COSTOS ───────────────────────────────────────────────── */}
            {activeTab === 'costos' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'TER total ponderat', value: `${portfolio.totalTER.toFixed(2)}%`, color: 'blue' },
                    { label: 'Cost anual estimat', value: fmtCurrency(q.currentSavings * q.percentageToInvest / 100 * portfolio.totalTER / 100), color: 'green' },
                    { label: 'Estalvi vs gestió activa', value: `-${report.costsSection.costComparison.savingsVsActive.toFixed(2)}pp`, color: 'purple' },
                  ].map((item, i) => {
                    const colors: Record<string, string> = {
                      blue:   'bg-blue-50 border-blue-200 text-blue-700',
                      green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
                      purple: 'bg-purple-50 border-purple-200 text-purple-700',
                    };
                    return (
                      <motion.div key={i}
                        className={`${colors[item.color]} border rounded-xl p-5 text-center`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.02 }}>
                        <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                        <p className="text-3xl font-black">{item.value}</p>
                      </motion.div>
                    );
                  })}
                </div>
                <Card title="Costos per fons">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-400 text-xs uppercase">
                          <th className="pb-2 pr-4">Fons</th>
                          <th className="pb-2 pr-4 text-right">Pes</th>
                          <th className="pb-2 pr-4 text-right">TER</th>
                          <th className="pb-2 pr-4 text-right">Cost pond.</th>
                          <th className="pb-2">Gestió</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {report.costsSection.costItems
                          .sort((a, b) => b.weightedCost - a.weightedCost)
                          .map((item, i) => (
                            <motion.tr key={i}
                              className="hover:bg-gray-50"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}>
                              <td className="py-2 pr-4 text-xs text-gray-700 max-w-[200px] truncate">
                                {item.productName}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-600">{item.weight}%</td>
                              <td className="py-2 pr-4 text-right text-gray-600">{item.ter.toFixed(2)}%</td>
                              <td className="py-2 pr-4 text-right font-medium text-gray-800">
                                {item.weightedCost.toFixed(3)}%
                              </td>
                              <td className="py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  item.managementType === 'indexada' ? 'bg-green-100 text-green-700' :
                                  item.managementType === 'passiva'  ? 'bg-blue-100 text-blue-700'  :
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {item.managementType}
                                </span>
                              </td>
                            </motion.tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{report.costsSection.costNote}</p>
                </Card>
              </div>
            )}

            {/* ── TAB RISCOS ───────────────────────────────────────────────── */}
            {activeTab === 'riscos' && (
              <div className="space-y-6">
                <Card title="Principals riscos de la cartera">
                  <div className="space-y-4">
                    {report.risksSection.mainRisks.map((r, i) => (
                      <motion.div key={i}
                        className="p-4 rounded-xl border bg-gray-50"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ x: 4 }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-800">{r.category}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            r.level === 'baix'    ? 'bg-green-100 text-green-700'   :
                            r.level === 'moderat' ? 'bg-amber-100 text-amber-700'   :
                            r.level === 'alt'     ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {r.level.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{r.description}</p>
                        <p className="text-xs text-blue-600">🛡️ {r.mitigation}</p>
                      </motion.div>
                    ))}
                  </div>
                </Card>
                <Card title="Pla de seguiment recomanat">
                  <ul className="space-y-2">
                    {report.risksSection.followUpPlan.map((s, i) => (
                      <motion.li key={i}
                        className="flex gap-2 text-sm text-gray-600"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}>
                        <span className="text-[#c9a84c] font-bold">{i + 1}.</span>
                        <span>{s}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">⚖️ Avís legal</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{LEGAL_DISCLAIMER}</p>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* ── BOTONS FINALS ────────────────────────────────────────────────── */}
        <motion.div
          className="flex flex-col items-center gap-4 pt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}>
          <PDFButton
            questionnaire={q} scoring={scoring}
            portfolio={portfolio} metrics={metrics}
            monteCarlo={monteCarlo} report={report}
            historical={historical}
          />
          {/* ── BOTONS FINALS ────────────────────────────────────────────────── */}
<motion.div
  className="flex flex-col items-center gap-4 pt-4"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.6 }}>

  {/* Botó PDF */}
  <PDFButton
    questionnaire={q} scoring={scoring}
    portfolio={portfolio} metrics={metrics}
    monteCarlo={monteCarlo} report={report}
    historical={historical}
  />

  {/* Botó Email — NOU */}
  <EmailButton
    questionnaire={q} scoring={scoring}
    portfolio={portfolio} metrics={metrics}
    monteCarlo={monteCarlo} report={report}
    historical={historical}
  />

  {/* Botó reset */}
  <motion.button
    onClick={reset}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="px-6 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-all">
    ↩ Nova consulta
  </motion.button>
</motion.div>
          <motion.button
            onClick={reset}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-all">
            ↩ Nova consulta
          </motion.button>
        </motion.div>
      </div>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">

      {/* Header */}
      <motion.header
        className="bg-[#0d1f1a] border-b border-[#c9a84c]/20"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={onBack}
              whileHover={{ x: -3 }}
              className="text-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors text-sm flex items-center gap-2">
              ← Inici
            </motion.button>
            <div className="w-px h-5 bg-white/10" />
            <div>
              <h1 className="text-xl font-black text-white">
                FACTOR <span className="text-[#c9a84c]">OTC</span>
              </h1>
              <p className="text-xs text-white/30">Eina de suport · No és assessorament regulat</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <motion.div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step > s.id   ? 'bg-[#c9a84c] border-[#c9a84c] text-[#0d1f1a]' :
                    step === s.id ? 'border-[#c9a84c] text-[#c9a84c] bg-transparent' :
                    'border-white/20 text-white/30 bg-transparent'
                  }`}
                  animate={step === s.id ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}>
                  {step > s.id ? '✓' : s.id}
                </motion.div>
                {i < STEPS.length - 1 && (
                  <motion.div
                    className="w-4 h-0.5"
                    animate={{ backgroundColor: step > s.id ? '#c9a84c' : 'rgba(255,255,255,0.1)' }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <motion.div
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}>

          {/* Progress bar */}
          {step < 6 && (
            <div className="mb-6">
              <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-wide">
                Pas {step} de 5 — {STEPS[step - 1]?.label}
              </span>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-1.5 rounded-full bg-[#c9a84c]"
                  animate={{ width: `${(step / 5) * 100}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          )}

          {/* ── Steps amb transicions ─────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoadingSpinner message="Calculant el teu perfil inversor..." />
              </motion.div>
            ) : (
              <StepTransition
                key={step}
                stepKey={step}
                direction={step > prevStep ? 'right' : 'left'}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
                {step === 6 && renderResults()}
              </StepTransition>
            )}
          </AnimatePresence>

          {/* Errors validació */}
          <AnimatePresence>
            {validation && !validation.isValid && (
              <motion.div
                className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}>
                <p className="font-semibold text-red-700 mb-2">⛔ Errors a corregir</p>
                {validation.errors.map((e, i) => (
                  <motion.p key={i} className="text-sm text-red-600"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    • {e}
                  </motion.p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navegació */}
          {step < 6 && !loading && (
            <motion.div
              className="flex justify-between mt-8 pt-6 border-t border-gray-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}>
              {step > 1 ? (
                <motion.button
                  onClick={() => goToStep(step - 1)}
                  whileHover={{ x: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
                  ← Anterior
                </motion.button>
              ) : <div />}
              {step < 5 ? (
                <motion.button
                  onClick={() => goToStep(step + 1)}
                  whileHover={{ x: 3, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 py-2.5 rounded-xl bg-[#c9a84c] text-[#0d1f1a] text-sm font-bold hover:bg-[#b8963f] transition-all shadow-sm">
                  Següent →
                </motion.button>
              ) : (
                <motion.button
                  onClick={calculate}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-8 py-2.5 rounded-xl bg-[#c9a84c] text-[#0d1f1a] text-sm font-bold hover:bg-[#b8963f] transition-all shadow-md">
                  🚀 Generar informe
                </motion.button>
              )}
            </motion.div>
          )}
        </motion.div>
      </main>

      <motion.footer
        className="text-center py-6 text-xs text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}>
        Factor OTC · Eina de suport a la decisió · No executa operacions reals
      </motion.footer>
    </div>
  );
}
