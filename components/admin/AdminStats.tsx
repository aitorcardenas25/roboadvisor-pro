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

interface Props {
  stats:      Stats | null;
  onNavigate: (section: 'dashboard' | 'funds' | 'reports' | 'config') => void;
}

const RISK_COLORS = ['#10b981','#3b82f6','#f59e0b','#f97316','#ef4444'];
const RISK_LABELS = ['Risc 1 — Molt baix','Risc 2 — Baix','Risc 3 — Moderat','Risc 4 — Alt','Risc 5 — Molt alt'];

// Dades simulades d'activitat per als gràfics
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

export default function AdminStats({ stats, onNavigate }: Props) {
  const kpis = [
    { label: 'Total fons',      value: stats?.total  ?? '—', icon: '💼', color: 'blue',   sub: 'a la base de dades' },
    { label: 'Fons actius',     value: stats?.active ?? '—', icon: '✅', color: 'green',  sub: 'disponibles' },
    { label: 'TER mitjà',       value: stats ? `${stats.avgTER}%` : '—', icon: '💰', color: 'amber',  sub: 'cost ponderat' },
    { label: 'Perfils coberts', value: '4',                  icon: '👤', color: 'purple', sub: 'Cons. Mod. Din. Agr.' },
  ];

  const colors: Record<string, string> = {
    blue:   'border-blue-500/30 bg-blue-500/10',
    green:  'border-emerald-500/30 bg-emerald-500/10',
    amber:  'border-amber-500/30 bg-amber-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
  };
  const textColors: Record<string, string> = {
    blue:   'text-blue-400',
    green:  'text-emerald-400',
    amber:  'text-amber-400',
    purple: 'text-purple-400',
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <motion.h1
          className="text-2xl font-black text-white mb-1"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}>
          Dashboard
        </motion.h1>
        <motion.p
          className="text-white/40 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}>
          Visió general del sistema Factor OTC
        </motion.p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            className={`border rounded-xl p-5 ${colors[kpi.color]}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{ scale: 1.02, y: -2 }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{kpi.icon}</span>
              <span className="text-white/40 text-xs uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className={`text-3xl font-black ${textColors[kpi.color]}`}>{String(kpi.value)}</p>
            <p className="text-white/30 text-xs mt-1">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Gràfics principals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Activitat mensual */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}>
          <h3 className="text-white font-semibold mb-1">Activitat mensual</h3>
          <p className="text-white/30 text-xs mb-4">Informes generats i clients atesos</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ACTIVITY_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8 }}
                labelStyle={{ color: '#c9a84c' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="informes" name="Informes" fill="#c9a84c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="clients"  name="Clients"  fill="#2d6a4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Distribució perfils */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}>
          <h3 className="text-white font-semibold mb-1">Distribució per perfil</h3>
          <p className="text-white/30 text-xs mb-4">Perfils assignats als clients (simulat)</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={PROFILE_DATA}
                dataKey="value" nameKey="name"
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                paddingAngle={3}>
                {PROFILE_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8 }}
                itemStyle={{ color: '#fff' }}
                formatter={(v) => [`${v}%`, '']}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Distribució per risc */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}>
          <h3 className="text-white font-semibold mb-1">Fons per nivell de risc</h3>
          <p className="text-white/30 text-xs mb-4">Distribució de la base de dades de fons</p>
          {stats?.byRisk ? (
            <div className="space-y-3">
              {stats.byRisk.map(({ risk, count }, i) => (
                <motion.div
                  key={risk}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.07 }}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/60">{RISK_LABELS[risk - 1]}</span>
                    <span className="text-white font-bold">{count}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: RISK_COLORS[risk - 1] }}
                      initial={{ width: 0 }}
                      animate={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                      transition={{ duration: 0.8, delay: 0.6 + i * 0.07 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center">
              <p className="text-white/30 text-sm">Carregant dades...</p>
            </div>
          )}
        </motion.div>

        {/* Tendència TER */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}>
          <h3 className="text-white font-semibold mb-1">Evolució TER mitjà</h3>
          <p className="text-white/30 text-xs mb-4">Cost mitjà ponderat dels fons (simulat)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={[
              { mes: 'Gen', ter: 0.72 },
              { mes: 'Feb', ter: 0.68 },
              { mes: 'Mar', ter: 0.65 },
              { mes: 'Abr', ter: 0.63 },
              { mes: 'Mai', ter: 0.61 },
              { mes: 'Jun', ter: stats?.avgTER ?? 0.58 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={v => `${v}%`} domain={[0.4, 0.8]} />
              <Tooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8 }}
                labelStyle={{ color: '#c9a84c' }}
                itemStyle={{ color: '#fff' }}
                formatter={(v: number) => [`${v.toFixed(2)}%`, 'TER mitjà']}
              />
              <Line type="monotone" dataKey="ter" stroke="#c9a84c"
                strokeWidth={2} dot={{ fill: '#c9a84c', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Accions ràpides */}
      <motion.div
        className="bg-white/5 border border-white/10 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}>
        <h3 className="text-white font-semibold mb-4">Accions ràpides</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '💼', label: 'Gestionar fons',   sub: 'Crear, editar, eliminar', section: 'funds'   as const },
            { icon: '📄', label: 'Veure informes',   sub: 'Historial de clients',    section: 'reports' as const },
            { icon: '⚙️', label: 'Configuració',    sub: 'APIs i paràmetres',       section: 'config'  as const },
            { icon: '🚀', label: 'RoboAdvisor',      sub: 'Obrir app pública',       section: null },
          ].map((action, i) => (
            <motion.button
              key={i}
              onClick={() => action.section ? onNavigate(action.section) : window.open('/', '_blank')}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.07 }}
              className="flex items-center gap-3 p-4 bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-lg hover:bg-[#c9a84c]/20 transition-all text-left">
              <span className="text-2xl">{action.icon}</span>
              <div>
                <p className="text-white text-sm font-semibold">{action.label}</p>
                <p className="text-white/40 text-xs">{action.sub}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}