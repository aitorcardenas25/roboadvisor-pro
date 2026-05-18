'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StockReport, StockRating } from '@/lib/stockReports';

const RATING_META: Record<StockRating, { label: string; color: string; bg: string }> = {
  buy:   { label: 'Compra',      color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  hold:  { label: 'Mantenir',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  avoid: { label: 'Evitar',      color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  watch: { label: 'Observació',  color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
};

const VISIBLE_TO_META = {
  all:     { label: 'Tots',    color: '#10b981' },
  clients: { label: 'Clients', color: '#c9a84c' },
};

type FormState = Omit<StockReport, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>;

const EMPTY_FORM: FormState = {
  ticker: '', company: '', sector: '', rating: 'hold',
  summary: '', fundamentals: '', technicals: '', risks: '', conclusion: '',
  targetPrice: undefined, currentPrice: undefined, currency: 'EUR',
  status: 'draft', visibleTo: 'clients',
};

export default function StockReportsManager() {
  const [reports, setReports]   = useState<StockReport[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<StockReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stock-reports');
      const { reports: data } = await res.json();
      setReports(data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
  }

  function openEdit(r: StockReport) {
    setEditing(r);
    setForm({
      ticker: r.ticker, company: r.company, sector: r.sector, rating: r.rating,
      summary: r.summary, fundamentals: r.fundamentals, technicals: r.technicals,
      risks: r.risks, conclusion: r.conclusion,
      targetPrice: r.targetPrice, currentPrice: r.currentPrice, currency: r.currency,
      status: r.status, visibleTo: r.visibleTo,
    });
    setShowForm(true);
    setError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const method = editing ? 'PATCH' : 'POST';
      const url    = editing ? `/api/admin/stock-reports/${editing.id}` : '/api/admin/stock-reports';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Error'); return; }
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  }

  async function toggleStatus(r: StockReport) {
    const newStatus = r.status === 'draft' ? 'published' : 'draft';
    await fetch(`/api/admin/stock-reports/${r.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: newStatus } : x));
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar aquest informe?')) return;
    await fetch(`/api/admin/stock-reports/${id}`, { method: 'DELETE' });
    setReports(prev => prev.filter(r => r.id !== id));
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/50';
  const labelCls = 'block text-white/40 text-xs uppercase tracking-wide mb-1';

  if (showForm) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-white font-bold text-xl">{editing ? `Editar: ${editing.ticker}` : 'Nou informe borsari'}</h2>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Ticker *</label>
              <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                required placeholder="AAPL" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Empresa *</label>
              <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                required placeholder="Apple Inc." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sector</label>
              <input value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))}
                placeholder="Tecnologia" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Rating *</label>
              <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value as StockRating }))}
                className={inputCls}>
                {(Object.keys(RATING_META) as StockRating[]).map(r => (
                  <option key={r} value={r} style={{ background: '#0d1f1a' }}>{RATING_META[r].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Preu objectiu (€)</label>
              <input type="number" step="0.01" value={form.targetPrice ?? ''} onChange={e => setForm(p => ({ ...p, targetPrice: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Preu actual (€)</label>
              <input type="number" step="0.01" value={form.currentPrice ?? ''} onChange={e => setForm(p => ({ ...p, currentPrice: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Visible per</label>
              <select value={form.visibleTo} onChange={e => setForm(p => ({ ...p, visibleTo: e.target.value as StockReport['visibleTo'] }))}
                className={inputCls}>
                <option value="all" style={{ background: '#0d1f1a' }}>Tots (públic)</option>
                <option value="clients" style={{ background: '#0d1f1a' }}>Clients</option>
              </select>
            </div>
          </div>

          {([
            ['summary',      'Resum executiu *',    true],
            ['fundamentals', 'Anàlisi fonamental',  false],
            ['technicals',   'Anàlisi tècnica',     false],
            ['risks',        'Riscos principals',   false],
            ['conclusion',   'Conclusió *',         true],
          ] as const).map(([field, label, req]) => (
            <div key={field}>
              <label className={labelCls}>{label}</label>
              <textarea value={form[field] ?? ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                required={req} rows={3}
                className={`${inputCls} resize-none`} />
            </div>
          ))}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.status === 'published'}
                onChange={e => setForm(p => ({ ...p, status: e.target.checked ? 'published' : 'draft' }))}
                className="accent-[#c9a84c]" />
              <span className="text-white/60 text-sm">Publicar immediatament</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-lg disabled:opacity-50 transition-all">
              {saving ? 'Desant...' : editing ? 'Desar canvis' : 'Crear informe'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 text-white/40 hover:text-white text-sm transition-colors">
              Cancel·lar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Informes Borsaris</h2>
          <p className="text-white/40 text-sm mt-1">{reports.length} informe{reports.length !== 1 ? 's' : ''} · {reports.filter(r => r.status === 'published').length} publicats</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-semibold text-sm rounded-lg transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nou informe
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-3">📊</div>
          <p>Encara no hi ha informes borsaris.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const rating  = RATING_META[r.rating];
            const visible = VISIBLE_TO_META[r.visibleTo];
            return (
              <div key={r.id} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-white font-bold text-sm font-mono">{r.ticker}</span>
                      <span className="text-white/50 text-sm truncate">{r.company}</span>
                      {r.sector && <span className="text-white/30 text-xs">· {r.sector}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ color: rating.color, backgroundColor: rating.bg }}>
                        {rating.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full border"
                        style={{ color: visible.color, borderColor: `${visible.color}30`, backgroundColor: `${visible.color}10` }}>
                        {visible.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'published' ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5'}`}>
                        {r.status === 'published' ? 'Publicat' : 'Esborrany'}
                      </span>
                      {r.currentPrice != null && (
                        <span className="text-white/40 text-xs">{r.currentPrice.toFixed(2)} {r.currency}</span>
                      )}
                      {r.targetPrice != null && (
                        <span className="text-white/30 text-xs">Obj: {r.targetPrice.toFixed(2)}</span>
                      )}
                    </div>
                    {r.summary && <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{r.summary}</p>}
                    <p className="text-white/20 text-xs mt-1">{new Date(r.updatedAt).toLocaleDateString('ca-ES')}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleStatus(r)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${r.status === 'published' ? 'border-white/10 text-white/40 hover:border-red-400/30 hover:text-red-400' : 'border-green-400/30 text-green-400 hover:bg-green-400/10'}`}>
                      {r.status === 'published' ? 'Despublicar' : 'Publicar'}
                    </button>
                    <button onClick={() => openEdit(r)}
                      className="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
