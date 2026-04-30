// components/admin/ReportsHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportRecord {
  id:          string;
  clientName:  string;
  profile:     string;
  date:        string;
  score:       number;
  investable:  number;
  horizon:     number;
  pages:       number;
}

// Simulem un historial — en producció vindria d'una BD
const MOCK_REPORTS: ReportRecord[] = [
  { id: 'RA-ABC123', clientName: 'Carles Miró',    profile: 'dinamic',     date: '2026-04-29', score: 62, investable: 15000,  horizon: 10, pages: 10 },
  { id: 'RA-DEF456', clientName: 'Maria Puig',     profile: 'moderat',     date: '2026-04-28', score: 48, investable: 30000,  horizon: 15, pages: 10 },
  { id: 'RA-GHI789', clientName: 'Joan Fernández', profile: 'conservador', date: '2026-04-27', score: 28, investable: 8000,   horizon: 5,  pages: 10 },
  { id: 'RA-JKL012', clientName: 'Anna Costa',     profile: 'agressiu',    date: '2026-04-25', score: 81, investable: 50000,  horizon: 20, pages: 10 },
  { id: 'RA-MNO345', clientName: 'Pere Valls',     profile: 'dinamic',     date: '2026-04-22', score: 67, investable: 22000,  horizon: 12, pages: 10 },
  { id: 'RA-PQR678', clientName: 'Laura Gómez',    profile: 'moderat',     date: '2026-04-20', score: 52, investable: 45000,  horizon: 10, pages: 10 },
];

const PROFILE_COLORS: Record<string, string> = {
  conservador: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  moderat:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  dinamic:     'bg-amber-500/20 text-amber-400 border-amber-500/30',
  agressiu:    'bg-red-500/20 text-red-400 border-red-500/30',
};

const PROFILE_ICONS: Record<string, string> = {
  conservador: '🛡️', moderat: '⚖️', dinamic: '📈', agressiu: '🚀',
};

export default function ReportsHistory() {
  const [reports, setReports]   = useState<ReportRecord[]>(MOCK_REPORTS);
  const [search, setSearch]     = useState('');
  const [filterProfile, setFilterProfile] = useState<string>('all');
  const [selected, setSelected] = useState<ReportRecord | null>(null);
  const [sortBy, setSortBy]     = useState<'date' | 'score' | 'investable'>('date');

  const filtered = reports
    .filter(r => {
      const matchSearch  = r.clientName.toLowerCase().includes(search.toLowerCase()) ||
                           r.id.toLowerCase().includes(search.toLowerCase());
      const matchProfile = filterProfile === 'all' || r.profile === filterProfile;
      return matchSearch && matchProfile;
    })
    .sort((a, b) => {
      if (sortBy === 'date')      return b.date.localeCompare(a.date);
      if (sortBy === 'score')     return b.score - a.score;
      if (sortBy === 'investable') return b.investable - a.investable;
      return 0;
    });

  const fmt = (n: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const stats = {
    total:     reports.length,
    thisWeek:  reports.filter(r => {
      const d = new Date(r.date);
      const now = new Date();
      const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).length,
    avgScore:  Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length),
    avgInvest: Math.round(reports.reduce((s, r) => s + r.investable, 0) / reports.length),
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Historial d'Informes</h1>
          <p className="text-white/40 text-sm">{reports.length} informes generats</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            const csv = [
              'ID,Client,Perfil,Data,Score,Capital,Horitzó',
              ...reports.map(r =>
                `${r.id},${r.clientName},${r.profile},${r.date},${r.score},${r.investable},${r.horizon}`
              ),
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'factor_otc_informes.csv';
            a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c]/20 border border-[#c9a84c]/30 rounded-lg text-[#c9a84c] text-sm hover:bg-[#c9a84c]/30 transition-all">
          ⬇️ Exportar CSV
        </motion.button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total informes',    value: stats.total,                  sub: 'generats' },
          { label: 'Aquesta setmana',   value: stats.thisWeek,               sub: 'darrers 7 dies' },
          { label: 'Score mitjà',       value: `${stats.avgScore}%`,         sub: 'de perfilació' },
          { label: 'Capital mitjà',     value: fmt(stats.avgInvest),         sub: 'a invertir' },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border border-white/10 rounded-xl p-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-2xl font-black text-white">{String(kpi.value)}</p>
            <p className="text-white/25 text-xs mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Cercar per client o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20"
        />
        <select
          value={filterProfile}
          onChange={e => setFilterProfile(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none">
          <option value="all">Tots els perfils</option>
          <option value="conservador">🛡️ Conservador</option>
          <option value="moderat">⚖️ Moderat</option>
          <option value="dinamic">📈 Dinàmic</option>
          <option value="agressiu">🚀 Agressiu</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none">
          <option value="date">Ordenar per data</option>
          <option value="score">Ordenar per score</option>
          <option value="investable">Ordenar per capital</option>
        </select>
      </div>

      {/* Taula d'informes */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Perfil</th>
              <th className="text-center px-4 py-3">Score</th>
              <th className="text-right px-4 py-3">Capital</th>
              <th className="text-center px-4 py-3">Horitzó</th>
              <th className="text-center px-4 py-3">Data</th>
              <th className="text-center px-4 py-3">Accions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence>
              {filtered.map((report, i) => (
                <motion.tr
                  key={report.id}
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(report)}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{report.clientName}</p>
                    <p className="text-white/30 text-xs">{report.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${PROFILE_COLORS[report.profile]}`}>
                      {PROFILE_ICONS[report.profile]} {report.profile.charAt(0).toUpperCase() + report.profile.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          className="h-1.5 rounded-full bg-[#c9a84c]"
                          initial={{ width: 0 }}
                          animate={{ width: `${report.score}%` }}
                          transition={{ duration: 0.6, delay: i * 0.04 }}
                        />
                      </div>
                      <span className="text-white text-xs font-bold">{report.score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white/70 font-medium">
                    {fmt(report.investable)}
                  </td>
                  <td className="px-4 py-3 text-center text-white/50 text-xs">
                    {report.horizon} anys
                  </td>
                  <td className="px-4 py-3 text-center text-white/40 text-xs">
                    {new Date(report.date).toLocaleDateString('ca-ES')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={e => { e.stopPropagation(); setSelected(report); }}
                      className="text-[#c9a84c]/60 hover:text-[#c9a84c] text-xs px-3 py-1 rounded border border-[#c9a84c]/20 hover:border-[#c9a84c]/40 transition-all">
                      👁️ Veure
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-white/30">
                  No s'han trobat informes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detall informe */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}>
            <motion.div
              className="bg-[#0d1f1a] border border-white/20 rounded-2xl w-full max-w-md p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-bold text-lg">Detall de l'informe</h2>
                <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white text-xl">×</button>
              </div>

              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Client</p>
                  <p className="text-white font-bold text-xl">{selected.clientName}</p>
                  <p className="text-white/30 text-xs mt-1">{selected.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Perfil', value: `${PROFILE_ICONS[selected.profile]} ${selected.profile.charAt(0).toUpperCase() + selected.profile.slice(1)}` },
                    { label: 'Score',  value: `${selected.score}%` },
                    { label: 'Capital a invertir', value: fmt(selected.investable) },
                    { label: 'Horitzó temporal', value: `${selected.horizon} anys` },
                    { label: 'Data generació', value: new Date(selected.date).toLocaleDateString('ca-ES') },
                    { label: 'Pàgines PDF', value: `${selected.pages} pàgines` },
                  ].map((item, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/30 text-xs mb-1">{item.label}</p>
                      <p className="text-white font-semibold text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 bg-[#c9a84c] text-[#0d1f1a] font-bold py-2.5 rounded-lg text-sm">
                    📄 Regenerar PDF
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected(null)}
                    className="px-4 py-2.5 border border-white/20 text-white/60 rounded-lg text-sm hover:text-white transition-colors">
                    Tancar
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
