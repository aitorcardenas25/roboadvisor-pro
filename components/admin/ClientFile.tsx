'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClientPortfolio } from '@/lib/clientPortfolios';
import type { Lead } from '@/lib/leads';
import type { ReportRecord } from '@/lib/reportRegistry';
import type { MonthlyReportRecord } from '@/lib/monthlyReports';
import type { AuditEntry } from '@/lib/auditLog';
import ClientImport from './ClientImport';
import ClientProposal from './ClientProposal';
import BudgetOverview from '@/components/finances/BudgetOverview';
import OneOffExpenses from '@/components/finances/OneOffExpenses';

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
}

type Tab = 'finances' | 'personal' | 'import' | 'proposal' | 'questionnaire' | 'portfolio' | 'transactions' | 'snapshots' | 'notes' | 'monthly' | 'audit';

const TABS: { id: Tab; label: string }[] = [
  { id: 'finances',      label: 'Pas 1 · Finances' },
  { id: 'personal',      label: 'Dades'         },
  { id: 'import',        label: 'Importar Excel' },
  { id: 'proposal',      label: 'Proposta'       },
  { id: 'questionnaire', label: 'Qüestionari'    },
  { id: 'portfolio',     label: 'Cartera activa' },
  { id: 'transactions',  label: 'Compres'        },
  { id: 'snapshots',     label: 'Snapshots'      },
  { id: 'notes',         label: 'Notes'          },
  { id: 'monthly',       label: 'Inf. Mensuals'  },
  { id: 'audit',         label: 'Historial'      },
];

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-lg">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
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
  const [tab, setTab]         = useState<Tab>('finances');

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
      <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-24">
      <p className="text-red-400 mb-4">{error || 'Client no trobat'}</p>
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm transition-colors">← Tornar</button>
    </div>
  );

  const { user, lead, portfolio } = data;

  const totalValue = portfolio?.holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0) ?? 0;
  const totalInvested = portfolio?.holdings.reduce((s, h) => s + h.avgEntryPrice * h.quantity, 0) ?? 0;
  const pnl = totalValue - totalInvested;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Clients
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-xl">{user.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              user.active ? 'bg-green-500/15 text-green-400' : 'bg-white/10 text-white/30'
            }`}>
              {user.active ? 'Actiu' : 'Inactiu'}
            </span>
            {lead?.status === 'converted' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a84c]/15 text-[#c9a84c]">Client</span>
            )}
          </div>
          <p className="text-white/40 text-sm">{user.email} · @{user.username}</p>
        </div>
        <button onClick={() => load()} className="text-white/30 hover:text-white text-xs transition-colors">↻</button>
      </div>

      {/* KPIs ràpids */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Cartera" value={portfolio ? `${totalValue.toFixed(0)} €` : '—'} sub={portfolio?.name} />
        <Kpi label="Rendiment" value={portfolio ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)} €` : '—'}
          sub={totalInvested > 0 ? `${((pnl/totalInvested)*100).toFixed(1)}%` : undefined} />
        <Kpi label="Informes inicials" value={String(data.reports.length)} />
        <Kpi label="Informes mensuals" value={String(data.monthly.length)} />
      </div>

      {/* Pestanyes */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-white/10 pb-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contingut per pestanya */}
      <div>
        {/* DADES PERSONALS */}
        {tab === 'personal' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
              <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Usuari d&apos;accés</h3>
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
                    <dt className="text-white/30 text-xs w-28 flex-shrink-0">{label}</dt>
                    <dd className="text-white/80 text-sm text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {lead && (
              <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
                <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Estat comercial (Lead)</h3>
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
                      <dt className="text-white/30 text-xs w-28 flex-shrink-0">{label}</dt>
                      <dd className="text-white/80 text-sm text-right">{val}</dd>
                    </div>
                  ))}
                </dl>
                {lead.notes && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Notes</p>
                    <p className="text-white/60 text-sm leading-relaxed">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PAS 1 · FINANCES */}
        {tab === 'finances' && (
          <div className="space-y-6">
            <OneOffExpenses endpoint={`/api/admin/clients/${clientId}/expenses`} data={lead?.questionnaireData ?? {}} audience="admin"
              onChange={() => load(true)} />
            <BudgetOverview data={lead?.questionnaireData} goalsTitle="Objectius del client" audience="admin" />
          </div>
        )}

        {/* IMPORTAR EXCEL */}
        {tab === 'import' && <ClientImport clientId={clientId} onImported={() => load(true)} />}
        {tab === 'proposal' && <ClientProposal clientId={clientId} />}

        {/* QÜESTIONARI */}
        {tab === 'questionnaire' && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            {lead?.questionnaireData ? (
              <>
                <h3 className="text-white/50 text-xs uppercase tracking-widest mb-4">Qüestionari de perfil</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(lead.questionnaireData).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-white/5">
                      <dt className="text-white/30 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                      <dd className="text-white/70 text-xs text-right">{typeof val === 'object' && val !== null ? `${Array.isArray(val) ? val.length : 1} element(s)` : String(val)}</dd>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">📋</div>
                <p>Encara no hi ha qüestionari guardat per a aquest client.</p>
              </div>
            )}
          </div>
        )}

        {/* CARTERA ACTIVA */}
        {tab === 'portfolio' && (
          <div>
            {portfolio ? (
              <>
                <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-semibold">{portfolio.name}</h3>
                      <p className="text-white/40 text-xs">{portfolio.description || 'Sense descripció'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#c9a84c] font-bold text-xl">{totalValue.toFixed(2)} €</p>
                      <p className={`text-sm font-medium ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} €
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {portfolio.holdings.length === 0 ? (
                      <p className="text-white/30 text-sm text-center py-4">Sense posicions encara.</p>
                    ) : portfolio.holdings.map(h => {
                      const val = h.currentPrice * h.quantity;
                      const w   = totalValue > 0 ? (val / totalValue) * 100 : 0;
                      return (
                        <div key={h.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-sm truncate">{h.assetName}</p>
                            <p className="text-white/30 text-xs">{h.assetIsin} · {h.broker}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-white/70 text-sm">{val.toFixed(2)} €</p>
                            <p className="text-white/30 text-xs">{w.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">📊</div>
                <p>Aquest client no té cap cartera activa.</p>
              </div>
            )}
          </div>
        )}

        {/* COMPRES / TRANSACCIONS */}
        {tab === 'transactions' && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl overflow-hidden">
            {!portfolio || portfolio.transactions.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">🧾</div>
                <p>Sense transaccions enregistrades.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Data', 'Tipus', 'Actiu', 'Quantitat', 'Preu', 'Total'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {portfolio.transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5 text-white/50 text-xs">{new Date(tx.date).toLocaleDateString('ca-ES')}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          tx.operationType === 'buy'    ? 'bg-green-500/15 text-green-400' :
                          tx.operationType === 'sell'   ? 'bg-red-500/15 text-red-400' :
                          'bg-white/10 text-white/50'
                        }`}>{tx.operationType}</span>
                      </td>
                      <td className="px-4 py-2.5 text-white/70 text-sm">{tx.assetName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-white/50 text-xs">{tx.quantity}</td>
                      <td className="px-4 py-2.5 text-white/50 text-xs">{tx.priceEur.toFixed(2)} €</td>
                      <td className="px-4 py-2.5 text-white/80 text-sm font-medium">{tx.totalEur.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SNAPSHOTS */}
        {tab === 'snapshots' && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            {!portfolio || portfolio.snapshots.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">📈</div>
                <p>Sense snapshots enregistrats.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...portfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date)).map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-white/5">
                    <span className="text-white/50 text-sm">{new Date(s.date).toLocaleDateString('ca-ES')}</span>
                    <span className="text-[#c9a84c] font-semibold">{s.totalValue.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          <div className="space-y-3">
            {!portfolio || portfolio.advisorNotes.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">📝</div>
                <p>Sense notes enregistrades.</p>
              </div>
            ) : portfolio.advisorNotes.map(n => (
              <div key={n.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/40 text-xs">{n.author} · {new Date(n.createdAt).toLocaleDateString('ca-ES')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    n.isVisibleToClient ? 'bg-blue-500/15 text-blue-400' : 'bg-white/10 text-white/30'
                  }`}>
                    {n.isVisibleToClient ? 'Visible al client' : 'Interna'}
                  </span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* INFORMES MENSUALS */}
        {tab === 'monthly' && (
          <div className="space-y-3">
            {data.monthly.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">📅</div>
                <p>Sense informes mensuals generats.</p>
              </div>
            ) : data.monthly.map(r => (
              <div key={r.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">
                      {new Date(r.periodStart).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-white/30 text-xs mt-0.5 font-mono">{r.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#c9a84c] font-semibold">{r.data.metrics.currentValue.toFixed(0)} €</p>
                    <p className={`text-xs ${r.data.metrics.pnlEur >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.data.metrics.pnlEur >= 0 ? '+' : ''}{r.data.metrics.pnlEur.toFixed(0)} €
                    </p>
                    {r.sentAt && (
                      <p className="text-white/25 text-xs mt-1">Enviat {new Date(r.sentAt).toLocaleDateString('ca-ES')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORIAL D'ACTIVITAT */}
        {tab === 'audit' && (
          <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
            {data.audit.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <div className="text-3xl mb-3">🕒</div>
                <p>Sense activitat enregistrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.audit.map(e => (
                  <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-white/5">
                    <span className="text-white/20 text-xs font-mono flex-shrink-0 mt-0.5">
                      {new Date(e.timestamp).toLocaleString('ca-ES')}
                    </span>
                    <span className="text-[#c9a84c]/70 text-xs font-mono">{e.action}</span>
                    {e.resource && <span className="text-white/30 text-xs truncate">{e.resource}</span>}
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
