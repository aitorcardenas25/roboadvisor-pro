'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MonthlyReportData } from '@/lib/portfolioReport';
import type { MonthlyReportRecord } from '@/lib/monthlyReports';

interface PortfolioOption {
  id: string;
  clientName: string;
  name: string;
}

export default function MonthlyReportGenerator() {
  const [portfolios, setPortfolios]     = useState<PortfolioOption[]>([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState('');
  const [report, setReport]             = useState<MonthlyReportData | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [history, setHistory]           = useState<MonthlyReportRecord[]>([]);
  const [markingSent, setMarkingSent]   = useState<string | null>(null);

  const today   = new Date();
  const y       = today.getFullYear();
  const m       = String(today.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();

  const [form, setForm] = useState({
    portfolioId:     '',
    periodStart:     `${y}-${m}-01`,
    periodEnd:       `${y}-${m}-${lastDay}`,
    advisorComments: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/client-portfolios');
      const data = await res.json();
      setPortfolios((data.portfolios ?? []).map((p: { id: string; clientName: string; name: string }) => ({
        id: p.id, clientName: p.clientName, name: p.name,
      })));
    } finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async (portfolioId: string) => {
    if (!portfolioId) return;
    try {
      const res  = await fetch(`/api/admin/monthly-reports?portfolioId=${portfolioId}`);
      const data = await res.json();
      setHistory(data.reports ?? []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (form.portfolioId) loadHistory(form.portfolioId);
    else setHistory([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.portfolioId, loadHistory]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.portfolioId) { setError('Selecciona una cartera'); return; }
    setGenerating(true); setError(''); setReport(null);
    try {
      const res = await fetch('/api/admin/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
      const { report: r } = await res.json();
      setReport(r);
      setSavedReportId(r.reportId ?? null);
      loadHistory(form.portfolioId);
    } finally { setGenerating(false); }
  }

  async function handleMarkSent(id: string) {
    setMarkingSent(id);
    try {
      await fetch('/api/admin/monthly-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setHistory(prev => prev.map(r => r.id === id ? { ...r, sentAt: new Date().toISOString() } : r));
      if (savedReportId === id) setSavedReportId(null);
    } finally { setMarkingSent(null); }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/50';
  const labelCls = 'block text-white/40 text-xs uppercase tracking-wide mb-1';

  if (report) {
    const pnlColor = report.metrics.pnlEur >= 0 ? 'text-green-400' : 'text-red-400';
    return (
      <div>
        <div className="flex items-center gap-3 mb-6 no-print flex-wrap">
          <button onClick={() => { setReport(null); setSavedReportId(null); }} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-white font-bold text-xl flex-1">Vista prèvia de l&apos;informe</h2>
          {savedReportId && (
            <button
              onClick={() => handleMarkSent(savedReportId)}
              disabled={markingSent === savedReportId}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 text-green-400 font-semibold text-sm rounded-lg transition-all disabled:opacity-50">
              {markingSent === savedReportId ? '...' : '✓ Marcar com enviat'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-semibold text-sm rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / PDF
          </button>
        </div>

        {/* Report content */}
        <div id="monthly-report" className="bg-[#0d1f1a] border border-white/10 rounded-2xl p-8 print:bg-white print:text-black print:border-none print:rounded-none print:p-0">
          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-white/10 print:border-gray-200">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-[#c9a84c]/20 border border-[#c9a84c]/40 rounded flex items-center justify-center">
                  <span className="text-[#c9a84c] font-black text-xs print:hidden">F</span>
                </div>
                <span className="text-white font-black tracking-wider print:text-black">FACTOR OTC</span>
              </div>
              <h1 className="text-white font-bold text-2xl mb-1 print:text-black">Informe Mensual de Cartera</h1>
              <p className="text-white/50 text-sm print:text-gray-500">{report.clientName} · {report.portfolioName}</p>
            </div>
            <div className="text-right">
              <p className="text-white/30 text-xs print:text-gray-400">ID: {report.reportId}</p>
              <p className="text-white/40 text-sm mt-1 print:text-gray-600">
                {new Date(report.periodStart).toLocaleDateString('ca-ES')} – {new Date(report.periodEnd).toLocaleDateString('ca-ES')}
              </p>
              <p className="text-white/20 text-xs mt-1 print:text-gray-400">
                Generat: {new Date(report.generatedAt).toLocaleString('ca-ES')}
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Valor actual',     value: `${report.metrics.currentValue.toFixed(2)} €` },
              { label: 'Aportació neta',   value: `${report.metrics.netContributions.toFixed(2)} €` },
              { label: 'Rendiment (€)',    value: `${report.metrics.pnlEur >= 0 ? '+' : ''}${report.metrics.pnlEur.toFixed(2)} €`, colored: true },
              { label: 'Rendiment (%)',    value: `${report.metrics.pnlPct >= 0 ? '+' : ''}${report.metrics.pnlPct.toFixed(2)}%`, colored: true },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white/5 rounded-xl p-4 print:bg-gray-50 print:rounded-none print:border print:border-gray-200">
                <p className="text-white/40 text-xs mb-1 print:text-gray-500">{kpi.label}</p>
                <p className={`font-bold text-lg ${kpi.colored ? pnlColor : 'text-white'} print:text-black`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Top holdings */}
          {report.topHoldings.length > 0 && (
            <div className="mb-8">
              <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide print:text-black">Principals posicions</h2>
              <div className="space-y-2">
                {report.topHoldings.map(h => (
                  <div key={h.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-xs truncate print:text-gray-700">{h.name}</span>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-white/40 text-xs print:text-gray-500">{h.value.toFixed(0)} €</span>
                          <span className={`text-xs font-mono ${h.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                          </span>
                          <span className="text-white/30 text-xs w-10 text-right print:text-gray-400">{h.weight.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden print:bg-gray-200">
                        <div className="h-full bg-[#c9a84c]/60 rounded-full" style={{ width: `${Math.min(h.weight, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advisor comments */}
          {report.advisorComments && (
            <div className="mb-6">
              <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide print:text-black">Comentaris de l&apos;assessor</h2>
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 print:bg-gray-50 print:border-gray-200">
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap print:text-gray-700">{report.advisorComments}</p>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-8 pt-6 border-t border-white/5 print:border-gray-200">
            <p className="text-white/20 text-xs leading-relaxed print:text-gray-400">
              Aquest informe és una eina de suport a la decisió i no constitueix assessorament financer regulat.
              Les dades de rendiment passades no garanteixen rendiments futurs. Factor OTC no executa operacions reals.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-white font-bold text-xl">Generador d&apos;Informe Mensual</h2>
        <p className="text-white/40 text-sm mt-1">Genera un informe mensual per a una cartera de client</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
        <form onSubmit={handleGenerate} className="max-w-xl space-y-5">
          <div>
            <label className={labelCls}>Cartera del client *</label>
            {portfolios.length === 0 ? (
              <p className="text-white/30 text-sm">No hi ha carteres disponibles.</p>
            ) : (
              <select
                value={form.portfolioId}
                onChange={e => setForm(p => ({ ...p, portfolioId: e.target.value }))}
                required className={inputCls}>
                <option value="" style={{ background: '#0d1f1a' }}>Selecciona una cartera...</option>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id} style={{ background: '#0d1f1a' }}>
                    {p.clientName} — {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Inici del període</label>
              <input type="date" value={form.periodStart}
                onChange={e => setForm(p => ({ ...p, periodStart: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fi del període</label>
              <input type="date" value={form.periodEnd}
                onChange={e => setForm(p => ({ ...p, periodEnd: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Comentaris de l&apos;assessor</label>
            <textarea
              value={form.advisorComments}
              onChange={e => setForm(p => ({ ...p, advisorComments: e.target.value }))}
              rows={5}
              placeholder="Resum del mes, moviments rellevants, perspectives de mercat, recomanacions..."
              className={`${inputCls} resize-none`} />
          </div>

          <button
            type="submit"
            disabled={generating || portfolios.length === 0}
            className="px-6 py-2.5 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-lg disabled:opacity-50 transition-all flex items-center gap-2">
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#0d1f1a]/30 border-t-[#0d1f1a] rounded-full animate-spin" />
                Generant...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generar informe
              </>
            )}
          </button>
        </form>

        {/* Historial d'informes mensuals per la cartera seleccionada */}
        {history.length > 0 && (
          <div className="mt-10">
            <h3 className="text-white/60 text-xs uppercase tracking-widest mb-3">Historial d&apos;informes</h3>
            <div className="space-y-2">
              {history.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white/70 text-sm">
                      {new Date(r.periodStart).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-white/30 text-xs font-mono mt-0.5">{r.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.sentAt ? (
                      <span className="text-xs text-green-400/70">✓ Enviat {new Date(r.sentAt).toLocaleDateString('ca-ES')}</span>
                    ) : (
                      <button
                        onClick={() => handleMarkSent(r.id)}
                        disabled={markingSent === r.id}
                        className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50">
                        {markingSent === r.id ? '...' : 'Marcar enviat'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
