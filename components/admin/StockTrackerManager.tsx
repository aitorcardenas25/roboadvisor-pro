'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TrackedStock, StockSignal } from '@/lib/stockTracker';
import { SIGNAL_META } from '@/lib/stockTracker';

const SIGNALS: StockSignal[] = ['neutral', 'vigilancia', 'oportunitat', 'risc-elevat'];

type FormData = {
  symbol: string; name: string; sector: string; region: string; currency: string;
  signal: StockSignal; signalNote: string; technicalNote: string; fundamentalNote: string; active: boolean;
};

const EMPTY: FormData = {
  symbol: '', name: '', sector: '', region: 'Global', currency: 'EUR',
  signal: 'neutral', signalNote: '', technicalNote: '', fundamentalNote: '', active: true,
};

export default function StockTrackerManager() {
  const [stocks, setStocks]     = useState<TrackedStock[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<TrackedStock | null>(null);
  const [form, setForm]         = useState<FormData>({ ...EMPTY });
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState('');

  const fetchStocks = useCallback(async () => {
    const res = await fetch('/api/admin/stocks');
    if (res.ok) setStocks((await res.json()).stocks);
  }, []);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  const notify = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000); };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); };
  const openEdit   = (s: TrackedStock) => {
    setEditing(s);
    setForm({ symbol: s.symbol, name: s.name, sector: s.sector, region: s.region,
      currency: s.currency, signal: s.signal, signalNote: s.signalNote,
      technicalNote: s.technicalNote, fundamentalNote: s.fundamentalNote, active: s.active });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url    = editing ? `/api/admin/stocks/${editing.id}` : '/api/admin/stocks';
    const method = editing ? 'PATCH' : 'POST';
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setLoading(false);
    if (res.ok) { notify(editing ? 'Actualitzada.' : 'Creada.'); setShowForm(false); fetchStocks(); }
    else        { notify((await res.json()).error ?? 'Error.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar aquesta acció del seguiment?')) return;
    const res = await fetch(`/api/admin/stocks/${id}`, { method: 'DELETE' });
    if (res.ok) { notify('Eliminada.'); fetchStocks(); }
  };

  const handleSignal = async (id: string, signal: StockSignal) => {
    const res = await fetch(`/api/admin/stocks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signal }) });
    if (res.ok) { notify(`Senyal: ${SIGNAL_META[signal].label}`); fetchStocks(); }
  };

  const inp = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/50';
  const ta  = inp + ' resize-y';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-bold text-xl">Seguiment d'Accions</h2>
          <p className="text-white/40 text-sm">{stocks.filter(s => s.active).length} actives · {stocks.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {feedback && <span className="text-[#c9a84c] text-sm">{feedback}</span>}
          <button onClick={openCreate} className="bg-[#c9a84c] hover:bg-[#b8973b] text-[#0d1f1a] font-bold text-sm px-4 py-2 rounded-lg transition-colors">
            + Nova acció
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-4 py-3">
        <p className="text-yellow-400/70 text-xs">⚠️ Les senyals configurades aquí es mostraran als usuaris com a informació orientativa, no com a recomanació d'inversió.</p>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <h3 className="text-white font-semibold">{editing ? `Editar ${editing.symbol}` : 'Nova acció'}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Ticker/Symbol *</label>
              <input required value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                placeholder="AAPL" className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Nom complet *</label>
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Sector</label>
              <input value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Regió</label>
              <input value={form.region} onChange={e => setForm(p => ({ ...p, region: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Divisa</label>
              <input value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} className={inp} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Senyal</label>
              <div className="flex gap-2 flex-wrap">
                {SIGNALS.map(sig => {
                  const m = SIGNAL_META[sig];
                  return (
                    <button key={sig} type="button" onClick={() => setForm(p => ({ ...p, signal: sig }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.signal === sig ? 'border-transparent' : 'border-white/10 text-white/50'}`}
                      style={form.signal === sig ? { backgroundColor: m.color + '30', color: m.color, borderColor: m.color + '50' } : {}}>
                      {m.icon} {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Nota de senyal</label>
              <textarea rows={2} value={form.signalNote} onChange={e => setForm(p => ({ ...p, signalNote: e.target.value }))} className={ta} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Anàlisi fonamental</label>
              <textarea rows={3} value={form.fundamentalNote} onChange={e => setForm(p => ({ ...p, fundamentalNote: e.target.value }))} className={ta} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-white/50 text-xs uppercase tracking-widest mb-1">Anàlisi tècnica</label>
              <textarea rows={3} value={form.technicalNote} onChange={e => setForm(p => ({ ...p, technicalNote: e.target.value }))} className={ta} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="w-4 h-4 accent-[#c9a84c]" />
              <label htmlFor="active" className="text-white/60 text-sm">Visible al públic</label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">Cancel·lar</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-[#c9a84c] hover:bg-[#b8973b] disabled:opacity-50 text-[#0d1f1a] font-bold text-sm rounded-lg transition-colors">
              {loading ? 'Desant...' : editing ? 'Desar' : 'Crear'}
            </button>
          </div>
        </form>
      )}

      {/* Stock list */}
      <div className="space-y-3">
        {stocks.length === 0 && <p className="text-white/30 text-sm text-center py-8">Cap acció afegida.</p>}
        {stocks.map(s => {
          const m = SIGNAL_META[s.signal];
          return (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-white font-bold">{s.symbol}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: m.color, backgroundColor: m.color + '20' }}>{m.icon} {m.label}</span>
                    {!s.active && <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full">Ocult</span>}
                  </div>
                  <p className="text-white/50 text-sm truncate">{s.name}</p>
                  <p className="text-white/30 text-xs">{s.sector} · {s.region} · {s.updatedAt}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                  {/* Canvi ràpid de senyal */}
                  {SIGNALS.filter(sig => sig !== s.signal).map(sig => {
                    const sm = SIGNAL_META[sig];
                    return (
                      <button key={sig} onClick={() => handleSignal(s.id, sig)}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                        style={{ color: sm.color }} title={sm.label}>
                        {sm.icon}
                      </button>
                    );
                  })}
                  <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">Editar</button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors">Eliminar</button>
                </div>
              </div>
              {s.signalNote && <p className="text-white/40 text-xs mt-2 line-clamp-2 leading-relaxed">{s.signalNote}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
