'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { AppView } from '@/app/page';

interface Props {
  onNavigate: (view: AppView) => void;
}

const TOOLS = [
  {
    href:  '/comparador',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    title: 'Comparador de Fons',
    desc:  'Compara fins a 5 fons per rendibilitat, volatilitat, TER i risc.',
    badge: 'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    href:  '/noticies',
    iconPath: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM9 13h6M9 17h3',
    title: 'Notícies de Mercat',
    desc:  'Articles financers per categories: mercats, macro, fons i ETFs.',
    badge: 'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    href:  '/accions',
    iconPath: 'M3 17l6-6 4 4 8-8',
    title: "Seguiment d'Accions",
    desc:  "Senyals tècnics, fonamentals i anàlisi de gràfics en temps real.",
    badge: 'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
  },
  {
    href:  '/cartera',
    iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    title: 'Carteres Model',
    desc:  "Distribució d'actius òptima amb simulació Monte Carlo.",
    badge: 'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
  },
];

const NAV_LINKS = [
  { label: 'Comparador', href: '/comparador' },
  { label: 'Notícies',   href: '/noticies'   },
  { label: 'Accions',    href: '/accions'     },
];

// Decorative candlestick data for hero illustration
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
  { symbol: 'S&P 500', price: '5,847.3', change: 0.42 },
  { symbol: 'NVDA',    price: '$875.40',  change: 2.34 },
  { symbol: 'BTC/USD', price: '$67,420',  change: 1.87 },
  { symbol: 'EUR/USD', price: '1.0823',   change: -0.11 },
];

const STATS = [
  { value: '158',    label: 'Fons i ETFs',       sub: 'Base de dades validada'  },
  { value: '10.000+',label: 'Sim. Monte Carlo',  sub: 'Per perfil inversor'     },
  { value: '5',      label: 'Perfils inversor',  sub: 'Conservador → Agressiu'  },
  { value: '14+',    label: 'Senyals actives',   sub: 'Accions en vigilància'   },
];

function StatItem({ value, label, sub, delay }: { value: string; label: string; sub: string; delay: number }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay * 0.1 }}
      className="text-center">
      <div className="text-2xl md:text-3xl font-black text-[#c9a84c] mb-0.5 tabular-nums">{value}</div>
      <div className="text-white/60 text-xs uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-white/25 text-xs">{sub}</div>
    </motion.div>
  );
}

export default function LandingPage({ onNavigate }: Props) {
  const [loaded, setLoaded]     = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#070c0a]">

      {/* Background: subtle radial + horizontal lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(201,168,76,0.07),transparent)]" />
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 79px,rgba(255,255,255,0.025) 80px)',
          }}
        />
      </div>

      <div className="relative min-h-screen flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between px-6 md:px-10 h-14 border-b border-white/8 bg-[#070c0a]/80 backdrop-blur sticky top-0 z-30">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#c9a84c]/15 border border-[#c9a84c]/40 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-xs leading-none">F</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight">FACTOR</span>
            <span className="text-[#c9a84c]/60 font-light text-sm tracking-wider">OTC</span>
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors duration-200">
                {link.label}
              </Link>
            ))}
            <div className="w-px h-4 bg-white/15" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400/70 text-xs">Sistema actiu</span>
            </div>
          </nav>

          {/* Hamburger mòbil */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden p-2 text-white/40 hover:text-white"
            aria-label="Menu">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </motion.header>

        {/* Nav mòbil */}
        {menuOpen && (
          <div className="border-b border-white/10 bg-[#070c0a] px-6 py-4 md:hidden z-20">
            <div className="flex flex-col gap-4">
              {NAV_LINKS.map(link => (
                <Link key={link.href} href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-white/50 hover:text-white text-sm uppercase tracking-widest transition-colors">
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => { setMenuOpen(false); onNavigate('admin'); }}
                  className="text-white/30 text-xs uppercase tracking-widest hover:text-white/60 transition-colors">
                  Àrea Admin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8 relative overflow-hidden">

          {/* Decorative chart panel — desktop right */}
          <div className="absolute right-0 top-0 bottom-0 w-[400px] pointer-events-none hidden xl:flex flex-col justify-center items-end pr-8 gap-3">
            {/* Candlestick SVG */}
            <div className="relative w-full flex justify-end">
              <svg width="340" height="200" viewBox="0 0 340 200" className="opacity-[0.18]">
                {/* Horizontal grid */}
                {[50, 100, 150].map(y => (
                  <line key={y} x1="0" y1={y} x2="340" y2={y} stroke="white" strokeOpacity="0.2" strokeWidth="0.5" strokeDasharray="4 4" />
                ))}
                {/* EMA line */}
                <polyline
                  points="0,168 34,162 68,152 102,138 136,130 170,115 204,98 238,82 272,65 306,50 340,38"
                  stroke="#c9a84c" strokeWidth="1.5" fill="none" strokeOpacity="0.8"
                />
                {/* Candles */}
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
              {/* Latest price badge */}
              <div className="absolute top-2 right-0 border border-[#c9a84c]/25 rounded-lg px-3 py-1.5 bg-[#0d1f1a]/80 backdrop-blur-sm">
                <span className="text-[#c9a84c] font-mono text-xs font-bold">$185.40</span>
                <span className="text-green-400 text-xs ml-2 font-mono">+1.87%</span>
              </div>
            </div>

            {/* Ticker cards */}
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

          {/* Label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-8 inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 bg-white/3">
            <span className="text-white/40 text-xs uppercase tracking-[0.25em]">
              Plataforma d&apos;inversió professional
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mb-6">
            <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-white leading-none tracking-tighter">
              FACTOR
            </h1>
            <h1 className="text-6xl sm:text-8xl md:text-9xl font-black leading-none tracking-tighter text-shimmer">
              OTC
            </h1>
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#c9a84c]/40" />
              <span className="text-white/30 text-xs uppercase tracking-[0.5em]">RoboAdvisor Pro</span>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#c9a84c]/40" />
            </div>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-white/40 text-base md:text-lg max-w-xl leading-relaxed mb-10 font-light">
            Estratègies d&apos;inversió personalitzades basades en teoria moderna de carteres.
            <br />
            <span className="text-white/25">Precisió institucional. Accessibilitat digital.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-3 items-center mb-16">

            <button
              onClick={() => onNavigate('roboadvisor')}
              className="px-8 py-3 bg-[#c9a84c] text-[#0d1f1a] font-semibold text-sm tracking-wide rounded-sm hover:bg-[#e8d5a3] transition-colors duration-200 flex items-center gap-2">
              RoboAdvisor Automàtic
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>

            <button
              onClick={() => onNavigate('admin')}
              className="px-8 py-3 border border-white/15 text-white/50 hover:text-white hover:border-white/30 font-medium text-sm tracking-wide rounded-sm transition-colors duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Àrea Admin
            </button>
          </motion.div>

          {/* Tool cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="w-full max-w-4xl mb-6">

            <p className="text-white/15 text-xs uppercase tracking-[0.4em] mb-4 text-left">Eines disponibles</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {TOOLS.map(tool => (
                <Link key={tool.href} href={tool.href}
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
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────────── */}
        <div className="border-t border-white/8 px-8 py-8 relative">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent" />
          <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s, i) => <StatItem key={i} {...s} delay={i} />)}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-white/5 text-center py-4 px-8">
          <p className="text-white/15 text-xs">
            Eina de suport a la decisió · No constitueix assessorament financer regulat ·
            No executa operacions reals · © {new Date().getFullYear()} Factor OTC
          </p>
        </div>
      </div>
    </div>
  );
}
