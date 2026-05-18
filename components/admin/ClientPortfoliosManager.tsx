'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClientPortfolio, ClientHolding, PortfolioMetrics } from '@/lib/clientPortfolios';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return `${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

function computeMetrics(p: ClientPortfolio): PortfolioMetrics {
  const totalInvested = p.holdings.reduce((s, h) => s + h.avgEntryPrice * h.quantity, 0);
  const currentValue  = p.holdings.reduce((s, h) => s + h.currentPrice  * h.quantity, 0);
  const pnlEur = currentValue - totalInvested;
  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue:  Math.round(currentValue  * 100) / 100,
    pnlEur:        Math.round(pnlEur * 100) / 100,
    pnlPct:        totalInvested > 0 ? Math.round((pnlEur / totalInvested) * 10000) / 100 : 0,
    holdingCount:  p.holdings.length,
  };
}

const EMPTY_HOLDING = {
  assetIsin: '', assetName: '', assetSymbol: '', assetCategory: 'Renda Variable / ETF',
  broker: '', quantity: '', avgEntryPrice: '', currentPrice: '', currency: 'EUR', notes: '',
};

const EMPTY_NOTE = { text: '' };
const EMPTY_PORTFOLIO = { clientId: '', clientName: '', name: '', description: '', recommendations: '' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricPill({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? '#c9a84c' : positive ? '#10b981' : '#ef4444';
  return (
    <div className="bg-[#0a0f0d] border border-white/10 rounded-lg p-3">
      <div className="font-bold text-base" style={{ color }}>{value}</div>
      <div className="text-white/30 text-xs mt-0.5">{label}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClientPortfoliosManager() {
  const [portfolios, setPortfolios] = useState<ClientPortfolio[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<ClientPortfolio | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showAddNote, setShowAddNote]       = useState(false);
  const [editPriceId, setEditPriceId]       = useState<string | null>(null);
  const [newPrice, setNewPrice]             = useState('');
  const [saving, setSaving]                 = useState(false);
  const [newPortfolio, setNewPortfolio]     = useState(EMPTY_PORTFOLIO);
  const [newHolding, setNewHolding]         = useState(EMPTY_HOLDING);
  const [newNote, setNewNote]               = useState(EMPTY_NOTE);
  const [error, setError]                   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/client-portfolios');
      const { portfolios: data } = await res.json();
      setPortfolios(data ?? []);
      if (selected) {
        const fresh = (data ?? []).find((p: ClientPortfolio) => p.id === selected.id);
        if (fresh) setSelected(fresh);
      }
    } finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, body: object): Promise<ClientPortfolio | null> {
    setSaving(true); setError('');
    try {
      const res  = await fetch(`/api/admin/client-portfolios/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error'); return null; }
      const updated = data.portfolio as ClientPortfolio;
      setPortfolios(prev => prev.map(p => p.id === id ? updated : p));
      setSelected(updated);
      return updated;
    } finally { setSaving(false); }
  }

  async function handleCreatePortfolio(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/client-portfolios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPortfolio),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setPortfolios(prev => [data.portfolio, ...prev]);
      setSelected(data.portfolio);
      setNewPortfolio(EMPTY_PORTFOLIO);
      setShowCreate(false);
    } finally { setSaving(false); }
  }

  async function handleAddHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const h = {
      assetIsin:        newHolding.assetIsin.trim(),
      assetName:        newHolding.assetName.trim(),
      assetSymbol:      newHolding.assetSymbol.trim() || undefined,
      assetCategory:    newHolding.assetCategory,
      broker:           newHolding.broker.trim(),
      quantity:         parseFloat(newHolding.quantity),
      avgEntryPrice:    parseFloat(newHolding.avgEntryPrice),
      currentPrice:     parseFloat(newHolding.currentPrice),
      priceLastUpdated: new Date().toISOString().split('T')[0],
      currency:         newHolding.currency,
      notes:            newHolding.notes.trim() || undefined,
    };
    const updated = await patch(selected.id, { action: 'add-holding', holding: h });
    if (updated) { setNewHolding(EMPTY_HOLDING); setShowAddHolding(false); }
  }

  async function handleUpdatePrice(holdingId: string) {
    if (!selected || !newPrice) return;
    await patch(selected.id, { action: 'update-price', holdingId, currentPrice: parseFloat(newPrice) });
    setEditPriceId(null); setNewPrice('');
  }

  async function handleRemoveHolding(holdingId: string) {
    if (!selected || !confirm('Eliminar aquest actiu de la cartera?')) return;
    await patch(selected.id, { action: 'remove-holding', holdingId });
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const updated = await patch(selected.id, { action: 'add-advisor-note', note: newNote });
    if (updated) { setNewNote(EMPTY_NOTE); setShowAddNote(false); }
  }

  async function handleDeletePortfolio(id: string) {
    if (!confirm('Eliminar aquesta cartera? Aquesta acció no es pot desfer.')) return;
    await fetch(`/api/admin/client-portfolios/${id}`, { method: 'DELETE' });
    setPortfolios(prev => prev.filter(p => p.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  if (selected) {
    const m = computeMetrics(selected);
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-white font-bold text-xl">{selected.name}</h2>
            <p className="text-white/40 text-sm">{selected.clientName}</p>
          </div>
          <button
            onClick={() => handleDeletePortfolio(selected.id)}
            className="text-red-400/50 hover:text-red-400 transition-colors text-xs">
            Eliminar cartera
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4 text-red-400 text-sm">{error}</div>}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricPill label="Capital invertit"   value={fEur(m.totalInvested)} />
          <MetricPill label="Valor actual"        value={fEur(m.currentValue)} />
          <MetricPill label="Guany / Pèrdua (€)"  value={fEur(m.pnlEur)}       positive={m.pnlEur >= 0} />
          <MetricPill label="Rendibilitat (%)"    value={fPct(m.pnlPct)}        positive={m.pnlPct >= 0} />
        </div>

        {/* Holdings table */}
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Posicions ({selected.holdings.length})</h3>
            <button
              onClick={() => setShowAddHolding(v => !v)}
              className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-xs px-3 py-1.5 rounded-lg transition-all">
              + Afegir posició
            </button>
          </div>

          {showAddHolding && (
            <form onSubmit={handleAddHolding} className="p-5 border-b border-white/10 bg-white/2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {[
                  { key: 'assetName',     label: 'Nom de l\'actiu', placeholder: 'iShares Core MSCI World' },
                  { key: 'assetIsin',     label: 'ISIN',            placeholder: 'IE00B4L5Y983' },
                  { key: 'assetSymbol',   label: 'Ticker (opcional)', placeholder: 'SWDA' },
                  { key: 'assetCategory', label: 'Categoria',       placeholder: 'Renda Variable / ETF' },
                  { key: 'broker',        label: 'Broker',          placeholder: 'Interactive Brokers' },
                  { key: 'currency',      label: 'Moneda',          placeholder: 'EUR' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-white/50 text-xs mb-1">{f.label}</label>
                    <input
                      value={(newHolding as Record<string, string>)[f.key]}
                      onChange={e => setNewHolding(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      required={f.key !== 'assetSymbol'}
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40" />
                  </div>
                ))}
                {[
                  { key: 'quantity',      label: 'Quantitat (unitats)', placeholder: '10' },
                  { key: 'avgEntryPrice', label: 'Preu entrada mig (€)', placeholder: '82.50' },
                  { key: 'currentPrice',  label: 'Preu actual (€)',      placeholder: '91.20' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-white/50 text-xs mb-1">{f.label}</label>
                    <input
                      type="number" step="0.0001" min="0"
                      value={(newHolding as Record<string, string>)[f.key]}
                      onChange={e => setNewHolding(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      required
                      className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40" />
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <label className="block text-white/50 text-xs mb-1">Notes (opcional)</label>
                <input
                  value={newHolding.notes}
                  onChange={e => setNewHolding(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Context de la posició..."
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Guardant...' : 'Afegir posició'}
                </button>
                <button type="button" onClick={() => setShowAddHolding(false)}
                  className="text-white/40 hover:text-white text-xs px-3 py-2 transition-colors">
                  Cancel·lar
                </button>
              </div>
            </form>
          )}

          {selected.holdings.length === 0 ? (
            <div className="px-5 py-8 text-center text-white/30 text-sm">Sense posicions. Afegeix la primera.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Actiu', 'ISIN', 'Broker', 'Quantitat', 'Preu entrada', 'Preu actual', 'Valor', 'G/P', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-white/30 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selected.holdings.map((h: ClientHolding) => {
                    const invested = h.avgEntryPrice * h.quantity;
                    const current  = h.currentPrice  * h.quantity;
                    const pnl      = current - invested;
                    const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;
                    return (
                      <tr key={h.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-white text-xs font-medium">{h.assetName}</div>
                          <div className="text-white/30 text-xs">{h.assetCategory}</div>
                        </td>
                        <td className="px-4 py-3 text-white/40 text-xs font-mono">{h.assetIsin}</td>
                        <td className="px-4 py-3 text-white/50 text-xs">{h.broker}</td>
                        <td className="px-4 py-3 text-white text-xs">{h.quantity}</td>
                        <td className="px-4 py-3 text-white/70 text-xs">{fEur(h.avgEntryPrice)}</td>
                        <td className="px-4 py-3">
                          {editPriceId === h.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" step="0.01" autoFocus
                                value={newPrice}
                                onChange={e => setNewPrice(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdatePrice(h.id); if (e.key === 'Escape') { setEditPriceId(null); setNewPrice(''); } }}
                                className="w-20 bg-white/10 border border-[#c9a84c]/40 rounded px-2 py-1 text-white text-xs focus:outline-none" />
                              <button onClick={() => handleUpdatePrice(h.id)}
                                className="text-[#c9a84c] text-xs hover:text-[#b8963f]">✓</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditPriceId(h.id); setNewPrice(h.currentPrice.toString()); }}
                              className="text-white/70 text-xs hover:text-[#c9a84c] transition-colors text-left group">
                              {fEur(h.currentPrice)}
                              <span className="ml-1 text-white/20 group-hover:text-[#c9a84c]/60 text-xs">✎</span>
                            </button>
                          )}
                          <div className="text-white/20 text-xs mt-0.5">{h.priceLastUpdated}</div>
                        </td>
                        <td className="px-4 py-3 text-white text-xs font-medium">{fEur(current)}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fEur(pnl)}</div>
                          <div className={`text-xs ${pnl >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>{fPct(pnlPct)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleRemoveHolding(h.id)}
                            className="text-red-400/30 hover:text-red-400 transition-colors text-xs">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Advisor notes */}
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Notes de l&apos;assessor</h3>
            <button onClick={() => setShowAddNote(v => !v)}
              className="text-[#c9a84c] hover:text-[#b8963f] text-xs transition-colors">+ Nova nota</button>
          </div>

          {showAddNote && (
            <form onSubmit={handleAddNote} className="p-5 border-b border-white/10 bg-white/2">
              <textarea
                value={newNote.text}
                onChange={e => setNewNote({ text: e.target.value })}
                placeholder="Escriu la nota per al client..."
                rows={3}
                required
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40 resize-none mb-3" />
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50">
                  {saving ? 'Guardant...' : 'Guardar nota'}
                </button>
                <button type="button" onClick={() => setShowAddNote(false)}
                  className="text-white/40 hover:text-white text-xs px-3 py-2 transition-colors">Cancel·lar</button>
              </div>
            </form>
          )}

          <div className="divide-y divide-white/5 p-5 space-y-3">
            {selected.advisorNotes.length === 0 ? (
              <p className="text-white/30 text-sm">Sense notes.</p>
            ) : [...selected.advisorNotes].reverse().map(n => (
              <div key={n.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/30 text-xs">{n.date}</span>
                  <span className="text-[#c9a84c] text-xs">· {n.author}</span>
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <RecommendationsEditor portfolio={selected} onSaved={updated => { setSelected(updated); setPortfolios(prev => prev.map(p => p.id === updated.id ? updated : p)); }} />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Carteres de clients</h2>
          <p className="text-white/40 text-sm mt-1">Carteres individuals amb posicions reals</p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm px-4 py-2 rounded-lg transition-all">
          + Nova cartera
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreatePortfolio} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold text-sm mb-4">Crear cartera per a un client</h3>
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded px-3 py-2 mb-3 text-red-400 text-sm">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {[
              { key: 'clientId',   label: 'ID del client (de la secció Clients)', placeholder: 'user-1234567890' },
              { key: 'clientName', label: 'Nom del client',                        placeholder: 'Joan García' },
              { key: 'name',       label: 'Nom de la cartera',                     placeholder: 'Cartera Core Moderada' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-white/50 text-xs mb-1">{f.label}</label>
                <input
                  value={(newPortfolio as Record<string, string>)[f.key]}
                  onChange={e => setNewPortfolio(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40" />
              </div>
            ))}
            <div>
              <label className="block text-white/50 text-xs mb-1">Descripció (opcional)</label>
              <input
                value={newPortfolio.description}
                onChange={e => setNewPortfolio(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Cartera d'inversió a llarg termini"
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              {saving ? 'Creant...' : 'Crear cartera'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="text-white/40 hover:text-white text-sm px-3 py-2 transition-colors">Cancel·lar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-3">💼</div>
          <p>Sense carteres de clients. Crea&apos;n una.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portfolios.map(p => {
            const m = computeMetrics(p);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="text-left bg-[#0d1f1a] border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white font-semibold text-sm mb-0.5">{p.name}</div>
                    <div className="text-white/40 text-xs">{p.clientName}</div>
                  </div>
                  <div className={`text-sm font-bold ${m.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fPct(m.pnlPct)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-white/30">Invertit</div><div className="text-white/70">{fEur(m.totalInvested)}</div></div>
                  <div><div className="text-white/30">Actual</div><div className="text-white font-medium">{fEur(m.currentValue)}</div></div>
                  <div><div className="text-white/30">G/P</div><div className={m.pnlEur >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fEur(m.pnlEur)}</div></div>
                </div>
                <div className="mt-3 text-white/20 text-xs">{p.holdings.length} posicions · actualitzat {p.updatedAt}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recommendations editor ───────────────────────────────────────────────────

function RecommendationsEditor({
  portfolio,
  onSaved,
}: {
  portfolio: ClientPortfolio;
  onSaved: (updated: ClientPortfolio) => void;
}) {
  const [text, setText]     = useState(portfolio.recommendations);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleSave() {
    setSaving(true);
    const res  = await fetch(`/api/admin/client-portfolios/${portfolio.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update-meta', recommendations: text }),
    });
    const data = await res.json();
    if (res.ok) { onSaved(data.portfolio); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  return (
    <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Recomanacions per al client</h3>
        {saved && <span className="text-emerald-400 text-xs">✓ Guardat</span>}
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder="Escriu les recomanacions que el client veurà al seu dashboard..."
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40 resize-none mb-3" />
      <button
        onClick={handleSave} disabled={saving}
        className="bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-all">
        {saving ? 'Guardant...' : 'Guardar recomanacions'}
      </button>
    </div>
  );
}
