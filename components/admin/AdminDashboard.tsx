// components/admin/AdminDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
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
import StockReportsManager      from './StockReportsManager';
import MonthlyReportGenerator   from './MonthlyReportGenerator';
import ClientFile                from './ClientFile';
import NotificationBell          from './NotificationBell';
import IntegrationsManager        from './IntegrationsManager';
import BetaPanel                  from './BetaPanel';
import FundNavsManager            from './FundNavsManager';
import TwoFactorSetup             from './TwoFactorSetup';
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
  | 'fons-preus' | 'fons-cataleg'
  | 'informes-mensual' | 'informes-historial'
  | 'beta-us' | 'beta-contactes'
  | 'sistema-connexions' | 'sistema-registre' | 'sistema-seguretat'
  | 'fora-noticies' | 'fora-newsletter' | 'fora-accions' | 'fora-informes-borsaris' | 'fora-carteres-model';

const SUBTABS: Partial<Record<Section, { id: SubTab; label: string }[]>> = {
  // El "Catàleg de fons" antic viu en memòria del servidor (no es desa) i no és
  // la llista que fan servir les propostes: només surt fora de la beta.
  fons:     [{ id: 'fons-preus',         label: 'Preus oficials' },
             ...(SHOW_NON_BETA_FEATURES ? [{ id: 'fons-cataleg' as SubTab, label: 'Catàleg antic (no es desa)' }] : [])],
  informes: [{ id: 'informes-mensual',   label: 'Informe mensual' },
             { id: 'informes-historial', label: 'Historial' }],
  beta:     [{ id: 'beta-us',            label: 'Ús i consentiments' },
             { id: 'beta-contactes',     label: 'Contactes' }],
  sistema:  [{ id: 'sistema-connexions', label: 'Connexions' },
             { id: 'sistema-registre',   label: "Registre d'activitat" },
             { id: 'sistema-seguretat',  label: 'Seguretat' }],
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
  clients:             ['clients'],
  'client-portfolios': ['clients'],
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

  const sidebarW = collapsed ? 'w-16' : 'w-[220px]';

  return (
    <div className="theme-admin min-h-screen flex text-sm">

      {/* ── Menú lateral ─────────────────────────────────────────────────── */}
      <aside className={`${sidebarW} fixed left-0 top-0 h-screen bg-subtle border-r border-line flex flex-col z-20 overflow-hidden`}>
        <div className="h-14 px-4 border-b border-line flex items-center justify-between">
          {!collapsed && (
            <span className="text-ink font-semibold tracking-tight">
              Factor <span className="text-ink-muted font-normal">OTC</span>
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Obrir el menú' : 'Plegar el menú'}
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-subtle-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
            </svg>
          </button>
        </div>

        {/* min-h-0 + overflow-y-auto: sense això el menú es talla quan no cap a la pantalla */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const on = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => openSection(item.id)}
                title={collapsed ? item.label : undefined}
                aria-current={on ? 'page' : undefined}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  on
                    ? 'bg-surface border-line text-ink font-medium shadow-sm'
                    : 'border-transparent text-ink-soft hover:text-ink hover:bg-subtle-strong'
                }`}>
                <svg className={`w-4 h-4 flex-shrink-0 ${on ? 'text-accent' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.iconPath} />
                </svg>
                {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-line">
          <button
            onClick={onLogout}
            title={collapsed ? 'Tancar sessió' : undefined}
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-ink-soft hover:text-negative hover:bg-negative/10 transition-colors">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span className="whitespace-nowrap">Tancar sessió</span>}
          </button>
        </div>
      </aside>

      {/* ── Contingut principal ───────────────────────────────────────────── */}
      <main className={`flex-1 min-w-0 ${collapsed ? 'ml-16' : 'ml-[220px]'}`}>
        <div className="h-14 flex justify-between items-center px-8 border-b border-line bg-surface">
          <h1 className="text-ink font-semibold">
            {NAV_ITEMS.find(i => i.id === activeSection)?.label}
          </h1>
          <NotificationBell />
        </div>

        <div className="p-8 max-w-[1400px]">
            {tabs && !(activeSection === 'clients' && selectedClientId) && (
              <div role="tablist" className="flex flex-wrap gap-1 mb-6 border-b border-line">
                {tabs.map(t => (
                  <button key={t.id} role="tab" aria-selected={activeSub === t.id}
                    onClick={() => setSubTabs(prev => ({ ...prev, [activeSection]: t.id }))}
                    className={`px-4 py-2 -mb-px text-sm border-b-2 transition-colors ${
                      activeSub === t.id
                        ? 'border-accent text-ink font-medium'
                        : 'border-transparent text-ink-soft hover:text-ink'
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
            {activeSection === 'clients' && !selectedClientId && <ClientsManager onViewClient={openClientFile} />}

            {activeSub === 'fons-preus'         && <FundNavsManager />}
            {activeSub === 'fons-cataleg'       && <FundsManager />}

            {activeSub === 'informes-mensual'   && <MonthlyReportGenerator />}
            {activeSub === 'informes-historial' && <ReportsHistory />}

            {activeSub === 'beta-us'            && <BetaPanel />}
            {activeSub === 'beta-contactes'     && <LeadsManager />}

            {activeSub === 'sistema-connexions' && <IntegrationsManager />}
            {activeSub === 'sistema-registre'   && <AuditLogViewer />}
            {activeSub === 'sistema-seguretat'  && <TwoFactorSetup />}

            {SHOW_NON_BETA_FEATURES && activeSection === 'fora-beta' && (<>
              {activeSub === 'fora-noticies'          && <NewsManager />}
              {activeSub === 'fora-newsletter'        && <NewsletterManager />}
              {activeSub === 'fora-accions'           && <StockTrackerManager />}
              {activeSub === 'fora-informes-borsaris' && <StockReportsManager />}
              {activeSub === 'fora-carteres-model'    && <AdminPortfolios />}
            </>)}

        </div>
      </main>
    </div>
  );
}