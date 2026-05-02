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
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-8">

          {/* Label */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-5 inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 bg-white/3">
            <span className="text-white/40 text-xs uppercase tracking-[0.25em]">
              Factor OTC · Plataforma d&apos;inversió
            </span>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mb-5">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-tight tracking-tight">
              Decisions d&apos;inversió
            </h1>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight tracking-tight text-shimmer">
              amb precisió institucional.
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 10 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-white/40 text-base md:text-lg max-w-xl leading-relaxed mb-10 font-light">
            Estratègies personalitzades basades en teoria moderna de carteres,
            anàlisi tècnica i fonamental en temps real.
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
                  className="group block border border-white/8 rounded-lg p-4 text-left bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all duration-200">
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
        <div className="border-t border-white/8 px-8 py-8">
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
