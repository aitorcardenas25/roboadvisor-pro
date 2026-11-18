'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MonthlyReportData } from '@/lib/portfolioReport';
import type { MonthlyReportRecord } from '@/lib/monthlyReports';
import MonthlyReportView from '@/components/MonthlyReportView';

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

  // Per defecte, l'últim mes tancat (el mes en curs encara no té tots els preus).
  const today   = new Date();
  const prev    = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const y       = prev.getFullYear();
  const m       = String(prev.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();

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

  const inputCls = 'w-full bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-accent/50';
  const labelCls = 'block text-ink-muted text-xs font-medium mb-1';

  if (report) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6 no-print flex-wrap">
          <button onClick={() => { setReport(null); setSavedReportId(null); }} className="text-ink-muted hover:text-ink transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-ink font-bold text-xl flex-1">Vista prèvia de l&apos;informe</h2>
          {savedReportId && (
            <button
              onClick={() => handleMarkSent(savedReportId)}
              disabled={markingSent === savedReportId}
              className="flex items-center gap-2 px-4 py-2 bg-positive/20 border border-positive/30 hover:bg-positive/30 text-positive font-semibold text-sm rounded-lg transition-all disabled:opacity-50">
              {markingSent === savedReportId ? '...' : '✓ Marcar com enviat'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / PDF
          </button>
        </div>

        {/* Report content */}
        <MonthlyReportView report={report} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-ink font-bold text-xl">Generador d&apos;Informe Mensual</h2>
        <p className="text-ink-muted text-sm mt-1">Genera un informe mensual per a una cartera de client</p>
      </div>

      {error && <div className="mb-4 p-3 bg-negative/10 border border-negative/20 rounded-lg text-negative text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
        <form onSubmit={handleGenerate} className="max-w-xl space-y-5">
          <div>
            <label className={labelCls}>Cartera del client *</label>
            {portfolios.length === 0 ? (
              <p className="text-ink-muted text-sm">No hi ha carteres disponibles.</p>
            ) : (
              <select
                value={form.portfolioId}
                onChange={e => setForm(p => ({ ...p, portfolioId: e.target.value }))}
                required className={inputCls}>
                <option value="" style={{ background: 'rgb(var(--c-surface))' }}>Selecciona una cartera...</option>
                {portfolios.map(p => (
                  <option key={p.id} value={p.id} style={{ background: 'rgb(var(--c-surface))' }}>
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
            className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm rounded-lg disabled:opacity-50 transition-all flex items-center gap-2">
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-accent-ink/30 border-t-accent-ink rounded-full animate-spin" />
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
            <h3 className="text-ink-soft text-xs font-medium mb-3">Historial d&apos;informes</h3>
            <div className="space-y-2">
              {history.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-subtle border border-line rounded-lg px-4 py-3">
                  <div>
                    <p className="text-ink-soft text-sm">
                      {new Date(r.periodStart).toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-ink-muted text-xs font-mono mt-0.5">{r.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.sentAt ? (
                      <span className="text-xs text-positive/70">✓ Enviat {new Date(r.sentAt).toLocaleDateString('ca-ES')}</span>
                    ) : (
                      <button
                        onClick={() => handleMarkSent(r.id)}
                        disabled={markingSent === r.id}
                        className="px-3 py-1 bg-positive/10 border border-positive/20 text-positive text-xs rounded-lg hover:bg-positive/20 transition-all disabled:opacity-50">
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
