// components/admin/AdminStats.tsx
'use client';

import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';

interface Stats {
  total:  number;
  active: number;
  avgTER: number;
  byRisk: { risk: number; count: number }[];
}

type Section = 'dashboard' | 'funds' | 'reports' | 'news' | 'newsletter' | 'stocks' | 'portfolios' | 'config';

interface Props {
  stats:      Stats | null;
  onNavigate: (section: Section) => void;
}

const RISK_COLORS  = ['#10b981','#3b82f6','#f59e0b','#f97316','#ef4444'];
const RISK_LABELS  = ['Risc 1 — Molt baix','Risc 2 — Baix','Risc 3 — Moderat','Risc 4 — Alt','Risc 5 — Molt alt'];

const ACTIVITY_DATA = [
  { mes: 'Gen', informes: 4,  clients: 3  },
  { mes: 'Feb', informes: 7,  clients: 6  },
  { mes: 'Mar', informes: 5,  clients: 4  },
  { mes: 'Abr', informes: 12, clients: 9  },
  { mes: 'Mai', informes: 8,  clients: 7  },
  { mes: 'Jun', informes: 15, clients: 12 },
];

const PROFILE_DATA = [
  { name: 'Conservador', value: 18, color: '#10b981' },
  { name: 'Moderat',     value: 35, color: '#3b82f6' },
  { name: 'Dinàmic',     value: 30, color: '#f59e0b' },
  { name: 'Agressiu',    value: 17, color: '#ef4444' },
];

const QUICK_ACTIONS: { icon: string; label: string; sub: string; section: Section | null; color: string }[] = [
  { icon: '💼', label: 'Fons',        sub: 'Gestionar base de dades',  section: 'funds',      color: 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'     },
  { icon: '📰', label: 'Notícies',    sub: 'Publicar articles',        section: 'news',       color: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10' },
  { icon: '📧', label: 'Newsletter',  sub: 'Enviar a subscriptors',    section: 'newsletter', color: 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10'  },
  { icon: '📈', label: 'Accions',     sub: 'Senyals i seguiment',      section: 'stocks',     color: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'    },
  { icon: '🗂', label: 'Carteres',    sub: 'Carteres model',           section: 'portfolios', color: 'border-[#c9a84c]/20 bg-[#c9a84c]/5 hover:bg-[#c9a84c]/10'   },
  { icon: '📄', label: 'Informes',    sub: 'Historial de clients',     section: 'reports',    color: 'border-white/10 bg-white/3 hover:bg-white/5'                  },
  { icon: '⚙️', label: 'Config',     sub: 'APIs i paràmetres',        section: 'config',     color: 'border-white/10 bg-white/3 hover:bg-white/5'                  },
  { icon: '🚀', label: 'App pública', sub: 'Obrir en pestanya nova',   section: null,         color: 'border-white/10 bg-white/3 hover:bg-white/5'                  },
];

export default function AdminStats({ stats, onNavigate }: Props) {
  const kpis = [
    { label: 'Total fons',      value: stats?.total  ?? '—', icon: '💼', color: 'blue',   sub: 'base de dades'         },
    { label: 'Fons actius',     value: stats?.active ?? '—', icon: '✅', color: 'green',  sub: 'disponibles'           },
    { label: 'TER mitjà',       value: stats ? `${stats.avgTER}%` : '—', icon: '💰', color: 'amber', sub: 'cost ponderat' },
    { label: 'Perfils coberts', value: '4',                  icon: '👤', color: 'purple', sub: 'Cons · Mod · Din · Agr' },
  ];

  const colBorder: Record<string, string> = {
    blue:   'border-blue-500/30',
    green:  'border-emerald-500/30',
    amber:  'border-amber-500/30',
    purple: 'border-purple-500/30',
  };
  const colBg: Record<string, string> = {
    blue:   'bg-blue-500/8',
    green:  'bg-emerald-500/8',
    amber:  'bg-amber-500/8',
    purple: 'bg-purple-500/8',
  };
  const colText: Record<string, string> = {
    blue:   'text-blue-400',
    green:  'text-emerald-400',
    amber:  'text-amber-400',
    purple: 'text-purple-400',
  };

  const tooltipStyle = {
    contentStyle: { background: '#0d1f1a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8 },
    labelStyle:   { color: '#c9a84c', fontSize: 11 },
    itemStyle:    { color: '#fff', fontSize: 12 },
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 className="text-2xl font-black text-white mb-0.5"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            Dashboard
          </motion.h1>
          <motion.p className="text-white/35 text-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            Visió general del sistema Factor OTC
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">Sistema actiu</span>
        </motion.div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={i}
            className={`border ${colBorder[kpi.color]} ${colBg[kpi.color]} rounded-xl p-5`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            whileHover={{ y: -2 }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/30 text-xs uppercase tracking-widest">{kpi.label}</span>
              <span className="text-lg">{kpi.icon}</span>
            </div>
            <p className={`text-3xl font-black ${colText[kpi.color]} mb-0.5`}>{String(kpi.value)}</p>
            <p className="text-white/25 text-xs">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Gràfics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <motion.div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-white font-semibold text-sm mb-0.5">Activitat mensual</h3>
          <p className="text-white/30 text-xs mb-4">Informes generats i clients atesos</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={ACTIVITY_DATA} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="informes" name="Informes" fill="#c9a84c"  radius={[4,4,0,0]} />
              <Bar dataKey="clients"  name="Clients"  fill="#2d6a4f"  radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h3 className="text-white font-semibold text-sm mb-0.5">Distribució per perfil</h3>
          <p className="text-white/30 text-xs mb-4">Perfils assignats als clients (simulat)</p>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={PROFILE_DATA} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3}>
                {PROFILE_DATA.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={(v) => <span style={{ color: '#9ca3af' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h3 className="text-white font-semibold text-sm mb-0.5">Fons per nivell de risc</h3>
          <p className="text-white/30 text-xs mb-4">Distribució de la base de dades</p>
          {stats?.byRisk ? (
            <div className="space-y-3 pt-1">
              {stats.byRisk.map(({ risk, count }, i) => (
                <motion.div key={risk}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + i * 0.07 }}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-white/50">{RISK_LABELS[risk - 1]}</span>
                    <span className="text-white font-bold tabular-nums">{count}</span>
                  </div>
                  <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
                    <motion.div className="h-1.5 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[risk - 1] }}
                      initial={{ width: 0 }}
                      animate={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.07 }} />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <p className="text-white/25 text-sm">Carregant dades...</p>
            </div>
          )}
        </motion.div>

        <motion.div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <h3 className="text-white font-semibold text-sm mb-0.5">Evolució TER mitjà</h3>
          <p className="text-white/30 text-xs mb-4">Cost mitjà ponderat dels fons (simulat)</p>
          <ResponsiveContainer width="100%" height={175}>
            <LineChart data={[
              { mes: 'Gen', ter: 0.72 },
              { mes: 'Feb', ter: 0.68 },
              { mes: 'Mar', ter: 0.65 },
              { mes: 'Abr', ter: 0.63 },
              { mes: 'Mai', ter: 0.61 },
              { mes: 'Jun', ter: stats?.avgTER ?? 0.58 },
            ]} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${v}%`}
                domain={[0.4, 0.8]} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`, 'TER mitjà']} />
              <Line type="monotone" dataKey="ter" stroke="#c9a84c" strokeWidth={2}
                dot={{ fill: '#c9a84c', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#c9a84c' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Accions ràpides */}
      <motion.div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <h3 className="text-white font-semibold text-sm mb-4">Accions ràpides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.button key={i}
              onClick={() => action.section ? onNavigate(action.section) : window.open('/', '_blank')}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.05 }}
              className={`flex items-center gap-3 p-3.5 border rounded-lg transition-all text-left ${action.color}`}>
              <span className="text-xl flex-shrink-0">{action.icon}</span>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold">{action.label}</p>
                <p className="text-white/35 text-xs truncate">{action.sub}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
