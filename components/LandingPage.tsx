'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AppView } from '@/app/page';
import LeadForm from './LeadForm';

interface Props {
  onNavigate: (view: AppView) => void;
}

// ─── Tool cards ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    href:       '/comparador',
    iconPath:   'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title:      'Comparador de Fons',
    desc:       'Compara fins a 5 fons per rendibilitat, volatilitat, TER i risc.',
    badge:      'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    authRequired: false,
  },
  {
    href:       '/noticies',
    iconPath:   'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM9 13h6M9 17h3',
    title:      'Notícies de Mercat',
    desc:       'Articles financers per categories: mercats, macro, fons i ETFs.',
    badge:      'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    authRequired: false,
  },
  {
    href:       '/client/carteres-model',
    iconPath:   'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    title:      'Carteres Model',
    desc:       "Distribució d'actius òptima per perfil inversor amb simulació Monte Carlo.",
    badge:      'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    authRequired: false,
  },
  {
    href:       '/client/cartera',
    iconPath:   'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    title:      'La meva cartera',
    desc:       'Seguiment personalitzat de la teva cartera, rendibilitat, moviments i notes de l\'assessor.',
    badge:      'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
    authRequired: true,
  },
  {
    href:       '/client/seguiment-accions',
    iconPath:   'M3 17l6-6 4 4 8-8',
    title:      "Seguiment d'Accions",
    desc:       "Senyals tècnics, fonamentals i anàlisi de gràfics en temps real.",
    badge:      'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
    authRequired: true,
  },
  {
    href:       '/informe-bursatil',
    iconPath:   'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    title:      'Informe Bursàtil',
    desc:       'Informe professional per ticker: fonamentals, competència i gràfic de preus.',
    badge:      'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
    authRequired: true,
  },
];

const NAV_LINKS = [
  { label: 'Comparador', href: '/comparador'               },
  { label: 'Notícies',   href: '/noticies'                  },
  { label: 'Accions',    href: '/client/seguiment-accions'  },
];

const HERO_CANDLES = [
  { o: 145, h: 150, l: 143, c: 148 }, { o: 148, h: 149, l: 141, c: 143 },
  { o: 143, h: 153, l: 142, c: 151 }, { o: 151, h: 156, l: 149, c: 154 },
  { o: 154, h: 155, l: 147, c: 149 }, { o: 149, h: 161, l: 148, c: 158 },
  { o: 158, h: 161, l: 153, c: 155 }, { o: 155, h: 165, l: 154, c: 163 },
  { o: 163, h: 165, l: 157, c: 159 }, { o: 159, h: 169, l: 158, c: 167 },
  { o: 167, h: 173, l: 165, c: 171 }, { o: 171, h: 173, l: 166, c: 168 },
  { o: 168, h: 177, l: 167, c: 175 }, { o: 175, h: 177, l: 170, c: 172 },
  { o: 172, h: 180, l: 170, c: 178 }, { o: 178, h: 183, l: 176, c: 181 },
  { o: 181, h: 183, l: 174, c: 176 }, { o: 176, h: 185, l: 174, c: 183 },
  { o: 183, h: 189, l: 181, c: 187 }, { o: 187, h: 190, l: 183, c: 185 },
];

const HERO_TICKERS = [
  { symbol: 'S&P 500', price: '5,847.3', change: 0.42  },
  { symbol: 'NVDA',    price: '$875.40',  change: 2.34  },
  { symbol: 'BTC/USD', price: '$67,420',  change: 1.87  },
  { symbol: 'EUR/USD', price: '1.0823',   change: -0.11 },
];

const STATS = [
  { value: '158',     label: 'Fons i ETFs',       sub: 'Base de dades validada' },
  { value: '10.000+', label: 'Sim. Monte Carlo',  sub: 'Per perfil inversor'    },
  { value: '5',       label: 'Perfils inversor',  sub: 'Conservador → Agressiu' },
  { value: '14+',     label: 'Senyals actives',   sub: 'Accions en vigilància'  },
];

function StatItem({ value, label, sub, delay }: { value: string; label: string; sub: string; delay: number }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className="text-center">
      <div className="text-2xl md:text-3xl font-black text-[#c9a84c] mb-0.5 tabular-nums">{value}</div>
      <div className="text-white/60 text-xs uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-white/25 text-xs">{sub}</div>
    </motion.div>
  );
}

// ─── Access Gate ─────────────────────────────────────────────────────────────

function AccessGate({ onLogin, onLeadForm, onDismiss }: {
  onLogin: () => void;
  onLeadForm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(26,58,42,0.7) 0%, rgba(8,14,11,0.97) 60%)' }}>

      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(45,106,79,0.04) 80px)' }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-[#1a3a2a] border border-[#2d6a4f]/60 rounded-lg flex items-center justify-center">
            <span className="text-[#c9a84c] font-black text-base leading-none">F</span>
          </div>
          <span className="text-white font-black text-2xl tracking-wider">FACTOR</span>
          <span className="text-[#2d6a4f] font-light text-2xl tracking-widest">OTC</span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 bg-white/3 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
          <span className="text-white/40 text-xs uppercase tracking-[0.25em]">Plataforma d&apos;accés restringit</span>
        </div>

        <h1 className="text-white font-black text-2xl mb-3 leading-tight">
          Benvingut/da a<br />
          <span className="text-[#c9a84c]">Factor OTC</span>
        </h1>
        <p className="text-white/40 text-sm leading-relaxed mb-10 max-w-xs mx-auto">
          Assessorament financer independent i personalitzat. Tecnologia i criteri humà al teu servei.
        </p>

        {/* Main CTAs */}
        <div className="flex flex-col gap-3 mb-6">
          <button onClick={onLogin}
            className="w-full py-3.5 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Ja tinc accés
          </button>

          <button onClick={onLeadForm}
            className="w-full py-3.5 bg-[#1a3a2a] border border-[#2d6a4f]/50 hover:bg-[#1f4432] hover:border-[#2d6a4f] text-[#c9a84c] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Vull sol·licitar accés
          </button>
        </div>

        {/* Dismiss */}
        <button onClick={onDismiss}
          className="text-white/20 hover:text-white/50 text-xs transition-colors">
          Continuar com a visitant →
        </button>

        {/* Trust signals */}
        <div className="mt-10 flex items-center justify-center gap-6 border-t border-white/5 pt-6">
          {['MiFID II', 'RGPD', 'SSL'].map(label => (
            <div key={label} className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-white/20 text-[10px] uppercase tracking-widest">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function LandingPage({ onNavigate }: Props) {
  const { data: session, status } = useSession();
  const router                   = useRouter();
  const [loaded, setLoaded]      = useState(false);
  const [menuOpen, setMenuOpen]  = useState(false);
  const [showGate, setShowGate]  = useState(false);
  const [showLead, setShowLead]  = useState(false);

  // Show gate on every load for unauthenticated users
  useEffect(() => {
    if (status === 'loading') return;
    if (session) return; // Already logged in — no gate
    setShowGate(true);
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, [status, session]);

  useEffect(() => {
    if (session) {
      const t = setTimeout(() => setLoaded(true), 100);
      return () => clearTimeout(t);
    }
  }, [session]);

  function dismissGate() {
    setShowGate(false);
    setLoaded(true);
  }

  function handleLogin() {
    dismissGate();
    router.push('/login');
  }

  function handleLeadFormOpen() {
    dismissGate();
    setShowLead(true);
  }

  const isAuthenticated = !!session;
  const isClient        = session?.user?.role === 'client' || session?.user?.role === 'admin';

  return (
    <div className="relative min-h-screen bg-[#080e0b]">

      {showGate && !session && status !== 'loading' && (
        <AccessGate
          onLogin={handleLogin}
          onLeadForm={handleLeadFormOpen}
          onDismiss={dismissGate}
        />
      )}

      {showLead && (
        <LeadForm
          onClose={() => setShowLead(false)}
          onSuccess={() => { /* gate already dismissed */ }}
        />
      )}

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-5%,rgba(201,168,76,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_-10%_100%,rgba(26,58,42,0.55),transparent)]" />
        <div className="absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(45,106,79,0.04) 80px)' }} />
      </div>

      <div className="relative min-h-screen flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between px-6 md:px-10 h-14 border-b border-[#1a3a2a]/80 bg-[#080e0b]/85 backdrop-blur sticky top-0 z-30"
          style={{ boxShadow: '0 1px 0 rgba(26,58,42,0.4)' }}>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1a3a2a] border border-[#2d6a4f]/60 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-xs leading-none">F</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight">FACTOR</span>
            <span className="text-[#2d6a4f] font-light text-sm tracking-wider">OTC</span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="text-[#2d6a4f]/80 hover:text-[#c9a84c] text-xs uppercase tracking-widest transition-colors duration-200">
                {link.label}
              </Link>
            ))}
            <div className="w-px h-4 bg-[#1a3a2a]" />
            {isAuthenticated ? (
              <Link href={session?.user?.role === 'admin' ? '/admin' : '/client/cartera'}
                className="text-[#c9a84c] text-xs uppercase tracking-widest font-semibold hover:text-[#b8963f] transition-colors">
                {session?.user?.role === 'admin' ? 'Admin' : 'La meva cartera'}
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => setShowLead(true)}
                  className="text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors">
                  Sol·licita accés
                </button>
                <Link href="/login"
                  className="px-3 py-1.5 border border-[#2d6a4f]/40 rounded text-[#c9a84c] text-xs font-semibold hover:border-[#2d6a4f] hover:bg-[#1a3a2a]/50 transition-colors">
                  Entrar
                </Link>
              </div>
            )}
          </nav>

          <button onClick={() => setMenuOpen(v => !v)}
            className="md:hidden p-2 text-white/40 hover:text-white" aria-label="Menu">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </motion.header>

        {menuOpen && (
          <div className="border-b border-[#1a3a2a]/60 bg-[#080e0b] px-6 py-4 md:hidden z-20">
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                  className="text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors">
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-3">
                {isAuthenticated ? (
                  <Link href={session?.user?.role === 'admin' ? '/admin' : '/client/cartera'}
                    className="text-[#c9a84c] text-sm font-semibold">
                    {session?.user?.role === 'admin' ? 'Panell Admin' : 'La meva cartera'}
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="text-white/50 text-sm hover:text-white transition-colors">
                      Iniciar sessió
                    </Link>
                    <button onClick={() => { setMenuOpen(false); setShowLead(true); }}
                      className="text-[#c9a84c]/70 text-sm text-left hover:text-[#c9a84c] transition-colors">
                      Sol·licitar accés
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8 relative overflow-hidden">

          {/* Decorative chart — desktop right */}
          <div className="absolute right-0 top-0 bottom-0 w-[400px] pointer-events-none hidden xl:flex flex-col justify-center items-end pr-8 gap-3">
            <div className="relative w-full flex justify-end">
              <svg width="340" height="200" viewBox="0 0 340 200" className="opacity-[0.18]">
                {[50, 100, 150].map(y => (
                  <line key={y} x1="0" y1={y} x2="340" y2={y} stroke="white" strokeOpacity="0.2" strokeWidth="0.5" strokeDasharray="4 4" />
                ))}
                <polyline points="0,168 34,162 68,152 102,138 136,130 170,115 204,98 238,82 272,65 306,50 340,38"
                  stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeOpacity="0.8" />
                {HERO_CANDLES.map((c, i) => {
                  const MIN = 138, RANGE = 54, H = 190;
                  const py = (p: number) => H - ((p - MIN) / RANGE) * H;
                  const bull = c.c >= c.o;
                  const bodyTop = py(Math.max(c.o, c.c));
                  const bodyH = Math.max(Math.abs(py(c.o) - py(c.c)), 1.5);
                  const cx = i * 17 + 5;
                  const color = bull ? '#10b981' : '#ef4444';
                  return (
                    <g key={i}>
                      <line x1={cx} y1={py(c.h)} x2={cx} y2={py(c.l)} stroke={color} strokeWidth={1} opacity={0.9} />
                      <rect x={cx - 4} y={bodyTop} width={8} height={bodyH} fill={color} rx={1} opacity={0.9} />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute top-2 right-0 border border-[#c9a84c]/25 rounded-lg px-3 py-1.5 bg-[#0d1f1a]/80 backdrop-blur-sm">
                <span className="text-[#c9a84c] font-mono text-xs font-bold">$185.40</span>
                <span className="text-green-400 text-xs ml-2 font-mono">+1.87%</span>
              </div>
            </div>
            {HERO_TICKERS.map(t => (
              <div key={t.symbol}
                className="flex items-center gap-3 border border-white/8 rounded-lg px-4 py-2 bg-white/[0.025] backdrop-blur-sm w-[200px]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <span className="text-white/35 text-[10px] font-mono tracking-widest flex-1">{t.symbol}</span>
                <span className="text-white/80 font-mono text-xs">{t.price}</span>
                <span className={`text-[10px] font-mono font-semibold ${t.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-8 inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 bg-white/3">
            <span className="text-white/40 text-xs uppercase tracking-[0.25em]">Plataforma d&apos;inversió professional</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.25 }} className="mb-6">
            <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-white leading-none tracking-tighter">FACTOR</h1>
            <h1 className="text-6xl sm:text-8xl md:text-9xl font-black leading-none tracking-tighter text-shimmer">OTC</h1>
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a84c]/40" />
              <span className="text-white/30 text-xs uppercase tracking-[0.5em]">Assessorament Financer Independent</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a84c]/40" />
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-white/40 text-base md:text-lg max-w-xl leading-relaxed mb-10 font-light">
            Estratègies d&apos;inversió personalitzades basades en teoria moderna de carteres.
            <br />
            <span className="text-white/25">Precisió institucional. Accessibilitat digital.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 items-center mb-16">

            {isClient ? (
              <>
                <Link href="/client/cartera"
                  className="px-8 py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-sm transition-colors flex items-center gap-2">
                  La meva cartera
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <button onClick={() => onNavigate('roboadvisor')}
                  className="px-8 py-3 border border-[#1a3a2a] text-[#2d6a4f] hover:text-[#c9a84c] hover:border-[#2d6a4f]/60 font-medium text-sm rounded-sm transition-colors">
                  RoboAdvisor
                </button>
              </>
            ) : (
              <>
                <Link href="/login"
                  className="px-8 py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm tracking-wide rounded-sm transition-colors duration-200 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Ja tinc accés
                </Link>
                <button onClick={() => setShowLead(true)}
                  className="px-8 py-3 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] font-semibold text-sm tracking-wide rounded-sm hover:bg-[#1f4432] hover:border-[#2d6a4f] transition-colors duration-200">
                  Sol·licitar accés
                </button>
              </>
            )}
          </motion.div>

          {/* Tool cards — 3+3 grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="w-full max-w-4xl mb-6">

            <p className="text-[#2d6a4f]/70 text-xs uppercase tracking-[0.4em] mb-4 text-left">Eines disponibles</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TOOLS.map(tool => {
                const locked = tool.authRequired && !isClient;
                return (
                  <Link key={tool.href}
                    href={locked ? '/login' : tool.href}
                    className="group block border border-white/8 rounded-lg p-4 text-left bg-white/2 hover:bg-white/5 hover:border-[#c9a84c]/20 transition-all duration-200"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-7 h-7 rounded bg-white/5 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white/35 group-hover:text-[#c9a84c] transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tool.iconPath} />
                        </svg>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="text-white/70 font-medium text-xs mb-1 group-hover:text-white transition-colors duration-200 leading-snug">
                      {tool.title}
                    </h3>
                    <p className="text-white/25 text-[11px] leading-relaxed group-hover:text-white/35 transition-colors duration-200">
                      {tool.desc}
                    </p>
                    {locked && (
                      <div className="mt-2 flex items-center gap-1">
                        <svg className="w-3 h-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span className="text-white/20 text-[10px]">Requereix accés</span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Plans ──────────────────────────────────────────────────── */}
        <section className="border-t border-[#1a3a2a]/60 px-6 md:px-10 py-16">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[#2d6a4f]/70 text-xs uppercase tracking-[0.4em] mb-2">Assessorament financer</p>
              <h2 className="text-white font-black text-2xl md:text-3xl">Tria el pla que t&apos;encaixa</h2>
              <p className="text-white/30 text-sm mt-2 max-w-md mx-auto">
                Servei d&apos;assessorament independent. Sense comissions ocultes.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title:    'Informe Inicial',
                  price:    '20€',
                  period:   'pagament únic',
                  desc:     'Diagnosi financera completa del teu perfil inversor amb cartera recomanada i simulació Monte Carlo.',
                  features: ['Qüestionari de perfil MiFID II', 'Cartera optimitzada Markowitz', 'Simulació a 10/20/30 anys', 'Informe PDF professional'],
                  cta:      'Sol·licitar informe',
                  highlight: false,
                },
                {
                  title:    'Seguiment Mensual',
                  price:    'A consultar',
                  period:   'per mes',
                  desc:     'Seguiment continuat de la teva cartera amb revisions mensuals, alertes i accés a informes borsaris.',
                  features: ["Tot de l'informe inicial", 'Informe mensual de cartera', 'Accés a informes borsaris', 'Seguiment d\'accions en cartera'],
                  cta:      'Contactar assessor',
                  highlight: true,
                },
                {
                  title:    'Assessorament Complet',
                  price:    'A consultar',
                  period:   'personalitzat',
                  desc:     'Servei complet amb reunions periòdiques, estratègia fiscal i accés prioritari a oportunitats de mercat.',
                  features: ['Tot del seguiment mensual', 'Reunions de revisió trimestral', 'Estratègia fiscal integrada', 'Accés prioritari a oportunitats'],
                  cta:      'Parla amb un expert',
                  highlight: false,
                },
              ].map(plan => (
                <div key={plan.title}
                  className={`relative rounded-2xl p-6 border flex flex-col ${plan.highlight ? 'bg-[#1a3a2a]/50 border-[#c9a84c]/30' : 'bg-white/[0.02] border-white/8'}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[9px] px-3 py-1 bg-[#c9a84c] text-[#0d1f1a] font-bold uppercase tracking-widest rounded-full">Recomanat</span>
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-white font-bold text-sm mb-1">{plan.title}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-2xl font-black ${plan.highlight ? 'text-[#c9a84c]' : 'text-white'}`}>{plan.price}</span>
                      <span className="text-white/30 text-xs">{plan.period}</span>
                    </div>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed mb-4">{plan.desc}</p>
                  <ul className="space-y-1.5 mb-6 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-white/50 text-xs">
                        <svg className="w-3 h-3 text-[#2d6a4f] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => setShowLead(true)}
                    className={`block w-full text-center py-2.5 text-xs font-semibold rounded-lg transition-all ${plan.highlight ? 'bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a]' : 'border border-white/10 text-white/60 hover:text-white hover:border-white/20'}`}>
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Com funciona ───────────────────────────────────────────── */}
        <section className="border-t border-[#1a3a2a]/60 px-6 md:px-10 py-16"
          style={{ background: 'linear-gradient(to bottom, rgba(26,58,42,0.1), transparent)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-[#2d6a4f]/70 text-xs uppercase tracking-[0.4em] mb-2">Procés</p>
              <h2 className="text-white font-black text-2xl">Com funciona</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '01', title: 'Sol·licites accés',    desc: "Omples el formulari de contacte. Ens posem en contacte amb tu per explicar-te el servei i crear el teu compte." },
                { step: '02', title: 'Omplis el qüestionari', desc: 'Respon les preguntes sobre el teu perfil, objectius i tolerància al risc. Pren menys de 5 minuts.' },
                { step: '03', title: 'Seguiment continuat',  desc: "Accedeix al teu dashboard privat, revisa l'evolució i rep actualitzacions mensuals del teu assessor." },
              ].map((s, i) => (
                <div key={s.step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#c9a84c] font-black text-xs">{s.step}</span>
                    </div>
                    {i < 2 && <div className="w-px flex-1 mt-2 bg-gradient-to-b from-[#c9a84c]/20 to-transparent hidden md:block" />}
                  </div>
                  <div className="pb-6">
                    <h3 className="text-white font-semibold text-sm mb-1">{s.title}</h3>
                    <p className="text-white/35 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <button onClick={() => setShowLead(true)}
                className="inline-flex items-center gap-2 px-8 py-3 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] font-semibold text-sm rounded-sm hover:bg-[#1f4432] hover:border-[#2d6a4f] transition-colors">
                Sol·licitar accés ara
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div className="border-t border-[#1a3a2a]/80 px-8 py-8 relative"
          style={{ background: 'linear-gradient(to bottom, rgba(26,58,42,0.15), transparent)' }}>
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#2d6a4f]/30 to-transparent" />
          <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => <StatItem key={i} {...s} delay={i} />)}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="border-t border-[#1a3a2a]/50 text-center py-6 px-8">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-3">
            <Link href="/privacitat" className="text-white/20 hover:text-white/40 text-xs transition-colors">Privacitat</Link>
            <span className="text-white/10">·</span>
            <Link href="/cookies" className="text-white/20 hover:text-white/40 text-xs transition-colors">Cookies</Link>
            <span className="text-white/10">·</span>
            <Link href="/login" className="text-white/20 hover:text-white/40 text-xs transition-colors">Accés clients</Link>
          </div>
          <p className="text-white/15 text-xs">
            Eina de suport a la decisió · No constitueix assessorament financer regulat ·
            © {new Date().getFullYear()} Factor OTC
          </p>
        </div>
      </div>
    </div>
  );
}
