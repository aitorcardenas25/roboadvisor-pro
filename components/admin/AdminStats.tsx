// components/admin/AdminStats.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { isSoldOut, type ClientPortfolio } from '@/lib/clientPortfolios';
import type { PortfolioAlert } from '@/lib/portfolioAlertsServer';
import type { DashboardStats } from '@/lib/dashboardStats';

interface Stats {
  total:  number;
  active: number;
  avgTER: number;
  byRisk: { risk: number; count: number }[];
}

type Section = 'dashboard' | 'funds' | 'reports' | 'news' | 'newsletter' | 'stocks' | 'portfolios' | 'config' | 'clients' | 'client-portfolios' | 'leads' | 'stock-reports' | 'monthly-report' | 'audit' | 'manual-report' | 'integrations';

interface Props {
  stats:      Stats | null;
  onNavigate: (section: string) => void;
}

interface Alert {
  type:    'warning' | 'info' | 'error';
  title:   string;
  desc:    string;
  action?: string;
  section?: Section;
}


const PROFILE_COLORS: Record<string, string> = {
  conservador: '#7fb8a0', moderat: '#1e5a47', dinamic: '#c08a2d', agressiu: '#b4281f',
};

// Accions ràpides del flux de la beta (sense emojis ni seccions amagades).
const QUICK_ACTIONS: { label: string; sub: string; section: Section | 'fund-navs' | 'beta' | null }[] = [
  { label: 'Clients',          sub: 'Fitxes, Excel i propostes',      section: 'clients'        },
  { label: 'Preus oficials',   sub: 'Pujar valors liquidatius',       section: 'fund-navs'      },
  { label: 'Informe mensual',  sub: 'Generar i enviar',               section: 'monthly-report' },
  { label: 'Beta',             sub: 'Ús i consentiments',             section: 'beta'           },
]

const ALERT_STYLES = {
  warning: { border: 'border-warning/25', bg: 'bg-warning/6',  dot: 'bg-warning', text: 'text-warning', icon: '⚠' },
  error:   { border: 'border-negative/25',   bg: 'bg-negative/6',    dot: 'bg-negative',   text: 'text-negative',   icon: '!' },
  info:    { border: 'border-info/20',  bg: 'bg-info/5',   dot: 'bg-info',  text: 'text-info',  icon: 'i' },
};

export default function AdminStats({ onNavigate }: Props) {
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [portfolioCount, setPortfolioCount] = useState<number | null>(null);
  const [clientCount, setClientCount]       = useState<number | null>(null);
  const [dash, setDash]                     = useState<(DashboardStats & { email?: 'gmail' | 'resend' | null }) | null>(null);
  const [dashError, setDashError]           = useState(false);
  const [fundsReady, setFundsReady]         = useState<{ ready: number; total: number } | null>(null);

  // Fons reals de les propostes: els que tenen preus oficials suficients (Fons → Preus oficials).
  useEffect(() => {
    fetch('/api/admin/fund-navs')
      .then(r => r.ok ? r.json() as Promise<{ funds: { metrics: { usable: boolean } }[] }> : Promise.reject(new Error(String(r.status))))
      .then(d => setFundsReady({ ready: d.funds.filter(f => f.metrics?.usable).length, total: d.funds.length }))
      .catch(() => setFundsReady(null));
  }, []);

  useEffect(() => {
    fetch('/api/admin/dashboard-stats')
      .then(r => r.ok ? r.json() as Promise<DashboardStats & { email?: 'gmail' | 'resend' | null }> : Promise.reject(new Error(String(r.status))))
      .then(setDash)
      .catch(() => setDashError(true));
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [portfoliosRes, clientsRes, driftRes] = await Promise.all([
          fetch('/api/admin/client-portfolios'),
          fetch('/api/admin/clients'),
          fetch('/api/admin/portfolio-alerts'),
        ]);
        const monthlyRes = await fetch('/api/admin/monthly-reports').catch(() => null);

        const newAlerts: Alert[] = [];

        if (portfoliosRes.ok) {
          const { portfolios } = await portfoliosRes.json() as { portfolios: ClientPortfolio[] };
          setPortfolioCount(portfolios.length);

          // Portfolios with pending holdings (no price set)
          const pendingPricePfs = portfolios.filter(p =>
            p.holdings.some(h => !isSoldOut(h, p.transactions) && (h.priceSource === 'pending' || (h.currentPrice === 0 && h.quantity === 0)))
          );
          if (pendingPricePfs.length > 0) {
            newAlerts.push({
              type: 'warning',
              title: `${pendingPricePfs.length} cartera${pendingPricePfs.length > 1 ? 'es' : ''} amb actius sense preu`,
              desc: `Carteres amb posicions pendents de confirmar: ${pendingPricePfs.map(p => p.clientName).join(', ')}.`,
              action: 'Gestionar carteres',
              section: 'client-portfolios',
            });
          }

          // Portfolios needing follow-up (nextFollowup <= today or not set, with active holdings)
          const today = new Date().toISOString().split('T')[0];
          const needsFollowup = portfolios.filter(p => {
            const hasActiveHoldings = p.holdings.some(h => h.quantity > 0);
            if (!hasActiveHoldings) return false;
            if (!p.nextFollowup) return true;
            return p.nextFollowup <= today;
          });
          if (needsFollowup.length > 0) {
            newAlerts.push({
              type: needsFollowup.length > 2 ? 'error' : 'warning',
              title: `${needsFollowup.length} client${needsFollowup.length > 1 ? 's' : ''} pendent${needsFollowup.length > 1 ? 's' : ''} de seguiment`,
              desc: needsFollowup.map(p => `${p.clientName}${p.nextFollowup ? ` (${p.nextFollowup})` : ' (sense data)'}`).join(' · '),
              action: 'Veure carteres',
              section: 'client-portfolios',
            });
          }

          // Portfolios with no holdings at all
          const emptyPfs = portfolios.filter(p => p.holdings.length === 0);
          if (emptyPfs.length > 0) {
            newAlerts.push({
              type: 'info',
              title: `${emptyPfs.length} cartera${emptyPfs.length > 1 ? 'es' : ''} sense actius`,
              desc: `Carteres creades però sense cap posició: ${emptyPfs.map(p => p.clientName).join(', ')}.`,
              action: 'Completar carteres',
              section: 'client-portfolios',
            });
          }
        }

        if (driftRes.ok) {
          const { alerts: pa, threshold } = await driftRes.json() as { alerts: PortfolioAlert[]; threshold: number };
          // Carteres que s'han allunyat dels pesos de la proposta aprovada
          const drifted = pa.filter(a => a.drift && a.drift.outOfBand.length > 0);
          if (drifted.length > 0) {
            newAlerts.push({
              type: 'warning',
              title: `${drifted.length} cartera${drifted.length > 1 ? 'es' : ''} desviada${drifted.length > 1 ? 'es' : ''} dels pesos objectiu`,
              desc: drifted.map(a => {
                const top = a.drift!.outOfBand[0];
                return `${a.clientName}: ${top.name} ${top.diff > 0 ? '+' : ''}${top.diff.toLocaleString('ca-ES')} pp`;
              }).join(' · ') + ` (llindar ±${threshold} pp respecte de la proposta)`,
              action: 'Veure clients',
              section: 'clients',
            });
          }
          // Revisió anual de la idoneïtat
          const annual = pa.filter(a => a.review.reasons.includes('annual_review'));
          if (annual.length > 0) {
            newAlerts.push({
              type: 'warning',
              title: `${annual.length} client${annual.length > 1 ? 's' : ''} amb la revisió anual pendent`,
              desc: `La proposta aprovada té més d'un any: ${annual.map(a => a.clientName).join(', ')}.`,
              action: 'Veure clients',
              section: 'clients',
            });
          }
        }

        if (clientsRes.ok) {
          const { users } = await clientsRes.json() as { users: { role: string; name: string; stage?: string }[] };
          const clients = users.filter(u => u.role === 'client');
          setClientCount(clients.length);
          // Coses que només pot fer l'assessor perquè el client avanci
          const unsent = clients.filter(u => u.stage === 'aprovat');
          if (unsent.length > 0) newAlerts.unshift({
            type: 'error',
            title: `${unsent.length} informe${unsent.length > 1 ? 's' : ''} inicial${unsent.length > 1 ? 's' : ''} aprovat${unsent.length > 1 ? 's' : ''} sense enviar`,
            desc: `El client encara no el veu ni té accés al portal: ${unsent.map(u => u.name).join(', ')}. Obre la fitxa → Proposta → "Enviar al client".`,
            action: 'Veure clients', section: 'clients',
          });
          const toPrepare = clients.filter(u => u.stage === 'dades' || u.stage === 'esborrany');
          if (toPrepare.length > 0) newAlerts.push({
            type: 'info',
            title: `${toPrepare.length} client${toPrepare.length > 1 ? 's' : ''} esperant la proposta`,
            desc: `Ja tenen les dades i els falta l'informe inicial: ${toPrepare.map(u => u.name).join(', ')}.`,
            action: 'Veure clients', section: 'clients',
          });
        }

        if (monthlyRes?.ok) {
          const { reports } = await monthlyRes.json() as { reports: { clientName: string; sentAt?: string; periodStart: string }[] };
          const pending = reports.filter(r => !r.sentAt);
          if (pending.length > 0) newAlerts.push({
            type: 'warning',
            title: `${pending.length} informe${pending.length > 1 ? 's' : ''} mensual${pending.length > 1 ? 's' : ''} sense enviar`,
            desc: pending.slice(0, 6).map(r => `${r.clientName} (${new Date(r.periodStart).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })})`).join(' · '),
            action: 'Informes mensuals', section: 'monthly-report',
          });
        }

        setAlerts(newAlerts);
      } catch {
        // Silent fail - alerts are non-critical
      } finally {
        setAlertsLoading(false);
      }
    };

    load();
  }, []);

  // Sense correu configurat, els clients no reben cap avís (ni benvinguda ni informes)
  const shownAlerts: Alert[] = [
    ...(dash && dash.email === null ? [{
      type: 'error' as const,
      title: 'Els correus no s\'envien',
      desc: 'Falta configurar el correu a Vercel (GMAIL_USER i GMAIL_APP_PASSWORD). Els informes es veuen al portal, però el client no rep cap avís.',
      action: 'Veure connexions', section: 'integrations' as const,
    }] : []),
    ...alerts,
  ];

  const kpis = [
    { label: 'Clients actius',  value: clientCount   ?? '—', sub: 'amb accés al portal' },
    { label: 'Carteres actives', value: portfolioCount ?? '—', sub: 'creades des de propostes' },
    { label: 'Fons a punt',     value: fundsReady ? `${fundsReady.ready} de ${fundsReady.total}` : '—', sub: 'amb preus oficials per a propostes' },
  ];

  const tooltipStyle = {
    contentStyle: { background: 'rgb(var(--c-surface))', border: '1px solid rgb(var(--c-line))', borderRadius: 8 },
    labelStyle:   { color: 'rgb(var(--c-accent))', fontSize: 11 },
    itemStyle:    { color: 'rgb(var(--c-ink))', fontSize: 12 },
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-0.5">
            Resum d&apos;avui
          </h1>
          <p className="text-ink-muted text-sm">
            Avisos pendents, clients i accions habituals.
          </p>
        </div>
      </div>

      {/* Alertes reals */}
      {!alertsLoading && shownAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-ink-muted text-xs font-medium mb-2">Alertes actives</p>
          {shownAlerts.map((alert, i) => {
            const s = ALERT_STYLES[alert.type];
            return (
              <div key={i} className={`flex items-start gap-3 p-3.5 border ${s.border} ${s.bg} rounded-lg`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold ${s.bg} border ${s.border}`}>
                  <span className={s.text}>{s.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${s.text}`}>{alert.title}</p>
                  <p className="text-ink-muted text-xs mt-0.5 leading-relaxed">{alert.desc}</p>
                </div>
                {alert.action && alert.section && (
                  <button onClick={() => onNavigate(alert.section!)}
                    className={`text-xs font-medium flex-shrink-0 ${s.text} hover:opacity-80 transition-opacity`}>
                    {alert.action} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-surface border border-line rounded-lg px-5 py-4">
            <div className="text-ink-muted text-xs font-medium mb-2">{kpi.label}</div>
            <p className="text-2xl font-semibold text-ink mb-0.5">{String(kpi.value)}</p>
            <p className="text-ink-muted text-xs">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Gràfics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-start justify-between mb-0.5">
            <h3 className="text-ink font-semibold text-sm">Activitat mensual</h3>
          </div>
          <p className="text-ink-muted text-xs mb-4">Clients nous i propostes aprovades · últims 6 mesos · Dades reals</p>
          {!dash ? (
            <p className="text-ink-muted text-xs h-[190px] flex items-center justify-center">{dashError ? 'No s\'han pogut carregar les dades' : 'Carregant…'}</p>
          ) : (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={dash.activity} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e8e6" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="propostes" name="Propostes aprovades" fill="#1e5a47" radius={[4,4,0,0]} />
              <Bar dataKey="clients"   name="Clients nous"        fill="#a9c4b8" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-surface border border-line rounded-lg p-5">
          <div className="flex items-start justify-between mb-0.5">
            <h3 className="text-ink font-semibold text-sm">Distribució per perfil</h3>
          </div>
          <p className="text-ink-muted text-xs mb-4">Perfil de l&apos;última proposta aprovada de cada client · Dades reals</p>
          {!dash || dash.profiles.length === 0 ? (
            <p className="text-ink-muted text-xs h-[190px] flex items-center justify-center text-center px-6">
              {dashError ? 'No s\'han pogut carregar les dades' : !dash ? 'Carregant…' : 'Encara no hi ha cap proposta aprovada.'}
            </p>
          ) : (
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={dash.profiles} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                {dash.profiles.map(e => <Cell key={e.profile} fill={PROFILE_COLORS[e.profile]} stroke="transparent" />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} client${Number(v) === 1 ? '' : 's'}`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={(v) => <span style={{ color: 'rgb(var(--c-ink-soft))' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>

      </div>

      {/* Accions ràpides */}
      <div className="bg-surface border border-line rounded-lg p-5">
        <h3 className="text-ink font-semibold text-sm mb-4">Accions ràpides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((action, i) => (
            <button key={i}
              onClick={() => action.section ? onNavigate(action.section) : window.open('/', '_blank')}
              className="flex items-center gap-3 p-3.5 border border-line bg-subtle hover:bg-subtle rounded-lg transition-all text-left">
              <div className="min-w-0">
                <p className="text-ink text-xs font-semibold">{action.label}</p>
                <p className="text-ink-muted text-xs truncate">{action.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
