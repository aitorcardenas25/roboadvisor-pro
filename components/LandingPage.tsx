'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { AppView } from '@/app/page';
import LeadForm from '@/components/LeadForm';

interface Props {
  onNavigate: (view: AppView) => void;
}

const NAV_LINKS = [
  { label: 'Comparador', href: '/comparador' },
  { label: 'Notícies',   href: '/noticies' },
  { label: 'Accions',    href: '/client/seguiment-accions' },
  { label: 'Informe',    href: '/informe-bursatil' },
];

const FEATURES = [
  {
    href: '/comparador',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: 'Comparador de Fons',
    desc: 'Compara fins a 5 fons per rendibilitat, volatilitat, TER i risc ajustat.',
    badge: 'Públic',
    pub: true,
  },
  {
    href: '/noticies',
    iconPath: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM9 13h6M9 17h3',
    title: 'Notícies de Mercat',
    desc: 'Articles financers per categories: mercats, macro, fons i ETFs.',
    badge: 'Públic',
    pub: true,
  },
  {
    href: '/client/seguiment-accions',
    iconPath: 'M3 17l6-6 4 4 8-8',
    title: "Seguiment d'Accions",
    desc: 'Senyals tècnics, fonamentals i gràfics en temps real.',
    badge: 'Clients',
    pub: false,
  },
  {
    href: '/client/carteres-model',
    iconPath: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055zM20.488 9H15V3.512A9.025 9.025 0 0120.488 9z',
    title: 'Carteres Model',
    desc: "Distribució òptima d'actius amb simulació Monte Carlo.",
    badge: 'Clients',
    pub: false,
  },
  {
    href: '/informe-bursatil',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    title: 'Informe Bursàtil',
    desc: 'Informe professional per ticker: fonamentals, competència i tècnica.',
    badge: 'Clients',
    pub: false,
  },
  {
    href: '/client/cartera',
    iconPath: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    title: 'La meva Cartera',
    desc: 'Seguiment de posicions, P&L i evolució de la teva cartera real.',
    badge: 'Clients',
    pub: false,
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Omplis el qüestionari',
    desc: 'Respon 12 preguntes sobre perfil, objectius i tolerància al risc. Pren menys de 5 minuts.',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    step: '02',
    title: "Rebràs l'informe personalitzat",
    desc: 'El sistema genera una cartera Markowitz optimitzada amb projeccions a 10, 20 i 30 anys.',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    step: '03',
    title: "L'assessor activa la cartera",
    desc: "El teu assessor revisa la proposta, l'ajusta si cal, i crea la teva cartera al portal privat.",
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    step: '04',
    title: 'Seguiment mensual',
    desc: 'Accedeix al teu dashboard, rep informes de seguiment i consulta el teu assessor quan calgui.',
    iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

const BENEFITS = [
  {
    title: 'Algorítmica i sense biaix',
    desc: 'Teoria Markowitz MPT aplicada al teu perfil real. Matemàtica institucional.',
    iconPath: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    title: 'Dades de mercat reals',
    desc: 'Preus i fonamentals de FMP, Alpha Vantage i Yahoo Finance. Sense dades simulades.',
    iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    title: 'Compliment MiFID II',
    desc: 'Qüestionari de suitability formal (Art. 54 Delegated Regulation 2017/565).',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Assessor personal disponible',
    desc: 'Un especialista humà revisa la teva cartera i és accessible per a consultes puntuals.',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'Portafoli unificat',
    desc: "ETFs, accions i fons en un sol lloc. P&L en temps real, historial de transaccions.",
    iconPath: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    title: 'Informes professionals',
    desc: 'Informes HTML i PDF per a cada actiu, cartera i revisió periòdica. Arxiu complet.',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
];

// Dashboard mockup
const MOCK_HOLDINGS = [
  { name: 'iShares MSCI World',  ticker: 'IWDA', value: '€18.420', pct: '+12,4%', up: true  },
  { name: 'Apple Inc.',          ticker: 'AAPL', value: '€9.870',  pct: '+5,2%',  up: true  },
  { name: 'Amundi MSCI Em.',     ticker: 'AEEM', value: '€7.340',  pct: '-2,1%',  up: false },
];

const ALLOC = [
  { label: 'R. Variable', pct: 65, color: '#2d6a4f' },
  { label: 'R. Fixa',     pct: 20, color: '#c9a84c' },
  { label: 'Alternatiu',  pct: 15, color: '#1a3a2a' },
];

const SPARK_PTS = [40, 38, 42, 45, 43, 48, 50, 47, 52, 55, 53, 58, 62, 60, 65];
const SW = 280, SH = 80;
const SMIN = Math.min(...SPARK_PTS), SMAX = Math.max(...SPARK_PTS);
const spy = (v: number) => SH - ((v - SMIN) / (SMAX - SMIN)) * (SH - 16) - 8;
const spx = (i: number) => (i / (SPARK_PTS.length - 1)) * SW;
const SPARK_LINE = SPARK_PTS.map((v, i) => `${i === 0 ? 'M' : 'L'}${spx(i).toFixed(1)},${spy(v).toFixed(1)}`).join(' ');
const SPARK_AREA = `${SPARK_LINE} L${SW},${SH} L0,${SH} Z`;
const SPARK_LX = SW;
const SPARK_LY = spy(SPARK_PTS[SPARK_PTS.length - 1]);

const HERO_CHECKS = [
  'Informe inicial personalitzat',
  'Proposta de cartera optimitzada',
  'Seguiment mensual amb assessor',
  'Accés privat a la seva cartera',
];

function Fade({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0, 0.1, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

function Icon({ d, className = 'w-4 h-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
    </svg>
  );
}

export default function LandingPage({ onNavigate }: Props) {
  const [loaded, setLoaded]         = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#080e0b] overflow-x-hidden">

      {/* Fixed background gradients */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,rgba(45,106,79,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_60%_at_-5%_100%,rgba(26,58,42,0.45),transparent)]" />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(45,106,79,0.03) 80px)' }} />
      </div>

      <div className="relative flex flex-col">

        {/* ── Header ─────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : -8 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between px-6 md:px-10 h-14 border-b border-[#1a3a2a]/60 bg-[#080e0b]/90 backdrop-blur-md sticky top-0 z-40">

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1a3a2a] border border-[#2d6a4f]/60 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-xs leading-none">F</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight">FACTOR</span>
            <span className="text-[#2d6a4f] font-light text-sm tracking-wider">OTC</span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href}
                className="text-white/50 hover:text-[#c9a84c] text-xs uppercase tracking-widest transition-colors duration-200">
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white/38 text-xs">Sistema actiu</span>
            </div>
            <a href="/login"
              className="px-4 py-1.5 border border-[#1a3a2a] hover:border-[#2d6a4f]/60 text-white/55 hover:text-[#c9a84c] text-xs font-medium rounded-lg transition-all duration-200">
              Accés
            </a>
            <button onClick={() => setMenuOpen(v => !v)}
              className="md:hidden p-1.5 text-white/55 hover:text-white" aria-label="Menu">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </motion.header>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              className="border-b border-[#1a3a2a]/60 bg-[#080e0b] px-6 py-4 md:hidden z-30 overflow-hidden">
              <div className="flex flex-col gap-3">
                {NAV_LINKS.map(l => (
                  <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                    className="text-white/55 hover:text-white text-sm uppercase tracking-widest transition-colors">
                    {l.label}
                  </Link>
                ))}
                <div className="pt-2 border-t border-white/8">
                  <a href="/login" className="text-[#c9a84c] text-xs">Accés clients →</a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hero ───────────────────────────────── */}
        <section className="relative px-6 md:px-10 lg:px-16 pt-20 pb-28 md:pt-28 md:pb-36">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">

              {/* Copy */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 border border-[#2d6a4f]/25 rounded-full bg-[#1a3a2a]/15">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2d6a4f]" />
                  <span className="text-[#2d6a4f]/80 text-xs uppercase tracking-[0.3em]">Assessorament financer personalitzat</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-4xl md:text-5xl lg:text-[3.25rem] font-black text-white leading-[1.08] tracking-tight mb-8">
                  La teva cartera,<br />
                  <span className="text-shimmer">supervisada i</span><br />
                  optimitzada
                </motion.h1>

                {/* Checklist */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.35 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6 mb-10">
                  {HERO_CHECKS.map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#2d6a4f] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white/60 text-sm">{item}</span>
                    </div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                  className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => setShowLeadForm(true)}
                    className="group inline-flex items-center justify-center gap-2 px-7 py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-xl transition-all duration-200"
                    style={{ boxShadow: '0 0 24px rgba(201,168,76,0.18)' }}>
                    Sol·licita el teu informe
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <a href="/login"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3 border border-[#1a3a2a] hover:border-[#2d6a4f]/50 text-white/60 hover:text-white font-medium text-sm rounded-xl transition-all duration-200">
                    <Icon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    Accedeix com a client
                  </a>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: loaded ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="flex items-center gap-6 mt-10 pt-8 border-t border-[#1a3a2a]/50">
                  {[
                    { v: '158',      l: 'Fons i ETFs' },
                    { v: '10.000+',  l: 'Sim. Monte Carlo' },
                    { v: 'MiFID II', l: 'Compliant' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="text-[#c9a84c] font-black text-lg tabular-nums">{s.v}</div>
                      <div className="text-white/38 text-[10px] uppercase tracking-widest">{s.l}</div>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Dashboard mockup */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.96, y: loaded ? 0 : 16 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0, 0.1, 1] }}
                className="hidden lg:block relative">

                <div className="absolute -inset-6 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(45,106,79,0.12),transparent)] pointer-events-none" />

                <div className="relative border border-[#1a3a2a]/70 rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(145deg,rgba(26,58,42,0.18) 0%,rgba(8,14,11,0.95) 100%)', boxShadow: '0 0 0 1px rgba(45,106,79,0.08), 0 24px 64px rgba(0,0,0,0.55)' }}>

                  <div className="px-5 pt-4 pb-3 border-b border-[#1a3a2a]/50 flex items-center justify-between">
                    <span className="text-white/50 text-xs uppercase tracking-widest">La meva Cartera</span>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400/80">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      En directe
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="mb-4">
                      <div className="text-white/50 text-xs mb-1">Valor total de la cartera</div>
                      <div className="flex items-end gap-3">
                        <span className="text-white font-black text-3xl tabular-nums tracking-tight">€47.382</span>
                        <span className="text-emerald-400 text-sm font-semibold mb-0.5">+8,43%</span>
                      </div>
                      <div className="text-white/38 text-xs mt-0.5">+€3.712 des de l&apos;entrada</div>
                    </div>

                    {/* Sparkline */}
                    <div className="mb-4 relative" style={{ height: SH }}>
                      <svg viewBox={`0 0 ${SW} ${SH}`} className="w-full h-full">
                        <defs>
                          <linearGradient id="lp-spark-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#2d6a4f" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d={SPARK_AREA} fill="url(#lp-spark-fill)" />
                        <path d={SPARK_LINE} stroke="#2d6a4f" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx={SPARK_LX} cy={SPARK_LY} r="3" fill="#c9a84c" />
                      </svg>
                      <div className="absolute top-0 right-0 border border-[#c9a84c]/20 rounded px-2 py-0.5 bg-[#080e0b]/80">
                        <span className="text-[#c9a84c] text-[10px] font-mono">€47.382</span>
                      </div>
                    </div>

                    {/* Holdings */}
                    <div className="space-y-1 mb-4">
                      {MOCK_HOLDINGS.map(h => (
                        <div key={h.ticker} className="flex items-center gap-3 py-1.5">
                          <div className="w-7 h-7 rounded-lg bg-[#1a3a2a]/50 border border-[#2d6a4f]/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#c9a84c] text-[8px] font-black">{h.ticker.slice(0, 2)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white/60 text-xs truncate">{h.name}</div>
                            <div className="text-white/38 text-[10px]">{h.ticker}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-white/60 text-xs font-mono">{h.value}</div>
                            <div className={`text-[10px] font-mono ${h.up ? 'text-emerald-400' : 'text-red-400'}`}>{h.pct}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Allocation */}
                    <div className="border-t border-[#1a3a2a]/50 pt-3">
                      <div className="text-white/50 text-[10px] uppercase tracking-widest mb-2">Distribució</div>
                      <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5 mb-1.5">
                        {ALLOC.map(a => (
                          <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} className="rounded-full" />
                        ))}
                      </div>
                      <div className="flex gap-3">
                        {ALLOC.map(a => (
                          <div key={a.label} className="flex items-center gap-1">
                            <div style={{ background: a.color }} className="w-1.5 h-1.5 rounded-full" />
                            <span className="text-white/50 text-[9px]">{a.label} {a.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -bottom-4 -left-8 border border-[#1a3a2a]/50 rounded-xl px-4 py-3 bg-[#080e0b]/95 backdrop-blur"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Sharpe Ratio</div>
                  <div className="text-[#c9a84c] font-black text-xl">1.34</div>
                  <div className="text-white/35 text-[9px]">Millor que benchmark</div>
                </div>

                <div className="absolute -top-4 -right-4 border border-emerald-500/15 rounded-xl px-3 py-2 bg-[#080e0b]/95 backdrop-blur"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-400/80 text-[10px] font-medium">Cartera optimitzada</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features 3×2 ───────────────────────── */}
        <section className="border-t border-[#1a3a2a]/40 px-6 md:px-10 lg:px-16 py-24 md:py-32">
          <div className="max-w-6xl mx-auto">
            <Fade className="text-center mb-14">
              <p className="text-[#2d6a4f]/80 text-xs uppercase tracking-[0.4em] mb-3">Eines de la plataforma</p>
              <h2 className="text-white font-black text-3xl md:text-4xl">Les eines que necessites</h2>
              <p className="text-white/50 text-sm mt-3 max-w-lg mx-auto">Eines obertes per a tothom i eines exclusives per a clients.</p>
            </Fade>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <Fade key={f.href} delay={i * 0.06}>
                  <Link href={f.href}
                    className="group flex flex-col h-full border border-[#1a3a2a]/55 rounded-xl p-5 bg-[#080e0b] hover:bg-[#0d1a14] hover:border-[#2d6a4f]/35 transition-all duration-200"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.05)' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-200 ${f.pub ? 'bg-emerald-500/8 border border-emerald-500/18 group-hover:bg-emerald-500/12' : 'bg-[#c9a84c]/6 border border-[#c9a84c]/12 group-hover:bg-[#c9a84c]/10'}`}>
                        <Icon d={f.iconPath} className={`w-4 h-4 transition-colors duration-200 ${f.pub ? 'text-emerald-400/70 group-hover:text-emerald-400' : 'text-[#c9a84c]/60 group-hover:text-[#c9a84c]'}`} />
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${f.pub ? 'text-emerald-400 bg-emerald-400/6 border-emerald-400/18' : 'text-[#c9a84c] bg-[#c9a84c]/6 border-[#c9a84c]/18'}`}>
                        {f.badge}
                      </span>
                    </div>
                    <h3 className="text-white/80 font-semibold text-sm mb-1.5 group-hover:text-white transition-colors duration-200">
                      {f.title}
                    </h3>
                    <p className="text-white/50 text-xs leading-relaxed group-hover:text-white/60 transition-colors duration-200 flex-1">
                      {f.desc}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-[#2d6a4f]/50 group-hover:text-[#c9a84c]/65 transition-colors duration-200">
                      <span className="text-[10px] uppercase tracking-widest">Obrir</span>
                      <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────── */}
        <section className="border-t border-[#1a3a2a]/40 px-6 md:px-10 lg:px-16 py-24 md:py-32"
          style={{ background: 'linear-gradient(to bottom,rgba(26,58,42,0.07),transparent 65%)' }}>
          <div className="max-w-5xl mx-auto">
            <Fade className="text-center mb-14">
              <p className="text-[#2d6a4f]/80 text-xs uppercase tracking-[0.4em] mb-3">Plans i preus</p>
              <h2 className="text-white font-black text-3xl md:text-4xl">Assessorament a la teva mida</h2>
              <p className="text-white/50 text-sm mt-3 max-w-lg mx-auto">Des d&apos;un informe puntual fins a acompanyament complet. Sense compromisos.</p>
            </Fade>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {[
                {
                  eyebrow: 'Punt de partida',
                  title: 'Informe Inicial',
                  priceMain: '20€',
                  priceSub: 'pagament únic',
                  desc: 'Diagnosi financera completa del teu perfil inversor.',
                  features: ['Qüestionari MiFID II complet','Cartera Markowitz optimitzada','Simulació Monte Carlo 10–30a','Informe PDF professional'],
                  cta: "Sol·licita l'informe inicial",
                  highlight: false,
                },
                {
                  eyebrow: 'Més popular',
                  title: 'Seguiment Actiu',
                  priceMain: 'A consultar',
                  priceSub: 'per mes',
                  desc: 'Seguiment continuat de la teva cartera amb assessor personal.',
                  features: ["Tot de l'Informe Inicial",'Dashboard de cartera en directe','Informe de seguiment mensual','Accés a informes borsaris','Comunicació directa amb assessor'],
                  cta: 'Parla amb un assessor',
                  highlight: true,
                },
                {
                  eyebrow: 'Màxima dedicació',
                  title: 'Premium',
                  priceMain: 'A consultar',
                  priceSub: 'personalitzat',
                  desc: "Servei complet amb estratègia fiscal i accés prioritari.",
                  features: ['Tot del Seguiment Actiu','Reunions de revisió trimestral','Estratègia fiscal integrada','Accés prioritari a oportunitats','Anàlisi de sectors i empreses'],
                  cta: 'Contactar per a Premium',
                  highlight: false,
                },
              ].map((plan, i) => (
                <Fade key={plan.title} delay={i * 0.1}>
                  <div className={`relative rounded-2xl p-6 flex flex-col h-full ${plan.highlight
                    ? 'bg-gradient-to-b from-[#1a3a2a]/65 to-[#0d1a14]/85 border border-[#c9a84c]/22'
                    : 'bg-[#080e0b] border border-[#1a3a2a]/55'}`}
                    style={plan.highlight ? { boxShadow: '0 0 0 1px rgba(201,168,76,0.07),0 16px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(201,168,76,0.08)' } : { boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.05)' }}>

                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="text-[9px] px-3 py-1 bg-[#c9a84c] text-[#0d1f1a] font-bold uppercase tracking-widest rounded-full">
                          {plan.eyebrow}
                        </span>
                      </div>
                    )}

                    <div className="mb-5">
                      {!plan.highlight && (
                        <p className="text-[#2d6a4f]/80 text-[10px] uppercase tracking-widest mb-2">{plan.eyebrow}</p>
                      )}
                      <h3 className="text-white font-bold text-lg mb-3">{plan.title}</h3>
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className={`font-black ${plan.priceMain === '20€' ? 'text-4xl' : 'text-2xl'} ${plan.highlight ? 'text-[#c9a84c]' : 'text-white'}`}>
                          {plan.priceMain}
                        </span>
                        <span className="text-white/50 text-xs">{plan.priceSub}</span>
                      </div>
                      <p className="text-white/50 text-xs leading-relaxed">{plan.desc}</p>
                    </div>

                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.highlight ? 'bg-[#c9a84c]/12' : 'bg-[#1a3a2a]/70'}`}>
                            <svg className={`w-2.5 h-2.5 ${plan.highlight ? 'text-[#c9a84c]' : 'text-[#2d6a4f]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-white/60 text-xs leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => setShowLeadForm(true)}
                      className={`w-full block text-center py-3 text-xs font-bold rounded-xl transition-all duration-200 ${plan.highlight
                        ? 'bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a]'
                        : 'border border-[#1a3a2a] hover:border-[#2d6a4f]/50 text-white/55 hover:text-white'}`}
                      style={plan.highlight ? { boxShadow: '0 4px 16px rgba(201,168,76,0.18)' } : {}}>
                      {plan.cta}
                    </button>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ── Com funciona (4 passos) ─────────────── */}
        <section className="border-t border-[#1a3a2a]/40 px-6 md:px-10 lg:px-16 py-24 md:py-32">
          <div className="max-w-5xl mx-auto">
            <Fade className="text-center mb-14">
              <p className="text-[#2d6a4f]/80 text-xs uppercase tracking-[0.4em] mb-3">Com funciona</p>
              <h2 className="text-white font-black text-3xl md:text-4xl">Quatre passos per invertir millor</h2>
              <p className="text-white/50 text-sm mt-3 max-w-lg mx-auto">Ràpid, clar i supervisat per un professional.</p>
            </Fade>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
              {STEPS.map((s, i) => (
                <Fade key={s.step} delay={i * 0.1}>
                  <div className="relative">
                    {i < STEPS.length - 1 && (
                      <div className="hidden lg:block absolute top-6 left-[calc(100%-8px)] w-full h-px bg-gradient-to-r from-[#1a3a2a] to-transparent z-0" />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl border border-[#1a3a2a] bg-[#0d1a14] flex items-center justify-center flex-shrink-0">
                          <Icon d={s.iconPath} className="w-5 h-5 text-[#2d6a4f]" />
                        </div>
                        <span className="text-[#c9a84c]/35 font-black text-2xl tabular-nums">{s.step}</span>
                      </div>
                      <h3 className="text-white font-semibold text-sm mb-2">{s.title}</h3>
                      <p className="text-white/50 text-xs leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </Fade>
              ))}
            </div>

            <Fade className="text-center mt-12">
              <button onClick={() => setShowLeadForm(true)}
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#1a3a2a] border border-[#2d6a4f]/35 hover:border-[#2d6a4f] text-[#c9a84c] font-semibold text-sm rounded-xl transition-all duration-200">
                Comença ara
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </Fade>
          </div>
        </section>

        {/* ── Beneficis ──────────────────────────── */}
        <section className="border-t border-[#1a3a2a]/40 px-6 md:px-10 lg:px-16 py-24 md:py-32"
          style={{ background: 'linear-gradient(to bottom,rgba(26,58,42,0.07),transparent 55%)' }}>
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <Fade>
                <p className="text-[#2d6a4f]/80 text-xs uppercase tracking-[0.4em] mb-3">Per què Factor OTC</p>
                <h2 className="text-white font-black text-3xl md:text-4xl leading-tight mb-6">
                  Tecnologia i<br />
                  <span className="text-shimmer">assessorament humà</span>
                </h2>
                <p className="text-white/50 text-sm leading-relaxed mb-8">
                  Combinem eines digitals de nivell professional amb l&apos;acompanyament d&apos;un assessor real. El millor dels dos mons.
                </p>
                <button onClick={() => setShowLeadForm(true)}
                  className="inline-flex items-center gap-2 text-[#c9a84c] text-sm font-semibold hover:gap-3 transition-all duration-200">
                  Comença el teu diagnosi gratuït
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </Fade>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BENEFITS.map((b, i) => (
                  <Fade key={b.title} delay={i * 0.07}>
                    <div className="border border-[#1a3a2a]/50 rounded-xl p-4 bg-[#080e0b]"
                      style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.05)' }}>
                      <div className="w-8 h-8 rounded-lg bg-[#1a3a2a]/55 border border-[#2d6a4f]/12 flex items-center justify-center mb-3">
                        <Icon d={b.iconPath} className="w-4 h-4 text-[#2d6a4f]" />
                      </div>
                      <h4 className="text-white/80 font-semibold text-xs mb-1">{b.title}</h4>
                      <p className="text-white/50 text-xs leading-relaxed">{b.desc}</p>
                    </div>
                  </Fade>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ─────────────────────────── */}
        <section className="border-t border-[#1a3a2a]/40 px-6 md:px-10 py-20 md:py-24">
          <Fade>
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 border border-[#2d6a4f]/18 rounded-full bg-[#1a3a2a]/8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
                <span className="text-[#c9a84c]/80 text-xs uppercase tracking-[0.3em]">Sol·licita accés</span>
              </div>
              <h2 className="text-white font-black text-3xl md:text-4xl mb-4">
                Comença amb el teu informe<br />personalitzat
              </h2>
              <p className="text-white/50 text-sm mb-8 max-w-md mx-auto leading-relaxed">
                En menys de 5 minuts tens el teu perfil inversor i la proposta de cartera.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => setShowLeadForm(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-xl transition-all duration-200"
                  style={{ boxShadow: '0 0 30px rgba(201,168,76,0.18)' }}>
                  Sol·licita el teu informe
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                <a href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-[#1a3a2a] hover:border-[#2d6a4f]/50 text-white/55 hover:text-white font-medium text-sm rounded-xl transition-all duration-200">
                  Ja sóc client →
                </a>
              </div>
            </div>
          </Fade>
        </section>

        {/* ── Footer ─────────────────────────────── */}
        <footer className="border-t border-[#1a3a2a]/50 px-6 md:px-10 lg:px-16 pt-12 pb-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">

              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-[#1a3a2a] border border-[#2d6a4f]/60 rounded flex items-center justify-center">
                    <span className="text-[#c9a84c] font-black text-xs leading-none">F</span>
                  </div>
                  <span className="text-white font-bold text-sm tracking-tight">FACTOR</span>
                  <span className="text-[#2d6a4f] font-light text-sm tracking-wider">OTC</span>
                </div>
                <p className="text-white/35 text-xs leading-relaxed max-w-[180px]">
                  Assessorament financer personalitzat amb tecnologia professional.
                </p>
              </div>

              <div>
                <p className="text-white/52 text-[10px] uppercase tracking-widest mb-4">Eines</p>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Comparador de Fons', href: '/comparador' },
                    { label: 'Notícies de Mercat', href: '/noticies' },
                    { label: "Seguiment d'Accions", href: '/client/seguiment-accions' },
                    { label: 'Informe Bursàtil', href: '/informe-bursatil' },
                  ].map(l => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-white/38 hover:text-white/65 text-xs transition-colors duration-150">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-white/52 text-[10px] uppercase tracking-widest mb-4">Serveis</p>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Informe Inicial (20€)', href: '/login' },
                    { label: 'Seguiment Actiu', href: '/login' },
                    { label: 'Premium', href: '/login' },
                  ].map(l => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-white/38 hover:text-white/65 text-xs transition-colors duration-150">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button onClick={() => setShowLeadForm(true)}
                      className="text-white/38 hover:text-white/65 text-xs transition-colors duration-150">
                      RoboAdvisor
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-white/52 text-[10px] uppercase tracking-widest mb-4">Plataforma</p>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Accés clients', href: '/login' },
                    { label: 'Carteres Model', href: '/client/carteres-model' },
                    { label: 'La meva Cartera', href: '/client/cartera' },
                    { label: 'Comparador', href: '/comparador' },
                  ].map(l => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="text-white/38 hover:text-white/65 text-xs transition-colors duration-150">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-[#1a3a2a]/40 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-white/28 text-xs">
                © {new Date().getFullYear()} Factor OTC · Tots els drets reservats
              </p>
              <p className="text-white/25 text-[10px] text-center md:text-right max-w-sm">
                Eina de suport a la decisió · No constitueix assessorament financer regulat · No executa operacions reals
              </p>
            </div>
          </div>
        </footer>

      </div>

      {showLeadForm && (
        <LeadForm onClose={() => setShowLeadForm(false)} />
      )}
    </div>
  );
}
