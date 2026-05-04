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
import ManualReportBuilder   from './ManualReportBuilder';

interface Props {
  onLogout: () => void;
}

interface Stats {
  total:  number;
  active: number;
  avgTER: number;
  byRisk: { risk: number; count: number }[];
}

type Section = 'dashboard' | 'funds' | 'reports' | 'news' | 'newsletter' | 'stocks' | 'portfolios' | 'manual-report' | 'config';

const NAV_ITEMS: { id: Section; iconPath: string; label: string }[] = [
  { id: 'dashboard',  iconPath: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z', label: 'Dashboard'         },
  { id: 'funds',      iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Gestió de Fons'    },
  { id: 'reports',    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Historial Informes' },
  { id: 'news',       iconPath: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM9 13h6M9 17h3', label: 'Notícies'          },
  { id: 'newsletter', iconPath: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', label: 'Newsletter'         },
  { id: 'stocks',     iconPath: 'M3 17l6-6 4 4 8-8',                                                                                                                                                                                                          label: 'Accions'           },
  { id: 'portfolios',    iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',                                                                                                                                              label: 'Carteres Model'    },
  { id: 'manual-report', iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',                                                                                              label: 'Informe Manual'    },
  { id: 'config',     iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Configuració'      },
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
                <div className="w-5 h-5 bg-[#c9a84c]/10 border border-[#c9a84c]/40 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-[#c9a84c] font-black text-xs leading-none">F</span>
                </div>
                <div>
                  <span className="text-white font-black text-sm">FACTOR</span>
                  <span className="text-[#c9a84c]/70 text-sm ml-1">OTC</span>
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
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.iconPath} />
              </svg>
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
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
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
            {activeSection === 'portfolios'    && <AdminPortfolios />}
            {activeSection === 'manual-report' && <ManualReportBuilder />}
            {activeSection === 'config'        && <AdminConfig />}

          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  );
}