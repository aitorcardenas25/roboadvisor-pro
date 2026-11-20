'use client';

import { useState, useEffect, useCallback } from 'react';
import PortfolioExcelButton from '@/components/PortfolioExcelButton';
import PortfolioDrift from './PortfolioDrift';
import TaxReportView from '@/components/TaxReportView';
import { computeMetrics, type ClientPortfolio } from '@/lib/clientPortfolios';
import type { Lead } from '@/lib/leads';
import type { ReportRecord } from '@/lib/reportRegistry';
import type { MonthlyReportRecord } from '@/lib/monthlyReports';
import type { AuditEntry } from '@/lib/auditLog';
import ClientImport from './ClientImport';
import ClientProposal from './ClientProposal';
import { PortfolioEditor, NotesTab } from './PortfolioEditor';
import BudgetOverview from '@/components/finances/BudgetOverview';
import OneOffExpenses from '@/components/finances/OneOffExpenses';
import WealthView from '@/components/wealth/WealthView';
import type { AdvisorStage } from '@/lib/onboarding';
import { StageBar, PreviewButton, ManualFinances, InternalNotes } from './ClientFileExtras';

// r.date es desa com a text "dd/mm/aaaa" i new Date() el llegeix com a Invalid Date
const PROFILE_NAMES: Record<string, string> = { conservador: 'conservador', moderat: 'moderat', dinamic: 'dinàmic', agressiu: 'agressiu' };

interface ClientUser {
  id: string; name: string; email: string; username: string;
  role: string; active: boolean; createdAt: string;
  subscriptionPlan?: string; subscriptionStatus?: string;
}

interface ClientFileData {
  user:      ClientUser;
  lead:      Lead | null;
  portfolio: ClientPortfolio | null;
  reports:   ReportRecord[];
  monthly:   MonthlyReportRecord[];
  audit:     AuditEntry[];
  stage?:    AdvisorStage;
}

// Fitxa de client (beta 2026-11-18): 5 pestanyes en l'ordre real de la feina.
type Tab = 'dades' | 'proposal' | 'portfolio' | 'reports' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dades',     label: '1. Dades'    },
  { id: 'proposal',  label: '2. Proposta' },
  { id: 'portfolio', label: '3. Cartera'  },
  { id: 'reports',   label: '4. Informes' },
  { id: 'notes',     label: 'Notes'       },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-ink font-semibold text-sm mb-3">{children}</h3>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-12 text-ink-soft text-sm">{children}</div>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-subtle rounded-lg p-4">
      <p className="text-ink-muted text-xs mb-1">{label}</p>
      <p className="text-ink font-bold text-lg">{value}</p>
      {sub && <p className="text-ink-muted text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ClientFile({
  clientId,
  onBack,
}: {
  clientId: string;
  onBack: () => void;
}) {
  const [data, setData]       = useState<ClientFileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<Tab>('dades');
  const [showHistory, setShowHistory] = useState(false);

  // silent = refresc en segon pla (no desmunta la pestanya activa)
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/full`);
      if (!res.ok) { setError('No s\'ha pogut carregar el client'); return; }
      setData(await res.json());
    } catch { setError('Error de connexió'); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-24">
      <p className="text-negative mb-4">{error || 'Client no trobat'}</p>
      <button onClick={onBack} className="text-ink-muted hover:text-ink text-sm transition-colors">← Tornar</button>
    </div>
  );

  const { user, lead, portfolio } = data;

  // Rendiment total (inclou el guany de les vendes): valor actual − aportacions netes.
  const metrics = portfolio ? computeMetrics(portfolio) : null;
  const totalValue = metrics?.currentValue ?? 0;
  const totalInvested = metrics?.totalInvested ?? 0;
  const pnl = metrics?.pnlEur ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="text-ink-muted hover:text-ink transition-colors flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Clients
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-ink font-bold text-xl">{user.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              user.active ? 'bg-positive/15 text-positive' : 'bg-subtle-strong text-ink-muted'
            }`}>
              {user.active ? 'Actiu' : 'Inactiu'}
            </span>
            {lead?.status === 'converted' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent">Client</span>
            )}
          </div>
          <p className="text-ink-muted text-sm">{user.email} · @{user.username}</p>
        </div>
        {user.role === 'client' && <PreviewButton clientId={clientId} />}
        <button onClick={() => load()} title="Tornar a carregar" className="text-ink-muted hover:text-ink text-xs transition-colors">↻</button>
      </div>

      {data.stage && <StageBar stage={data.stage} onGo={setTab} />}

      {/* KPIs ràpids */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Cartera" value={portfolio ? `${Math.round(totalValue).toLocaleString('ca-ES')} €` : '—'} sub={portfolio?.name} />
        <Kpi label="Rendiment" value={portfolio ? `${pnl >= 0 ? '+' : ''}${Math.round(pnl).toLocaleString('ca-ES')} €` : '—'}
          sub={totalInvested > 0 ? `${((pnl/totalInvested)*100).toLocaleString('ca-ES', { maximumFractionDigits: 1 })} % sobre ${Math.round(totalInvested).toLocaleString('ca-ES')} € aportats` : undefined} />
        <Kpi label="Informes inicials" value={String(data.reports.length)} />
        <Kpi label="Informes mensuals" value={String(data.monthly.length)} />
      </div>

      {/* Pestanyes */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-line pb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-accent-soft text-accent border border-accent/30'
                : 'text-ink-muted hover:text-ink hover:bg-subtle'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contingut per pestanya */}
      <div>
        {/* 1. DADES: Excel → finances → dades d'accés → qüestionari */}
        {tab === 'dades' && (
          <div className="space-y-8">
            <section>
              <SectionTitle>Excel del client</SectionTitle>
              <ClientImport clientId={clientId} onImported={() => load(true)} />
            </section>
            <section>
              <SectionTitle>Patrimoni consolidat</SectionTitle>
              <WealthView endpoint={`/api/admin/clients/${clientId}/wealth`} audience="admin" />
            </section>
            <section className="space-y-6">
              <SectionTitle>Finances</SectionTitle>
              <ManualFinances clientId={clientId} data={lead?.questionnaireData ?? {}} onSaved={() => load(true)} />
              <OneOffExpenses endpoint={`/api/admin/clients/${clientId}/expenses`} data={lead?.questionnaireData ?? {}} audience="admin"
                onChange={() => load(true)} />
              <BudgetOverview data={lead?.questionnaireData} goalsTitle="Objectius del client" audience="admin" />
            </section>
            <section>
              <SectionTitle>Dades d&apos;accés</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface border border-line rounded-lg p-5">
              <h3 className="text-ink-soft text-xs font-medium mb-4">Usuari d&apos;accés</h3>
              <dl className="space-y-2.5">
                {[
                  ['Nom complet', user.name],
                  ['Email', user.email],
                  ['Usuari', `@${user.username}`],
                  ['Rol', user.role],
                  ['Pla', user.subscriptionPlan ?? '—'],
                  ['Estat subscripció', user.subscriptionStatus ?? '—'],
                  ['Alta', new Date(user.createdAt).toLocaleDateString('ca-ES')],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="text-ink-muted text-xs w-28 flex-shrink-0">{label}</dt>
                    <dd className="text-ink text-sm text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {lead && (
              <div className="bg-surface border border-line rounded-lg p-5">
                <h3 className="text-ink-soft text-xs font-medium mb-4">Estat comercial (Lead)</h3>
                <dl className="space-y-2.5">
                  {[
                    ['ID Lead', lead.id],
                    ['Origen', lead.source],
                    ['Estat', lead.status],
                    ['Perfil', lead.profile ?? '—'],
                    ['Interès', lead.interest],
                    ['Telèfon', lead.phone ?? '—'],
                    ['Data lead', new Date(lead.createdAt).toLocaleDateString('ca-ES')],
                  ].map(([label, val]) => (
                    <div key={label} className="flex items-start justify-between gap-4">
                      <dt className="text-ink-muted text-xs w-28 flex-shrink-0">{label}</dt>
                      <dd className="text-ink text-sm text-right">{val}</dd>
                    </div>
                  ))}
                </dl>
                {lead.notes && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <p className="text-ink-muted text-xs font-medium mb-2">Notes</p>
                    <p className="text-ink-soft text-sm leading-relaxed">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
            </section>
            <section>
              <SectionTitle>Qüestionari de perfil</SectionTitle>
          <div className="bg-surface border border-line rounded-lg p-5">
            {lead?.questionnaireData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(lead.questionnaireData).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-line">
                      <dt className="text-ink-muted text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                      <dd className="text-ink-soft text-xs text-right">{typeof val === 'object' && val !== null ? `${Array.isArray(val) ? val.length : 1} element(s)` : String(val)}</dd>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-ink-muted">
                <p>Encara no hi ha qüestionari guardat per a aquest client.</p>
              </div>
            )}
          </div>
            </section>
          </div>
        )}

        {/* 2. PROPOSTA */}
        {tab === 'proposal' && <ClientProposal clientId={clientId} onApplied={() => load(true)} />}

        {/* 3. CARTERA: únic lloc on s'edita la cartera activa */}
        {tab === 'portfolio' && (
          portfolio ? (
            <div className="space-y-4">
              <PortfolioExcelButton baseUrl={`/api/admin/clients/${clientId}/portfolio-excel`} className="justify-end" />
              <PortfolioDrift clientId={clientId} />
              <PortfolioEditor key={portfolio.id} portfolio={portfolio} onChange={() => load(true)} />
            </div>
          ) : (
            <Empty>
              <p className="mb-3">Aquest client encara no té cartera activa.</p>
              <button onClick={() => setTab('proposal')} className="text-accent hover:underline">
                Crea-la des de la Proposta →
              </button>
            </Empty>
          )
        )}

        {/* 4. INFORMES */}
        {tab === 'reports' && (
          <div className="space-y-8">
            <section>
              <SectionTitle>Informes mensuals</SectionTitle>
          <div className="space-y-3">
            {data.monthly.length === 0 ? (
              <div className="text-center py-12 text-ink-muted">
                <p>Sense informes mensuals generats.</p>
              </div>
            ) : data.monthly.map(r => (
              <div key={r.id} className="bg-surface border border-line rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-ink text-sm font-medium">
                      {new Date(r.periodStart).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-ink-muted text-xs mt-0.5 font-mono">{r.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-accent font-semibold">{r.data.metrics.currentValue.toFixed(0)} €</p>
                    <p className={`text-xs ${r.data.metrics.pnlEur >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {r.data.metrics.pnlEur >= 0 ? '+' : ''}{r.data.metrics.pnlEur.toFixed(0)} €
                    </p>
                    {r.sentAt && (
                      <p className="text-ink-muted text-xs mt-1">Enviat {new Date(r.sentAt).toLocaleDateString('ca-ES')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
            </section>
            <section>
              <SectionTitle>Informes inicials</SectionTitle>
              {data.reports.length === 0 ? (
                <Empty>Sense informes inicials.</Empty>
              ) : (
                <div className="space-y-2">
                  {data.reports.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-surface border border-line rounded-lg px-4 py-3">
                      <div>
                        <p className="text-ink text-sm">{new Date(r.createdAt).toLocaleDateString('ca-ES')} · Perfil {PROFILE_NAMES[r.profile] ?? r.profile}</p>
                        <p className="text-ink-soft text-xs font-mono">{r.id}</p>
                      </div>
                      <p className="text-ink-soft text-xs">{r.emailSent ? 'Enviat' : 'No enviat'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {portfolio && (
              <section>
                <SectionTitle>Informe fiscal (només el veus tu, pendent de revisió experta)</SectionTitle>
                <TaxReportView url={`/api/admin/clients/${clientId}/tax-report`} />
              </section>
            )}
          </div>
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          <div className="space-y-6">
            <InternalNotes key={lead?.id ?? 'nou'} clientId={clientId} initial={lead?.notes ?? ''} />
            {portfolio
              ? <NotesTab portfolio={portfolio} reload={() => load(true)} />
              : <p className="text-ink-muted text-xs">Les notes que pot veure el client (a la seva cartera) apareixeran quan tingui cartera activa.</p>}
          </div>
        )}
      </div>

      {/* Historial d'activitat: consulta puntual, no és una pestanya de treball */}
      <div className="mt-10 pt-4 border-t border-line">
        <button onClick={() => setShowHistory(v => !v)} className="text-ink-soft hover:text-ink text-xs">
          {showHistory ? 'Amagar' : 'Veure'} l&apos;historial d&apos;activitat del client ({data.audit.length})
        </button>
        {showHistory && (
          <div className="mt-4 bg-surface border border-line rounded-lg p-5">
            {data.audit.length === 0 ? (
              <p className="text-ink-soft text-sm">Sense activitat enregistrada.</p>
            ) : (
              <div className="space-y-2">
                {data.audit.map(e => (
                  <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-line">
                    <span className="text-ink-soft text-xs font-mono flex-shrink-0 mt-0.5">
                      {new Date(e.timestamp).toLocaleString('ca-ES')}
                    </span>
                    <span className="text-accent/80 text-xs font-mono">{e.action}</span>
                    {e.resource && <span className="text-ink-soft text-xs truncate">{e.resource}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
