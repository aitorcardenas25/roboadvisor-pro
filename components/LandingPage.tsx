'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import Link from 'next/link';
import { AppView } from '@/app/page';
import ThreeBackground from './ThreeBackground';

interface Props {
  onNavigate: (view: AppView) => void;
}

const TOOLS = [
  {
    href:  '/comparador',
    icon:  '⚖️',
    title: 'Comparador de Fons',
    desc:  'Compara fins a 5 fons per rendibilitat, volatilitat, TER i risc.',
    badge: 'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    accent: '#10b981',
  },
  {
    href:  '/noticies',
    icon:  '📰',
    title: 'Notícies de Mercat',
    desc:  'Articles financers per categories: mercats, macro, fons i ETFs.',
    badge: 'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    accent: '#3b82f6',
  },
  {
    href:  '/accions',
    icon:  '📈',
    title: 'Seguiment d\'Accions',
    desc:  'Signals d\'oportunitat, risc i anàlisi tècnica/fonamental.',
    badge: 'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    accent: '#f59e0b',
  },
  {
    href:  '/cartera',
    icon:  '🗂',
    title: 'Carteres Model',
    desc:  'Carteres model amb distribució d\'actius i evolució simulada.',
    badge: 'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
    accent: '#c9a84c',
  },
];

const NAV_LINKS = [
  { label: 'Comparador', href: '/comparador' },
  { label: 'Notícies',   href: '/noticies'   },
  { label: 'Accions',    href: '/accions'     },
];

const STATS = [
  { target: 100, suffix: '+',   label: 'Fons analitzats',    sub: 'Base de dades validada'  },
  { target: 1000, suffix: '',   label: 'Sim. Monte Carlo',   sub: 'Per escenari'            },
  { target: 4,   suffix: '',    label: 'Perfils inversor',   sub: 'Conservador → Agressiu'  },
  { target: 6,   suffix: '',    label: 'Senyals actives',    sub: 'Accions en vigilància'   },
];

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

function StatItem({ target, suffix, label, sub, delay }: {
  target: number; suffix: string; label: string; sub: string; delay: number;
}) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const count  = useCountUp(target, 1600 + delay * 200, inView);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: delay * 0.12 }}
      className="group text-center">
      <div className="text-3xl md:text-4xl font-black text-white mb-1 group-hover:text-[#c9a84c] transition-colors duration-500 tabular-nums">
        {count}{suffix}
      </div>
      <div className="text-white/50 text-xs uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-white/25 text-xs">{sub}</div>
    </motion.div>
  );
}

const CONTAINER: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

export default function LandingPage({ onNavigate }: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f0d] scanlines">
      <ThreeBackground />

      {/* Gradient overlay layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f0d]/50 via-transparent to-[#0a0f0d] pointer-events-none z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f0d]/30 via-transparent to-[#0a0f0d]/30 pointer-events-none z-10" />

      {/* Grid pattern subtil */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-20 min-h-screen flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : -24 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between px-8 py-6 glass-dark">

          {/* Logo */}
          <div className="flex items-center gap-3 group">
            <motion.div
              animate={{ rotate: [0, 90, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-8 h-8 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#c9a84c]" />
            </motion.div>
            <div>
              <span className="text-white font-black text-lg tracking-tight">FACTOR</span>
              <span className="text-[#c9a84c] font-light text-lg tracking-widest ml-1">OTC</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="text-white/40 hover:text-[#c9a84c] text-xs uppercase tracking-widest transition-all duration-300 hover:tracking-[0.35em]">
                {link.label}
              </Link>
            ))}
            <div className="w-px h-4 bg-white/15" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
              <span className="text-emerald-400 text-xs uppercase tracking-widest">Sistema actiu</span>
            </div>
          </nav>
        </motion.header>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-6 pb-0">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.85 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 inline-flex items-center gap-3 border border-[#c9a84c]/30 rounded-full px-5 py-2 bg-[#c9a84c]/5 backdrop-blur-sm glow-gold">
            <motion.div
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-1 h-1 rounded-full bg-[#c9a84c]"
            />
            <span className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] font-medium">
              Plataforma d&apos;inversió professional
            </span>
            <motion.div
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1.25 }}
              className="w-1 h-1 rounded-full bg-[#c9a84c]"
            />
          </motion.div>

          {/* Títol */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 40 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6">
            <h1 className="text-7xl md:text-9xl font-black text-white leading-none tracking-tighter">
              FACTOR
            </h1>
            <h1 className="text-7xl md:text-9xl font-black leading-none tracking-tighter text-shimmer">
              OTC
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: loaded ? 1 : 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 flex items-center justify-center gap-4">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#c9a84c]/50" />
              <span className="text-white/40 text-xs uppercase tracking-[0.5em]">RoboAdvisor Pro</span>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#c9a84c]/50" />
            </motion.div>
          </motion.div>

          {/* Subtítol */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-white/40 text-lg md:text-xl max-w-2xl leading-relaxed mb-12 font-light">
            Estratègies d&apos;inversió personalitzades basades en teoria moderna de carteres.
            <br />
            <span className="text-white/25">Precisió institucional. Accessibilitat digital.</span>
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 items-center mb-16">

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('roboadvisor')}
              className="btn-glow relative px-10 py-4 bg-[#c9a84c] overflow-hidden group">
              <motion.div
                className="absolute inset-0 bg-white/10"
                initial={{ x: '-100%' }}
                whileHover={{ x: '100%' }}
                transition={{ duration: 0.5 }}
              />
              <span className="relative text-[#0d1f1a] font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-3">
                RoboAdvisor Automàtic
                <motion.svg
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </motion.svg>
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('admin')}
              className="px-10 py-4 border border-white/15 hover:border-[#c9a84c]/40 transition-all duration-400 group relative overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-[#c9a84c]/5"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative text-white/50 group-hover:text-[#c9a84c] font-medium text-sm uppercase tracking-[0.2em] flex items-center gap-3 transition-colors duration-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Àrea Admin
              </span>
            </motion.button>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            variants={CONTAINER}
            initial="hidden"
            animate={loaded ? 'show' : 'hidden'}
            transition={{ delayChildren: 1.1 }}
            className="w-full max-w-5xl px-4 mb-14">

            <motion.p
              variants={ITEM}
              className="text-white/15 text-xs uppercase tracking-[0.4em] mb-5">
              Eines disponibles
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TOOLS.map((tool) => (
                <motion.div key={tool.href} variants={ITEM}>
                  <Link href={tool.href}
                    className="block h-full glass border border-white/8 rounded-xl p-4 card-hover group text-left"
                    style={{ '--hover-accent': tool.accent } as React.CSSProperties}>
                    <div className="flex items-start justify-between mb-3">
                      <motion.span
                        whileHover={{ scale: 1.2, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                        className="text-2xl select-none">
                        {tool.icon}
                      </motion.span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1.5 group-hover:text-[#e8d5a3] transition-colors duration-300">
                      {tool.title}
                    </h3>
                    <p className="text-white/30 text-xs leading-relaxed group-hover:text-white/45 transition-colors duration-300">
                      {tool.desc}
                    </p>
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-white/20 group-hover:text-[#c9a84c]/60 transition-colors duration-300">
                      <span>Accedir</span>
                      <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <div className="relative z-20 px-8 pb-10">
          <div className="max-w-4xl mx-auto border-t border-white/8 pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {STATS.map((s, i) => (
                <StatItem key={i} {...s} delay={i} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="relative z-20 text-center pb-4 px-8">
          <p className="text-white/15 text-xs">
            Eina de suport a la decisió · No constitueix assessorament financer regulat ·
            No executa operacions reals · © {new Date().getFullYear()} Factor OTC
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
