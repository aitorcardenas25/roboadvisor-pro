// components/admin/ReportsHistory.tsx
'use client';

import { useState, useEffect } from 'react';
import type { ReportRecord } from '@/lib/reportRegistry';

const PROFILE_COLORS: Record<string, string> = {
  conservador: 'bg-positive/20 text-positive border-positive/30',
  moderat:     'bg-info/20 text-info border-info/30',
  dinamic:     'bg-warning/20 text-warning border-warning/30',
  agressiu:    'bg-negative/20 text-negative border-negative/30',
};




export default function ReportsHistory() {
  const [reports, setReports]     = useState<ReportRecord[]>([]);
  const [isDemo, setIsDemo]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterProfile, setFilterProfile] = useState<string>('all');
  const [selected, setSelected]   = useState<ReportRecord | null>(null);
  const [sortBy, setSortBy]       = useState<'date' | 'score' | 'investable'>('date');

  useEffect(() => {
    fetch('/api/report-registry')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // Mai mostrar informes inventats: si no n'hi ha, la llista queda buida.
        setReports(data?.reports ?? []);
        setIsDemo(!data?.reports?.length);
      })
      .catch(() => { setReports([]); setIsDemo(true); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = reports
    .filter(r => {
      const matchSearch  = r.clientName.toLowerCase().includes(search.toLowerCase()) ||
                           r.id.toLowerCase().includes(search.toLowerCase());
      const matchProfile = filterProfile === 'all' || r.profile === filterProfile;
      return matchSearch && matchProfile;
    })
    .sort((a, b) => {
      if (sortBy === 'date')       return b.createdAt.localeCompare(a.createdAt);
      if (sortBy === 'score')      return b.score - a.score;
      if (sortBy === 'investable') return b.investable - a.investable;
      return 0;
    });

  const fmt = (n: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

  const stats = {
    total:     reports.length,
    thisWeek:  reports.filter(r => {
      const diff = (Date.now() - new Date(r.createdAt).getTime()) / 86400000;
      return diff <= 7;
    }).length,
    avgScore:  reports.length ? Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length) : 0,
    withEmail: reports.filter(r => r.emailSent).length,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink mb-1">Historial d'Informes</h1>
          <p className="text-ink-muted text-sm">
            {loading ? 'Carregant...' : `${reports.length} informes registrats`}
          </p>
        </div>
        <button
          onClick={() => {
            const csv = [
              'ID,Client,Email,Perfil,Score,Mensual,Capital,Horitzó,PDF,Email,Data',
              ...reports.map(r =>
                `${r.id},"${r.clientName}",${r.clientEmail},${r.profile},${r.score},${r.monthlyAmount},${r.investable},${r.horizon},${r.pdfGenerated},${r.emailSent},${r.date}`
              ),
            ].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'factor_otc_informes.csv'; a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-soft border border-accent/30 rounded-lg text-accent text-sm hover:bg-accent/30 transition-all">
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* Demo notice */}
      {isDemo && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 bg-warning/8 border border-warning/20 rounded-lg">
          <span className="text-warning text-sm"></span>
          <p className="text-warning/80 text-xs">
            <span className="font-semibold">Encara no hi ha informes del qüestionari.</span> Les propostes i els informes mensuals dels clients es generen i es guarden a la fitxa de cada client (Clients → fitxa → Proposta / Informes).
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total informes',    value: stats.total,             sub: 'generats' },
          { label: 'Aquesta setmana',   value: stats.thisWeek,          sub: 'darrers 7 dies' },
          { label: 'Score mitjà',       value: `${stats.avgScore}%`,    sub: 'de perfilació' },
          { label: 'Enviats per email', value: stats.withEmail,         sub: 'emails enviats' },
        ].map((kpi, i) => (
          <div key={i}
            className="bg-subtle border border-line rounded-lg p-4">
            <p className="text-ink-muted text-xs font-medium mb-1">{kpi.label}</p>
            <p className="text-2xl font-semibold text-ink">{String(kpi.value)}</p>
            <p className="text-ink-muted text-xs mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" placeholder="Cercar per client o ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-subtle border border-line rounded-lg px-4 py-2.5 text-ink text-sm focus:outline-none focus:border-accent/40 placeholder-ink-muted"
        />
        <select value={filterProfile} onChange={e => setFilterProfile(e.target.value)}
          className="bg-subtle border border-line rounded-lg px-4 py-2.5 text-ink text-sm focus:outline-none">
          <option value="all">Tots els perfils</option>
          <option value="conservador">Conservador</option>
          <option value="moderat">Moderat</option>
          <option value="dinamic">Dinàmic</option>
          <option value="agressiu">Agressiu</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-subtle border border-line rounded-lg px-4 py-2.5 text-ink text-sm focus:outline-none">
          <option value="date">Ordenar per data</option>
          <option value="score">Ordenar per score</option>
          <option value="investable">Ordenar per capital</option>
        </select>
      </div>

      {/* Taula */}
      <div className="bg-subtle border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-line text-ink-muted text-xs font-medium">
              <th className="text-left px-4 py-3">Client</th>
              <th className="text-left px-4 py-3">Perfil</th>
              <th className="text-center px-4 py-3">Score</th>
              <th className="text-right px-4 py-3">Mensual</th>
              <th className="text-right px-4 py-3">Capital</th>
              <th className="text-center px-4 py-3">Estat</th>
              <th className="text-center px-4 py-3">Data</th>
              <th className="text-center px-4 py-3">Acció</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <>
              {filtered.map(r => (
                <tr key={r.id}
                  className="hover:bg-subtle transition-colors cursor-pointer"
                  onClick={() => setSelected(r)}>
                  <td className="px-4 py-3">
                    <p className="text-ink font-medium">{r.clientName}</p>
                    <p className="text-ink-muted text-xs">{r.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${PROFILE_COLORS[r.profile] ?? 'bg-subtle-strong text-ink-soft border-line-strong'}`}>
                      {r.profile.charAt(0).toUpperCase() + r.profile.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-subtle-strong rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="text-ink text-xs font-bold">{r.score}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-ink-soft text-xs">
                    {r.monthlyAmount > 0 ? fmt(r.monthlyAmount) + '/mes' : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-soft font-medium">
                    {r.investable > 0 ? fmt(r.investable) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span title="PDF generat" className={`text-xs ${r.pdfGenerated ? 'text-positive' : 'text-ink-muted'}`}>PDF</span>
                      <span title="Email enviat" className={`text-xs ${r.emailSent ? 'text-positive' : 'text-ink-muted'}`}>Email</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-ink-muted text-xs">
                    {r.date}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={e => { e.stopPropagation(); setSelected(r); }}
                      className="text-accent/60 hover:text-accent text-xs px-3 py-1 rounded border border-accent/20 hover:border-accent/40 transition-all">
                      Veure
                    </button>
                  </td>
                </tr>
              ))}
            </>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-ink-muted">
                  No s'han trobat informes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal detall */}
      <>
        {selected && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}>
            <div className="bg-surface border border-line-strong rounded-lg w-full max-w-lg p-6"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-ink font-bold text-lg">Detall de l'informe</h2>
                <button onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink text-xl">×</button>
              </div>

              <div className="space-y-4">
                <div className="bg-subtle rounded-lg p-4">
                  <p className="text-ink-muted text-xs font-medium mb-1">Client</p>
                  <p className="text-ink font-bold text-xl">{selected.clientName}</p>
                  {selected.clientEmail && <p className="text-ink-muted text-xs mt-1">{selected.clientEmail}</p>}
                  <p className="text-ink-muted text-xs mt-1">{selected.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Perfil', value: selected.profile },
                    { label: 'Score',  value: `${selected.score}%` },
                    { label: 'Aportació mensual', value: selected.monthlyAmount > 0 ? fmt(selected.monthlyAmount) : '—' },
                    { label: 'Capital a invertir', value: selected.investable > 0 ? fmt(selected.investable) : '—' },
                    { label: 'Horitzó temporal', value: `${selected.horizon} anys` },
                    { label: 'Data generació', value: selected.date },
                  ].map((item, i) => (
                    <div key={i} className="bg-subtle rounded-lg p-3">
                      <p className="text-ink-muted text-xs mb-1">{item.label}</p>
                      <p className="text-ink font-semibold text-sm">{item.value}</p>
                    </div>
                  ))}
                </div>

                {selected.portfolio.length > 0 && (
                  <div className="bg-subtle rounded-lg p-4">
                    <p className="text-ink-muted text-xs font-medium mb-2">Cartera recomanada</p>
                    <div className="flex flex-wrap gap-2">
                      {selected.portfolio.map((p, i) => (
                        <span key={i} className="text-xs bg-accent-soft text-accent/80 border border-accent/20 px-2 py-1 rounded-lg font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${selected.pdfGenerated ? 'bg-positive/10 text-positive' : 'bg-subtle text-ink-muted'}`}>
                    {selected.pdfGenerated ? 'PDF generat' : 'Sense PDF'}
                  </span>
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${selected.emailSent ? 'bg-positive/10 text-positive' : 'bg-subtle text-ink-muted'}`}>
                    {selected.emailSent ? 'Email enviat' : 'Sense email'}
                  </span>
                </div>

                <button onClick={() => setSelected(null)}
                  className="w-full py-2.5 border border-line-strong text-ink-soft rounded-lg text-sm hover:text-ink transition-colors">
                  Tancar
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
