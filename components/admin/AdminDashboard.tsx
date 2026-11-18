// components/admin/AdminDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FundsManager       from './FundsManager';
import ReportsHistory     from './ReportsHistory';
import AdminStats         from './AdminStats';
import NewsletterManager  from './NewsletterManager';
import NewsManager          from './NewsManager';
import StockTrackerManager  from './StockTrackerManager';
import AdminPortfolios       from './AdminPortfolios';
import ClientsManager           from './ClientsManager';
import AuditLogViewer           from './AuditLogViewer';
import LeadsManager             from './LeadsManager';
import ClientPortfoliosManager  from './ClientPortfoliosManager';
import StockReportsManager      from './StockReportsManager';
import MonthlyReportGenerator   from './MonthlyReportGenerator';
import ClientFile                from './ClientFile';
import NotificationBell          from './NotificationBell';
import IntegrationsManager        from './IntegrationsManager';
import BetaPanel                  from './BetaPanel';
import FundNavsManager            from './FundNavsManager';
import { SHOW_NON_BETA_FEATURES } from '@/lib/featureFlags';

interface Props {
  onLogout: () => void;
}

interface Stats {
  total:  number;
  active: number;
  avgTER: number;
  byRisk: { risk: number; count: number }[];
}

// Menú de la beta (decisió 2026-11-18): 6 seccions. Cada secció pot tenir
// subpestanyes. "Fora de la beta" només surt amb NEXT_PUBLIC_SHOW_NON_BETA_FEATURES=true.
type Section = 'avui' | 'clients' | 'fons' | 'informes' | 'beta' | 'sistema' | 'fora-beta';

type SubTab =
  | 'clients-llista' | 'clients-carteres'
  | 'fons-preus' | 'fons-cataleg'
  | 'informes-mensual' | 'informes-historial'
  | 'beta-us' | 'beta-contactes'
  | 'sistema-connexions' | 'sistema-registre'
  | 'fora-noticies' | 'fora-newsletter' | 'fora-accions' | 'fora-informes-borsaris' | 'fora-carteres-model';

const SUBTABS: Partial<Record<Section, { id: SubTab; label: string }[]>> = {
  clients:  [{ id: 'clients-llista',     label: 'Clients' },
             { id: 'clients-carteres',   label: 'Carteres actives' }],
  fons:     [{ id: 'fons-preus',         label: 'Preus oficials' },
             { id: 'fons-cataleg',       label: 'Catàleg de fons' }],
  informes: [{ id: 'informes-mensual',   label: 'Informe mensual' },
             { id: 'informes-historial', label: 'Historial' }],
  beta:     [{ id: 'beta-us',            label: 'Ús i consentiments' },
             { id: 'beta-contactes',     label: 'Contactes' }],
  sistema:  [{ id: 'sistema-connexions', label: 'Connexions' },
             { id: 'sistema-registre',   label: "Registre d'activitat" }],
  'fora-beta': [{ id: 'fora-noticies',          label: 'Notícies' },
                { id: 'fora-newsletter',        label: 'Newsletter' },
                { id: 'fora-accions',           label: 'Accions' },
                { id: 'fora-informes-borsaris', label: 'Informes borsaris' },
                { id: 'fora-carteres-model',    label: 'Carteres model' }],
};

const NAV_ITEMS: { id: Section; iconPath: string; label: string }[] = [
  { id: 'avui',     iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Avui' },
  { id: 'clients',  iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Clients' },
  { id: 'fons',     iconPath: 'M3 3v18h18M7 14l4-4 3 3 5-6', label: 'Fons' },
  { id: 'informes', iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', label: 'Informes' },
  { id: 'beta',     iconPath: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z', label: 'Beta' },
  { id: 'sistema',  iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Sistema' },
  ...(SHOW_NON_BETA_FEATURES
    ? [{ id: 'fora-beta' as Section, iconPath: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', label: 'Fora de la beta' }]
    : []),
];

/**
 * Traducció dels identificadors antics (els fa servir el Dashboard per als
 * enllaços d'alertes) a la secció i subpestanya noves.
 */
const LEGACY_TARGETS: Record<string, [Section, SubTab?]> = {
  dashboard:           ['avui'],
  clients:             ['clients', 'clients-llista'],
  'client-portfolios': ['clients', 'clients-carteres'],
  funds:               ['fons', 'fons-cataleg'],
  'fund-navs':         ['fons', 'fons-preus'],
  'monthly-report':    ['informes', 'informes-mensual'],
  reports:             ['informes', 'informes-historial'],
  beta:                ['beta', 'beta-us'],
  leads:               ['beta', 'beta-contactes'],
  integrations:        ['sistema', 'sistema-connexions'],
  audit:               ['sistema', 'sistema-registre'],
  news:                ['fora-beta', 'fora-noticies'],
  newsletter:          ['fora-beta', 'fora-newsletter'],
  stocks:              ['fora-beta', 'fora-accions'],
  'stock-reports':     ['fora-beta', 'fora-informes-borsaris'],
  portfolios:          ['fora-beta', 'fora-carteres-model'],
};

export default function AdminDashboard({ onLogout }: Props) {
  const [activeSection, setActiveSection]   = useState<Section>('avui');
  const [subTabs, setSubTabs]               = useState<Partial<Record<Section, SubTab>>>({});
  const [stats, setStats]                   = useState<Stats | null>(null);
  const [collapsed, setCollapsed]           = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  function openClientFile(id: string) {
    setSelectedClientId(id);
    setActiveSection('clients');
    setSubTabs(t => ({ ...t, clients: 'clients-llista' }));
  }

  function openSection(id: Section) {
    setActiveSection(id);
    if (id === 'clients') setSelectedClientId(null);
  }

  /** Enllaços del Dashboard (alertes, accions ràpides) amb els noms antics. */
  function navigateLegacy(legacy: string) {
    const target = LEGACY_TARGETS[legacy];
    if (!target) return;
    const [section, sub] = target;
    if (section === 'fora-beta' && !SHOW_NON_BETA_FEATURES) return;
    openSection(section);
    if (sub) setSubTabs(t => ({ ...t, [section]: sub }));
  }

  const tabs      = SUBTABS[activeSection];
  const activeSub = subTabs[activeSection] ?? tabs?.[0]?.id;

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
        className="fixed left-0 top-0 h-screen bg-[#0d1f1a] border-r border-white/10 flex flex-col z-20 overflow-hidden">

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
        {/* min-h-0 + overflow-y-auto: sense això el menú es talla quan no cap a la pantalla */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <motion.button
              key={item.id}
              onClick={() => openSection(item.id)}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              title={collapsed ? item.label : undefined}
              className={`relative w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
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
        className="flex-1 overflow-auto">

        {/* Top bar amb notificacions */}
        <div className="flex justify-end items-center px-8 py-3 border-b border-white/5">
          <NotificationBell />
        </div>

        <div className="p-8">

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeSection}-${activeSub ?? ''}-${selectedClientId ?? ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>

            {tabs && !(activeSection === 'clients' && selectedClientId) && (
              <div role="tablist" className="flex flex-wrap gap-1 mb-6 border-b border-white/10">
                {tabs.map(t => (
                  <button key={t.id} role="tab" aria-selected={activeSub === t.id}
                    onClick={() => setSubTabs(prev => ({ ...prev, [activeSection]: t.id }))}
                    className={`px-4 py-2 -mb-px text-sm border-b-2 transition-colors ${
                      activeSub === t.id
                        ? 'border-[#c9a84c] text-white font-medium'
                        : 'border-transparent text-white/60 hover:text-white'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {activeSection === 'avui' && (
              <AdminStats stats={stats} onNavigate={navigateLegacy} />
            )}

            {activeSection === 'clients' && selectedClientId && (
              <ClientFile clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />
            )}
            {activeSub === 'clients-llista'     && !selectedClientId && <ClientsManager onViewClient={openClientFile} />}
            {activeSub === 'clients-carteres'   && <ClientPortfoliosManager />}

            {activeSub === 'fons-preus'         && <FundNavsManager />}
            {activeSub === 'fons-cataleg'       && <FundsManager />}

            {activeSub === 'informes-mensual'   && <MonthlyReportGenerator />}
            {activeSub === 'informes-historial' && <ReportsHistory />}

            {activeSub === 'beta-us'            && <BetaPanel />}
            {activeSub === 'beta-contactes'     && <LeadsManager />}

            {activeSub === 'sistema-connexions' && <IntegrationsManager />}
            {activeSub === 'sistema-registre'   && <AuditLogViewer />}

            {SHOW_NON_BETA_FEATURES && activeSection === 'fora-beta' && (<>
              {activeSub === 'fora-noticies'          && <NewsManager />}
              {activeSub === 'fora-newsletter'        && <NewsletterManager />}
              {activeSub === 'fora-accions'           && <StockTrackerManager />}
              {activeSub === 'fora-informes-borsaris' && <StockReportsManager />}
              {activeSub === 'fora-carteres-model'    && <AdminPortfolios />}
            </>)}

          </motion.div>
        </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}