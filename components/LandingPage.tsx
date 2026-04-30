'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AppView } from '@/app/page';
import ThreeBackground from './ThreeBackground';

interface Props {
  onNavigate: (view: AppView) => void;
}

const TOOLS = [
  {
    href:    '/comparador',
    icon:    '⚖️',
    title:   'Comparador de Fons',
    desc:    'Compara fins a 5 fons per rendibilitat, volatilitat, TER, risc i benchmark.',
    badge:   'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    href:    '/noticies',
    icon:    '📰',
    title:   'Notícies de Mercat',
    desc:    'Articles financers per categories: mercats, macro, renda variable, fons i ETFs.',
    badge:   'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    href:    '/accions',
    icon:    '📈',
    title:   'Seguiment d\'Accions',
    desc:    'Accions en vigilància amb signals d\'oportunitat, risc i anàlisi tècnica/fonamental.',
    badge:   'Públic',
    badgeColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    href:    '/cartera',
    icon:    '🗂',
    title:   'Carteres Model',
    desc:    'Carteres d\'inversió model amb distribució d\'actius, mètriques i evolució simulada.',
    badge:   'Clients',
    badgeColor: 'text-[#c9a84c] bg-[#c9a84c]/10 border-[#c9a84c]/20',
  },
];

const NAV_LINKS = [
  { label: 'Comparador', href: '/comparador' },
  { label: 'Notícies',   href: '/noticies'   },
  { label: 'Accions',    href: '/accions'     },
];

export default function LandingPage({ onNavigate }: Props) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d1f1a]">

      <ThreeBackground />

      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1f1a]/40 via-transparent to-[#0d1f1a]/95 pointer-events-none z-10" />
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-20 min-h-screen flex flex-col">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : -20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center justify-between px-8 py-6">

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#c9a84c]" />
            </div>
            <div>
              <span className="text-white font-black text-lg tracking-tight">FACTOR</span>
              <span className="text-[#c9a84c] font-light text-lg tracking-widest ml-1">OTC</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className="text-white/40 hover:text-[#c9a84c] text-xs uppercase tracking-widest transition-colors duration-300">
                {link.label}
              </Link>
            ))}
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/40 text-xs uppercase tracking-widest">Sistema actiu</span>
            </div>
          </nav>
        </motion.header>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pt-8 pb-0">

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.9 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8 inline-flex items-center gap-3 border border-[#c9a84c]/30 rounded-full px-5 py-2 bg-[#c9a84c]/5 backdrop-blur-sm">
            <div className="w-1 h-1 rounded-full bg-[#c9a84c]" />
            <span className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] font-medium">
              Plataforma d&apos;inversió professional
            </span>
            <div className="w-1 h-1 rounded-full bg-[#c9a84c]" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 30 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mb-6">
            <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tight">FACTOR</h1>
            <h1 className="text-6xl md:text-8xl font-black leading-none tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #c9a84c, #e8d5a3, #c9a84c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
              OTC
            </h1>
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-[#c9a84c]/40" />
              <span className="text-white/50 text-sm uppercase tracking-[0.4em]">RoboAdvisor Pro</span>
              <div className="h-px w-16 bg-[#c9a84c]/40" />
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-white/50 text-lg md:text-xl max-w-2xl leading-relaxed mb-10 font-light">
            Estratègies d&apos;inversió personalitzades basades en teoria moderna de carteres.
            Precisió institucional. Accessibilitat digital.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 items-center mb-16">

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('roboadvisor')}
              className="relative px-10 py-4 bg-[#c9a84c] hover:bg-[#e8d5a3] transition-colors duration-300">
              <span className="text-[#0d1f1a] font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-3">
                RoboAdvisor Automàtic
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('admin')}
              className="px-10 py-4 border border-white/20 hover:border-[#c9a84c]/50 transition-all duration-300">
              <span className="text-white/60 hover:text-[#c9a84c] font-medium text-sm uppercase tracking-[0.2em] flex items-center gap-3 transition-colors duration-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Àrea Admin
              </span>
            </motion.button>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="w-full max-w-5xl px-4 mb-12">

            <p className="text-white/20 text-xs uppercase tracking-[0.3em] mb-6">Eines disponibles</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {TOOLS.map((tool, i) => (
                <motion.div key={tool.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
                  transition={{ delay: 1.2 + i * 0.08 }}
                  whileHover={{ y: -3, borderColor: 'rgba(201,168,76,0.4)' }}>
                  <Link href={tool.href}
                    className="block h-full bg-white/3 border border-white/10 rounded-xl p-4 hover:bg-white/5 transition-all duration-300 text-left">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1.5">{tool.title}</h3>
                    <p className="text-white/35 text-xs leading-relaxed">{tool.desc}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          className="relative z-20 px-8 pb-8">
          <div className="max-w-4xl mx-auto border-t border-white/10 pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '52+',   label: 'Fons analitzats',         sub: 'Base de dades validada'  },
                { value: '1.000', label: 'Simulacions Monte Carlo',  sub: 'Per escenari'            },
                { value: '4',     label: 'Perfils d\'inversor',      sub: 'Conservador → Agressiu'  },
                { value: '6',     label: 'Senyals actives',          sub: 'Accions en vigilància'   },
              ].map((stat, i) => (
                <div key={i} className="group">
                  <div className="text-2xl md:text-3xl font-black text-white mb-1 group-hover:text-[#c9a84c] transition-colors duration-300">
                    {stat.value}
                  </div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mb-0.5">{stat.label}</div>
                  <div className="text-white/25 text-xs">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="relative z-20 text-center pb-4 px-8">
          <p className="text-white/20 text-xs">
            Eina de suport a la decisió · No constitueix assessorament financer regulat ·
            No executa operacions reals · © {new Date().getFullYear()} Factor OTC
          </p>
        </motion.footer>
      </div>
    </div>
  );
}
