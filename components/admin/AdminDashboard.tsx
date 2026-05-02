// components/admin/AdminDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FundsManager       from './FundsManager';
import ReportsHistory     from './ReportsHistory';
import AdminConfig        from './AdminConfig';
import AdminStats         from './AdminStats';
import NewsletterManager  from './NewsletterManager';
import NewsManager          from './NewsManager';
import StockTrackerManager  from './StockTrackerManager';
import AdminPortfolios       from './AdminPortfolios';

interface Props {
  onLogout: () => void;
}

interface Stats {
  total:  number;
  active: number;
  avgTER: number;
  byRisk: { risk: number; count: number }[];
}

type Section = 'dashboard' | 'funds' | 'reports' | 'news' | 'newsletter' | 'stocks' | 'portfolios' | 'config';

const NAV_ITEMS: { id: Section; icon: string; label: string }[] = [
  { id: 'dashboard',  icon: '📊', label: 'Dashboard'        },
  { id: 'funds',      icon: '💼', label: 'Gestió de Fons'   },
  { id: 'reports',    icon: '📄', label: 'Historial Informes'},
  { id: 'news',       icon: '📰', label: 'Notícies'         },
  { id: 'newsletter', icon: '📧', label: 'Newsletter'        },
  { id: 'stocks',      icon: '📈', label: 'Accions'          },
  { id: 'portfolios', icon: '🗂', label: 'Carteres Model'   },
  { id: 'config',     icon: '⚙️', label: 'Configuració'     },
];

export default function AdminDashboard({ onLogout }: Props) {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [stats, setStats]                 = useState<Stats | null>(null);
  const [collapsed, setCollapsed]         = useState(false);

  useEffect(() => {
    fetch('/api/admin/funds')
      .then(r => r.json())
      .then(data => setStats(data.stats))
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f0d] flex">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed left-0 top-0 h-full bg-[#0d1f1a] border-r border-white/10 flex flex-col z-20 overflow-hidden">

        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between min-h-[64px]">
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2">
                <div className="w-5 h-5 border border-[#c9a84c]/60 rotate-45 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-[#c9a84c]" />
                </div>
                <div>
                  <span className="text-white font-black text-sm">FACTOR</span>
                  <span className="text-[#c9a84c] text-sm ml-1">OTC</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            onClick={() => setCollapsed(!collapsed)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-white/30 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </motion.button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <motion.button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              title={collapsed ? item.label : undefined}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                activeSection === item.id
                  ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <span className="text-base flex-shrink-0">{item.icon}</span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {activeSection === item.id && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 w-0.5 h-6 bg-[#c9a84c] rounded-r"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <motion.button
            onClick={onLogout}
            whileHover={{ x: 2 }}
            title={collapsed ? 'Tancar sessió' : undefined}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <span className="flex-shrink-0">🚪</span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap">
                  Tancar sessió
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      {/* ── Contingut principal ───────────────────────────────────────────── */}
      <motion.main
        animate={{ marginLeft: collapsed ? 64 : 220 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 p-8 overflow-auto">

        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>

            {activeSection === 'dashboard' && (
              <AdminStats
                stats={stats}
                onNavigate={setActiveSection}
              />
            )}
            {activeSection === 'funds'      && <FundsManager />}
            {activeSection === 'reports'    && <ReportsHistory />}
            {activeSection === 'news'       && <NewsManager />}
            {activeSection === 'newsletter' && <NewsletterManager />}
            {activeSection === 'stocks'      && <StockTrackerManager />}
            {activeSection === 'portfolios' && <AdminPortfolios />}
            {activeSection === 'config'     && <AdminConfig />}

          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  );
}