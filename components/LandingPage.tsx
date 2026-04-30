'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView } from '@/app/page';
import ThreeBackground from './ThreeBackground';

interface Props {
  onNavigate: (view: AppView) => void;
}

export default function LandingPage({ onNavigate }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d1f1a]">

      {/* Fons Three.js */}
      <ThreeBackground />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1f1a]/40 via-transparent to-[#0d1f1a]/80 pointer-events-none z-10" />

      {/* Grid pattern */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Contingut principal */}
      <div className="relative z-20 min-h-screen flex flex-col">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : -20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex items-center justify-between px-8 py-6">

          {/* Logo FACTOR OTC */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#c9a84c]" />
            </div>
            <div>
              <span className="text-white font-black text-lg tracking-tight">FACTOR</span>
              <span className="text-[#c9a84c] font-light text-lg tracking-widest ml-1">OTC</span>
            </div>
          </div>

          {/* Nav dreta */}
          <nav className="hidden md:flex items-center gap-8">
            {['Metodologia', 'Resultats', 'Contacte'].map(item => (
              <button key={item}
                className="text-white/40 hover:text-[#c9a84c] text-xs uppercase tracking-widest transition-colors duration-300">
                {item}
              </button>
            ))}
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/40 text-xs uppercase tracking-widest">Sistema actiu</span>
            </div>
          </nav>
        </motion.header>

        {/* Hero central */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">

          {/* Badge superior */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: loaded ? 1 : 0, scale: loaded ? 1 : 0.9 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8 inline-flex items-center gap-3 border border-[#c9a84c]/30 rounded-full px-5 py-2 bg-[#c9a84c]/5 backdrop-blur-sm">
            <div className="w-1 h-1 rounded-full bg-[#c9a84c]" />
            <span className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] font-medium">
              Assessorament financer intel·ligent
            </span>
            <div className="w-1 h-1 rounded-full bg-[#c9a84c]" />
          </motion.div>

          {/* Títol principal */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 30 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mb-6">
            <h1 className="text-6xl md:text-8xl font-black text-white leading-none tracking-tight">
              FACTOR
            </h1>
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
              <span className="text-white/50 text-sm uppercase tracking-[0.4em]">RoboAdvisor</span>
              <div className="h-px w-16 bg-[#c9a84c]/40" />
            </div>
          </motion.div>

          {/* Subtítol */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="text-white/50 text-lg md:text-xl max-w-2xl leading-relaxed mb-16 font-light">
            Estratègies d'inversió personalitzades basades en teoria moderna de carteres.
            Precisió institucional. Accessibilitat digital.
          </motion.p>

          {/* Botons principals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-col sm:flex-row gap-4 items-center">

            {/* Botó principal */}
            <motion.button
              onHoverStart={() => setHoveredBtn('auto')}
              onHoverEnd={() => setHoveredBtn(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('roboadvisor')}
              className="relative group px-10 py-4 overflow-hidden">

              {/* Fons del botó */}
              <div className="absolute inset-0 bg-[#c9a84c] transition-all duration-300" />
              <motion.div
                className="absolute inset-0 bg-white"
                initial={{ x: '-100%' }}
                animate={{ x: hoveredBtn === 'auto' ? '0%' : '-100%' }}
                transition={{ duration: 0.3 }}
              />

              <span className="relative z-10 text-[#0d1f1a] font-bold text-sm uppercase tracking-[0.2em] flex items-center gap-3">
                <span>RoboAdvisor Automàtic</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </motion.button>

            {/* Botó secundari */}
            <motion.button
              onHoverStart={() => setHoveredBtn('admin')}
              onHoverEnd={() => setHoveredBtn(null)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate('admin')}
              className="relative group px-10 py-4 border border-white/20 hover:border-[#c9a84c]/50 transition-all duration-300">

              <span className="text-white/60 group-hover:text-[#c9a84c] font-medium text-sm uppercase tracking-[0.2em] flex items-center gap-3 transition-colors duration-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Cartera Manual (Admin)</span>
              </span>
            </motion.button>
          </motion.div>
        </div>

        {/* Stats inferiors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: loaded ? 1 : 0, y: loaded ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="relative z-20 px-8 pb-10">

          <div className="max-w-4xl mx-auto border-t border-white/10 pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '30+',    label: 'Fons analitzats',        sub: 'Base de dades validada' },
                { value: '1.000',  label: 'Simulacions Monte Carlo', sub: 'Per escenari' },
                { value: '4',      label: 'Perfils d\'inversor',     sub: 'Conservador → Agressiu' },
                { value: '100%',   label: 'Digital i gratuït',       sub: 'Eina de suport' },
              ].map((stat, i) => (
                <div key={i} className="group">
                  <div className="text-2xl md:text-3xl font-black text-white mb-1 group-hover:text-[#c9a84c] transition-colors duration-300">
                    {stat.value}
                  </div>
                  <div className="text-white/50 text-xs uppercase tracking-widest mb-0.5">
                    {stat.label}
                  </div>
                  <div className="text-white/25 text-xs">
                    {stat.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Footer disclaimer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 1.3 }}
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