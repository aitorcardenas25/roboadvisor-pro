'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTT, ResponsiveContainer,
} from 'recharts';
import type { ClientPortfolio, ClientTransaction, PortfolioSnapshot, AdvisorNote, OperationType } from '@/lib/clientPortfolios';
import { computeMetrics } from '@/lib/clientPortfolios';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fEur(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M€`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)} K€`;
  return `${n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`; }

const OP_META: Record<OperationType, { label: string; color: string; bg: string }> = {
  buy:        { label: 'Compra',      color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  sell:       { label: 'Venda',       color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  deposit:    { label: 'Aportació',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)'  },
  withdrawal: { label: 'Retirada',    color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
  rebalance:  { label: 'Rebalanceig', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
};

const INPUT  = 'w-full bg-[#0a0f0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40 placeholder-white/20';
const LABEL  = 'block text-white/40 text-xs uppercase tracking-wide mb-1';
const BTN_GOLD  = 'px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-bold text-sm rounded-lg disabled:opacity-50 transition-colors';
const BTN_GHOST = 'px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-lg transition-colors';

function patchPortfolio(id: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/admin/client-portfolios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

function AlertsBar({ portfolios }: { portfolios: ClientPortfolio[] }) {
  const today     = new Date().toISOString().split('T')[0];
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];

  const stale = portfolios.flatMap(p =>
    p.holdings
      .filter(h => !h.priceLastUpdated || h.priceLastUpdated < thirtyAgo)
      .map(h => ({ client: p.clientName, name: h.assetName }))
  );
  const noFollowup = portfolios.filter(p => !p.nextFollowup || p.nextFollowup < today);

  if (stale.length === 0 && noFollowup.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {stale.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <p className="text-amber-400 text-sm font-semibold mb-1">⚠ Preus sense actualitzar (+30 dies)</p>
          <p className="text-amber-400/70 text-xs">
            {stale.slice(0, 5).map(s => `${s.name} (${s.client})`).join(' · ')}
            {stale.length > 5 ? ` i ${stale.length - 5} més` : ''}
          </p>
        </div>
      )}
      {noFollowup.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <p className="text-blue-400 text-sm font-semibold mb-1">📅 Clients sense proper seguiment definit</p>
          <p className="text-blue-400/70 text-xs">
            {noFollowup.slice(0, 5).map(p => p.clientName).join(' · ')}
            {noFollowup.length > 5 ? ` i ${noFollowup.length - 5} més` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateForm({ onCreate }: { onCreate: () => void }) {
  const [form, setForm]     = useState({ clientId: '', clientName: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await fetch('/api/admin/client-portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false); onCreate();
    setForm({ clientId: '', clientName: '', name: '', description: '' });
  }

  return (
    <form onSubmit={submit} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5 mb-6">
      <h3 className="text-white font-semibold text-sm mb-4">Nova cartera client</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className={LABEL}>ID Client (username) *</label>
          <input required value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))} placeholder="joan_garcia" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Nom Client *</label>
          <input required value={form.clientName} onChange={e => setForm(p => ({ ...p, clientName: e.target.value }))} placeholder="Joan García" className={INPUT} />
        </div>
      </div>
      <div className="mb-3">
        <label className={LABEL}>Nom de la cartera *</label>
        <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Cartera principal" className={INPUT} />
      </div>
      <div className="mb-4">
        <label className={LABEL}>Descripció</label>
        <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Cartera de jubilació..." className={INPUT} />
      </div>
      <button type="submit" disabled={saving} className={BTN_GOLD}>{saving ? 'Creant...' : '+ Crear cartera'}</button>
    </form>
  );
}

// ─── Holdings tab ─────────────────────────────────────────────────────────────

const PRICE_SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  fmp:     { label: 'FMP',     cls: 'text-emerald-400/70' },
  manual:  { label: 'Manual',  cls: 'text-amber-400/70'   },
  pending: { label: 'Pendent', cls: 'text-white/25'        },
};

function HoldingsTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const emptyH = { assetIsin: '', assetName: '', assetSymbol: '', assetCategory: '', broker: '', quantity: '', avgEntryPrice: '', currency: 'EUR', notes: '' };
  const [form, setForm]         = useState(emptyH);
  const [saving, setSaving]     = useState(false);
  const [editPrice, setEditPrice] = useState<{ id: string; value: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [fetchedPrice, setFetchedPrice]   = useState<number | null>(null);
  const [priceSource, setPriceSource]     = useState<'fmp' | 'manual' | 'pending'>('pending');
  const [priceMsg, setPriceMsg]   = useState('');
  const [manualPrice, setManualPrice]     = useState('');
  const [showManualPrice, setShowManualPrice] = useState(false);

  async function lookupPrice(symbol: string) {
    if (!symbol.trim()) return;
    setFetchingPrice(true); setPriceMsg(''); setFetchedPrice(null); setShowManualPrice(false);
    try {
      const res  = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(symbol.trim())}`);
      const data = await res.json() as { quote?: { price?: number } };
      if (data.quote?.price) {
        setFetchedPrice(data.quote.price);
        setPriceSource('fmp');
        setPriceMsg(`Preu obtingut: ${data.quote.price.toFixed(2)} € (FMP)`);
        setShowManualPrice(false);
      } else {
        setPriceMsg('No s\'ha trobat el preu. Introdueix-lo manualment.');
        setShowManualPrice(true);
        setPriceSource('manual');
      }
    } catch {
      setPriceMsg('Error de connexió. Introdueix el preu manualment.');
      setShowManualPrice(true);
      setPriceSource('manual');
    } finally {
      setFetchingPrice(false);
    }
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    const price = fetchedPrice ?? (parseFloat(manualPrice) || 0);
    setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-holding',
      holding: {
        assetIsin:     form.assetIsin,
        assetName:     form.assetName,
        assetSymbol:   form.assetSymbol || undefined,
        assetCategory: form.assetCategory,
        broker:        form.broker,
        quantity:      parseFloat(form.quantity),
        avgEntryPrice: parseFloat(form.avgEntryPrice),
        currentPrice:  price,
        priceSource:   priceSource,
        currency:      form.currency,
        notes:         form.notes || undefined,
      },
    });
    setSaving(false); reload();
    setForm(emptyH); setFetchedPrice(null); setManualPrice(''); setPriceMsg(''); setShowManualPrice(false); setPriceSource('pending');
  }

  async function savePrice(holdingId: string) {
    if (!editPrice) return;
    await patchPortfolio(portfolio.id, { action: 'update-price', holdingId, currentPrice: parseFloat(editPrice.value) });
    setEditPrice(null); reload();
  }

  async function refreshSinglePrice(h: { id: string; assetSymbol?: string }) {
    if (!h.assetSymbol) return;
    const res  = await fetch(`/api/market-data/quote?symbol=${encodeURIComponent(h.assetSymbol)}`);
    const data = await res.json() as { quote?: { price?: number } };
    if (data.quote?.price) {
      await patchPortfolio(portfolio.id, { action: 'update-price', holdingId: h.id, currentPrice: data.quote.price });
      reload();
    }
  }

  async function refreshAllPrices() {
    setRefreshing(true);
    await patchPortfolio(portfolio.id, { action: 'refresh-prices' });
    setRefreshing(false); reload();
  }

  async function removeH(holdingId: string) {
    if (!confirm('Eliminar posició?')) return;
    await patchPortfolio(portfolio.id, { action: 'remove-holding', holdingId });
    reload();
  }

  const totalVal = portfolio.holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
  const hasSymbols = portfolio.holdings.some(h => h.assetSymbol);

  return (
    <div className="space-y-4">
      {portfolio.holdings.length > 0 && (
        <>
          {hasSymbols && (
            <div className="flex justify-end">
              <button onClick={refreshAllPrices} disabled={refreshing} className={BTN_GHOST}>
                {refreshing ? '↻ Actualitzant...' : '↻ Actualitzar tots els preus'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wide border-b border-white/5">
                  {['Actiu', 'Qttat', 'P.Entrada', 'P.Actual', 'Valor', 'P&L', 'Pes', 'Actualitzat', ''].map(h => (
                    <th key={h} className={`pb-2 font-medium ${h === 'Actiu' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {portfolio.holdings.map(h => {
                  const val    = h.currentPrice * h.quantity;
                  const cost   = h.avgEntryPrice * h.quantity;
                  const pnl    = val - cost;
                  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                  const weight = totalVal > 0 ? (val / totalVal) * 100 : 0;
                  const srcBadge = PRICE_SOURCE_BADGE[h.priceSource ?? 'pending'];
                  return (
                    <tr key={h.id}>
                      <td className="py-2.5 pr-4">
                        <div className="text-white text-xs font-medium">{h.assetName}</div>
                        <div className="text-white/30 text-xs">{h.assetSymbol || h.assetIsin || h.assetCategory}</div>
                      </td>
                      <td className="py-2.5 text-right text-white/60 text-xs">{h.quantity}</td>
                      <td className="py-2.5 text-right text-white/60 text-xs">{fEur(h.avgEntryPrice)}</td>
                      <td className="py-2.5 text-right text-xs">
                        {editPrice?.id === h.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              type="number" step="0.01"
                              value={editPrice.value}
                              onChange={e => setEditPrice({ id: h.id, value: e.target.value })}
                              className="w-20 bg-[#0a0f0d] border border-[#c9a84c]/40 rounded px-2 py-1 text-white text-xs"
                            />
                            <button onClick={() => savePrice(h.id)} className="text-[#c9a84c] text-xs hover:underline">✓</button>
                            <button onClick={() => setEditPrice(null)} className="text-white/30 text-xs hover:text-white">✕</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setEditPrice({ id: h.id, value: String(h.currentPrice) })}
                              className="text-white hover:text-[#c9a84c] transition-colors" title="Clic per editar manualment">
                              {fEur(h.currentPrice)}
                            </button>
                            <span className={`text-xs ${srcBadge.cls}`}>{srcBadge.label}</span>
                            {h.assetSymbol && (
                              <button onClick={() => refreshSinglePrice(h)} title="Actualitzar preu" className="text-white/20 hover:text-[#c9a84c] text-xs transition-colors">↻</button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-white text-xs font-medium">{fEur(val)}</td>
                      <td className={`py-2.5 text-right text-xs font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fEur(pnl)} <span className="opacity-70">({fPct(pnlPct)})</span>
                      </td>
                      <td className="py-2.5 text-right text-white/40 text-xs">{weight.toFixed(1)}%</td>
                      <td className="py-2.5 text-right text-white/30 text-xs">{h.priceLastUpdated || '—'}</td>
                      <td className="py-2.5 pl-2">
                        <button onClick={() => removeH(h.id)} className="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <details className="group">
        <summary className="cursor-pointer text-[#c9a84c]/70 text-xs hover:text-[#c9a84c] transition-colors select-none">+ Afegir posició</summary>
        <form onSubmit={addHolding} className="mt-3 bg-[#080e0b] border border-white/5 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Nom actiu *</label><input required value={form.assetName} onChange={e => setForm(p => ({ ...p, assetName: e.target.value }))} placeholder="iShares MSCI World" className={INPUT} /></div>
            <div><label className={LABEL}>Ticker / ISIN</label><input value={form.assetIsin} onChange={e => setForm(p => ({ ...p, assetIsin: e.target.value }))} placeholder="IE00B4L5Y983" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Símbol (ticker)</label>
              <input
                value={form.assetSymbol}
                onChange={e => { setForm(p => ({ ...p, assetSymbol: e.target.value })); setFetchedPrice(null); setPriceMsg(''); }}
                onBlur={e => lookupPrice(e.target.value)}
                placeholder="IWDA"
                className={INPUT}
              />
            </div>
            <div><label className={LABEL}>Categoria *</label><input required value={form.assetCategory} onChange={e => setForm(p => ({ ...p, assetCategory: e.target.value }))} placeholder="ETF RV Global" className={INPUT} /></div>
            <div><label className={LABEL}>Broker *</label><input required value={form.broker} onChange={e => setForm(p => ({ ...p, broker: e.target.value }))} placeholder="Degiro" className={INPUT} /></div>
          </div>

          {/* Price status */}
          {(fetchingPrice || priceMsg) && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              fetchedPrice
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : priceMsg.includes('manualment')
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-white/40 bg-white/5 border-white/10'
            }`}>
              {fetchingPrice ? '↻ Buscant preu...' : priceMsg}
            </div>
          )}
          {showManualPrice && (
            <div>
              <label className={LABEL}>Preu actual (manual) *</label>
              <input
                required={showManualPrice && !fetchedPrice}
                type="number" step="0.01" min="0"
                value={manualPrice}
                onChange={e => setManualPrice(e.target.value)}
                placeholder="0.00"
                className={INPUT}
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div><label className={LABEL}>Quantitat *</label><input required type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="10" className={INPUT} /></div>
            <div><label className={LABEL}>Preu entrada *</label><input required type="number" step="0.01" min="0" value={form.avgEntryPrice} onChange={e => setForm(p => ({ ...p, avgEntryPrice: e.target.value }))} placeholder="85.00" className={INPUT} /></div>
            <div><label className={LABEL}>Moneda</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={INPUT}>
                <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div><label className={LABEL}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={INPUT} /></div>
          <button type="submit" disabled={saving || fetchingPrice || (!fetchedPrice && showManualPrice && !manualPrice)} className={BTN_GOLD}>
            {saving ? 'Afegint...' : 'Afegir posició'}
          </button>
        </form>
      </details>
    </div>
  );
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

function TransactionsTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const emptyT = { operationType: 'buy' as OperationType, ticker: '', assetName: '', date: today, quantity: '', priceEur: '', totalEur: '', commission: '0', broker: '', notes: '' };
  const [form, setForm]     = useState(emptyT);
  const [saving, setSaving] = useState(false);
  const [show, setShow]     = useState(false);

  async function addTx(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-transaction',
      transaction: {
        operationType: form.operationType,
        ticker:        form.ticker || undefined,
        assetName:     form.assetName || undefined,
        date:          form.date,
        quantity:      parseFloat(form.quantity) || 0,
        priceEur:      parseFloat(form.priceEur)  || 0,
        totalEur:      parseFloat(form.totalEur)  || 0,
        commission:    parseFloat(form.commission) || 0,
        broker:        form.broker,
        notes:         form.notes || undefined,
      },
    });
    setSaving(false); reload(); setForm(emptyT); setShow(false);
  }

  async function removeTx(txId: string) {
    if (!confirm('Eliminar transacció?')) return;
    await patchPortfolio(portfolio.id, { action: 'remove-transaction', transactionId: txId });
    reload();
  }

  const sorted = [...portfolio.transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShow(!show)} className={BTN_GHOST}>{show ? '✕ Cancel·lar' : '+ Nova transacció'}</button>
      </div>

      {show && (
        <form onSubmit={addTx} className="bg-[#080e0b] border border-white/5 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><label className={LABEL}>Tipus *</label>
              <select value={form.operationType} onChange={e => setForm(p => ({ ...p, operationType: e.target.value as OperationType }))} className={INPUT}>
                {(Object.keys(OP_META) as OperationType[]).map(op => (
                  <option key={op} value={op}>{OP_META[op].label}</option>
                ))}
              </select>
            </div>
            <div><label className={LABEL}>Data *</label><input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} /></div>
            <div><label className={LABEL}>Broker</label><input value={form.broker} onChange={e => setForm(p => ({ ...p, broker: e.target.value }))} placeholder="Degiro" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Ticker</label><input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} placeholder="IWDA" className={INPUT} /></div>
            <div><label className={LABEL}>Nom actiu</label><input value={form.assetName} onChange={e => setForm(p => ({ ...p, assetName: e.target.value }))} placeholder="iShares MSCI World" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className={LABEL}>Quantitat</label><input type="number" step="0.001" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="10" className={INPUT} /></div>
            <div><label className={LABEL}>Preu unitari (€)</label><input type="number" step="0.01" min="0" value={form.priceEur} onChange={e => setForm(p => ({ ...p, priceEur: e.target.value }))} placeholder="92.50" className={INPUT} /></div>
            <div><label className={LABEL}>Total (€) *</label><input required type="number" step="0.01" min="0" value={form.totalEur} onChange={e => setForm(p => ({ ...p, totalEur: e.target.value }))} placeholder="925.00" className={INPUT} /></div>
            <div><label className={LABEL}>Comissió (€)</label><input type="number" step="0.01" min="0" value={form.commission} onChange={e => setForm(p => ({ ...p, commission: e.target.value }))} placeholder="0.00" className={INPUT} /></div>
          </div>
          <div><label className={LABEL}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={INPUT} /></div>
          <button type="submit" disabled={saving} className={BTN_GOLD}>{saving ? 'Registrant...' : 'Registrar transacció'}</button>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-10">Sense transaccions registrades.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((tx: ClientTransaction) => {
            const meta = OP_META[tx.operationType];
            return (
              <div key={tx.id} className="bg-[#0d1f1a] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                  <div>
                    <div className="text-white text-sm">
                      {tx.assetName || tx.ticker || '—'}
                      {tx.ticker && tx.assetName && <span className="text-white/30 text-xs ml-1">({tx.ticker})</span>}
                    </div>
                    <div className="text-white/30 text-xs">
                      {tx.date} · {tx.broker || 'Broker no especificat'}
                      {tx.commission > 0 ? ` · Comissió: ${fEur(tx.commission)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-white font-medium text-sm">{fEur(tx.totalEur)}</div>
                    {tx.quantity > 0 && <div className="text-white/30 text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>}
                  </div>
                  <button onClick={() => removeTx(tx.id)} className="text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Snapshots tab ────────────────────────────────────────────────────────────

function SnapshotsTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const today   = new Date().toISOString().split('T')[0];
  const metrics = computeMetrics(portfolio);
  const [form, setForm]     = useState({ date: today, totalValue: metrics.currentValue > 0 ? String(metrics.currentValue) : '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function addSnap(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-snapshot',
      date:       form.date,
      totalValue: parseFloat(form.totalValue),
      notes:      form.notes || undefined,
    });
    setSaving(false); reload(); setForm(p => ({ ...p, notes: '' }));
  }

  async function removeSnap(snapId: string) {
    if (!confirm('Eliminar snapshot?')) return;
    await patchPortfolio(portfolio.id, { action: 'remove-snapshot', snapshotId: snapId });
    reload();
  }

  const chartData = [...portfolio.snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({ date: s.date, valor: s.totalValue }));

  return (
    <div className="space-y-5">
      <div className="bg-[#080e0b] border border-white/5 rounded-xl p-4">
        <p className="text-white/40 text-xs mb-3">Registra el valor total de la cartera en una data concreta per construir l&apos;historial real d&apos;evolució.</p>
        <form onSubmit={addSnap}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className={LABEL}>Data *</label><input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} /></div>
            <div><label className={LABEL}>Valor total (€) *</label><input required type="number" step="0.01" min="0" value={form.totalValue} onChange={e => setForm(p => ({ ...p, totalValue: e.target.value }))} placeholder="10500.00" className={INPUT} /></div>
            <div><label className={LABEL}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Tancament mensual" className={INPUT} /></div>
          </div>
          <button type="submit" disabled={saving} className={BTN_GOLD}>{saving ? 'Guardant...' : 'Crear snapshot'}</button>
        </form>
      </div>

      {chartData.length >= 2 && (
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
          <p className="text-white/40 text-xs mb-3">Evolució del valor (basada en snapshots manuals)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <ReTT
                formatter={(v: number) => [fEur(v), 'Valor']}
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                itemStyle={{ color: '#c9a84c' }}
              />
              <Line type="monotone" dataKey="valor" stroke="#c9a84c" strokeWidth={2} dot={{ r: 3, fill: '#c9a84c' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {portfolio.snapshots.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-6">Sense snapshots. Crea el primer per iniciar l&apos;historial.</p>
      ) : (
        <div className="space-y-2">
          {[...portfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date)).map((s: PortfolioSnapshot) => (
            <div key={s.id} className="flex items-center justify-between bg-[#0d1f1a] border border-white/5 rounded-xl px-4 py-3">
              <div>
                <span className="text-white font-medium text-sm">{fEur(s.totalValue)}</span>
                <span className="text-white/30 text-xs ml-3">{s.date}</span>
                {s.notes && <span className="text-white/40 text-xs ml-3 italic">{s.notes}</span>}
              </div>
              <button onClick={() => removeSnap(s.id)} className="text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const [text, setText]       = useState('');
  const [visible, setVisible] = useState(true);
  const [saving, setSaving]   = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault(); if (!text.trim()) return;
    setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-advisor-note', text: text.trim(),
      author: 'Admin Factor OTC', isVisibleToClient: visible,
    });
    setSaving(false); reload(); setText('');
  }

  async function toggleVisibility(note: AdvisorNote) {
    await patchPortfolio(portfolio.id, { action: 'update-advisor-note', noteId: note.id, isVisibleToClient: !note.isVisibleToClient });
    reload();
  }

  async function removeNote(noteId: string) {
    if (!confirm('Eliminar nota?')) return;
    await patchPortfolio(portfolio.id, { action: 'remove-advisor-note', noteId });
    reload();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addNote} className="bg-[#080e0b] border border-white/5 rounded-xl p-4">
        <label className={LABEL}>Nova nota</label>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          rows={3} placeholder="Escriu una nota d'assessoria..."
          className={`${INPUT} resize-none mb-3`}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} className="accent-[#c9a84c]" />
            <span className="text-white/50 text-xs">Visible pel client</span>
          </label>
          <button type="submit" disabled={saving || !text.trim()} className={BTN_GOLD}>{saving ? 'Guardant...' : 'Afegir nota'}</button>
        </div>
      </form>

      {portfolio.advisorNotes.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-10">Sense notes.</p>
      ) : (
        <div className="space-y-3">
          {portfolio.advisorNotes.map((note: AdvisorNote) => (
            <div key={note.id} className="bg-[#0d1f1a] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs">{note.author} · {note.createdAt.split('T')[0]}</span>
                  <button
                    onClick={() => toggleVisibility(note)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      note.isVisibleToClient
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-white/5 text-white/30 hover:bg-white/10'
                    }`}>
                    {note.isVisibleToClient ? '👁 Client' : '🔒 Intern'}
                  </button>
                </div>
                <button onClick={() => removeNote(note.id)} className="text-white/20 hover:text-red-400 text-xs transition-colors flex-shrink-0">✕</button>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Meta editor ─────────────────────────────────────────────────────────────

function MetaEditor({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    name:            portfolio.name,
    description:     portfolio.description,
    recommendations: portfolio.recommendations,
    nextFollowup:    portfolio.nextFollowup ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'update-meta', ...form,
      nextFollowup: form.nextFollowup || undefined,
    });
    setSaving(false); reload(); setEditing(false);
  }

  if (!editing) return (
    <div className="mb-5 flex items-start justify-between">
      <div>
        {portfolio.description && <p className="text-white/40 text-sm mb-1">{portfolio.description}</p>}
        {portfolio.nextFollowup && <p className="text-[#c9a84c]/60 text-xs">Proper seguiment: {portfolio.nextFollowup}</p>}
      </div>
      <button onClick={() => setEditing(true)} className="text-white/30 hover:text-white text-xs transition-colors flex-shrink-0">Editar info</button>
    </div>
  );

  return (
    <form onSubmit={save} className="mb-5 bg-[#080e0b] border border-white/5 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={LABEL}>Nom cartera</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={INPUT} /></div>
        <div><label className={LABEL}>Proper seguiment</label><input type="date" value={form.nextFollowup} onChange={e => setForm(p => ({ ...p, nextFollowup: e.target.value }))} className={INPUT} /></div>
      </div>
      <div><label className={LABEL}>Descripció</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={INPUT} /></div>
      <div><label className={LABEL}>Recomanacions visibles al client</label>
        <textarea value={form.recommendations} onChange={e => setForm(p => ({ ...p, recommendations: e.target.value }))} rows={2} className={`${INPUT} resize-none`} />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={BTN_GOLD}>{saving ? 'Guardant...' : 'Guardar'}</button>
        <button type="button" onClick={() => setEditing(false)} className={BTN_GHOST}>Cancel·lar</button>
      </div>
    </form>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────────────

type DetailTab = 'posicions' | 'transaccions' | 'snapshots' | 'notes';

function PortfolioDetail({ portfolio: initial, onBack }: { portfolio: ClientPortfolio; onBack: () => void }) {
  const [portfolio, setPortfolio] = useState(initial);
  const [tab, setTab]             = useState<DetailTab>('posicions');
  const [loading, setLoading]     = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/client-portfolios/${portfolio.id}`);
    const data = await res.json() as { portfolio: ClientPortfolio };
    if (data.portfolio) setPortfolio(data.portfolio);
    setLoading(false);
  }, [portfolio.id]);

  const metrics = computeMetrics(portfolio);

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'posicions',    label: `Posicions (${portfolio.holdings.length})`    },
    { id: 'transaccions', label: `Transaccions (${portfolio.transactions.length})` },
    { id: 'snapshots',    label: `Snapshots (${portfolio.snapshots.length})`   },
    { id: 'notes',        label: `Notes (${portfolio.advisorNotes.length})`    },
  ];

  return (
    <div>
      <button onClick={onBack} className="text-white/40 hover:text-white text-sm transition-colors mb-4">← Totes les carteres</button>

      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-white font-bold text-xl">{portfolio.name}</h2>
          <p className="text-white/40 text-sm">{portfolio.clientName} · <span className="text-white/20">{portfolio.clientId}</span></p>
        </div>
        {loading && <div className="w-4 h-4 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />}
      </div>

      <MetaEditor portfolio={portfolio} reload={reload} />

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Valor actual',     value: fEur(metrics.currentValue),    colored: false },
          { label: 'Rendibilitat (€)', value: fEur(metrics.pnlEur),          colored: true  },
          { label: 'Rendibilitat (%)', value: fPct(metrics.pnlPct),          colored: true  },
          { label: 'Inversió neta',    value: fEur(metrics.netContributions > 0 ? metrics.netContributions : metrics.totalInvested), colored: false },
        ].map(k => (
          <div key={k.label} className="bg-[#0d1f1a] border border-white/10 rounded-xl p-4">
            <div className={`font-bold text-lg ${k.colored ? (metrics.pnlEur >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-[#c9a84c]'}`}>{k.value}</div>
            {k.label === 'Valor actual' && metrics.lastUpdated && <div className="text-white/30 text-xs mt-0.5">Actualitzat: {metrics.lastUpdated}</div>}
            <div className="text-white/40 text-xs mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-white/10 mb-5 gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-[#c9a84c] border-b-2 border-[#c9a84c]'
                : 'text-white/40 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posicions'    && <HoldingsTab     portfolio={portfolio} reload={reload} />}
      {tab === 'transaccions' && <TransactionsTab portfolio={portfolio} reload={reload} />}
      {tab === 'snapshots'    && <SnapshotsTab    portfolio={portfolio} reload={reload} />}
      {tab === 'notes'        && <NotesTab        portfolio={portfolio} reload={reload} />}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientPortfoliosManager() {
  const [portfolios, setPortfolios] = useState<ClientPortfolio[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<ClientPortfolio | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch]         = useState('');
  const [deleting, setDeleting]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/client-portfolios');
      const data = await res.json() as { portfolios: ClientPortfolio[] };
      setPortfolios(data.portfolios ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deletePortfolio(p: ClientPortfolio, e: React.MouseEvent) {
    e.stopPropagation();
    const warnings: string[] = [];
    if (p.holdings.length > 0)     warnings.push(`${p.holdings.length} posicions`);
    if (p.transactions.length > 0) warnings.push(`${p.transactions.length} transaccions`);
    if (p.advisorNotes.length > 0) warnings.push(`${p.advisorNotes.length} notes`);
    const detail = warnings.length > 0 ? `\n\nConté: ${warnings.join(', ')}.` : '';
    if (!confirm(`Eliminar la cartera "${p.name}" de ${p.clientName}?${detail}\n\nAquesta acció no es pot desfer.`)) return;
    setDeleting(p.id);
    await fetch(`/api/admin/client-portfolios/${p.id}`, { method: 'DELETE' });
    setDeleting(null);
    load();
  }

  const filtered = portfolios.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.clientName.toLowerCase().includes(q) || p.clientId.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  if (selected) {
    return <PortfolioDetail portfolio={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white font-bold text-xl">Carteres Clients</h2>
          <p className="text-white/40 text-sm mt-1">{portfolios.length} cartera{portfolios.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={BTN_GHOST}>↻ Actualitzar</button>
          <button onClick={() => setShowCreate(!showCreate)} className={BTN_GOLD}>
            {showCreate ? 'Cancel·lar' : '+ Nova cartera'}
          </button>
        </div>
      </div>

      {!loading && portfolios.length > 0 && <AlertsBar portfolios={portfolios} />}

      {showCreate && <CreateForm onCreate={() => { setShowCreate(false); load(); }} />}

      {!loading && portfolios.length > 1 && (
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cercar per client, ID o nom de cartera..."
          className={INPUT + ' mb-4'}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <div className="text-4xl mb-3">💼</div>
          <p>Sense carteres. Crea la primera cartera d&apos;un client.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-10 text-white/30 text-sm">Sense resultats per &ldquo;{search}&rdquo;</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const m = computeMetrics(p);
            return (
              <div key={p.id}
                onClick={() => setSelected(p)}
                className="bg-[#0d1f1a] border border-white/10 rounded-xl p-5 cursor-pointer hover:border-[#c9a84c]/30 transition-colors group">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-semibold">{p.name}</p>
                    <p className="text-white/40 text-sm">{p.clientName} <span className="text-white/20">·</span> <span className="text-white/20 text-xs">{p.clientId}</span></p>
                    {p.nextFollowup && <p className="text-[#c9a84c]/50 text-xs mt-0.5">Seguiment: {p.nextFollowup}</p>}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="text-white font-bold">{fEur(m.currentValue)}</div>
                        <div className="text-white/30 text-xs">Valor actual</div>
                      </div>
                      <div>
                        <div className={`font-bold ${m.pnlEur >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fPct(m.pnlPct)}</div>
                        <div className="text-white/30 text-xs">{fEur(m.pnlEur)}</div>
                      </div>
                      <div>
                        <div className="text-white/60 text-sm">{m.holdingCount}</div>
                        <div className="text-white/30 text-xs">posicions</div>
                      </div>
                    </div>
                    <button
                      onClick={e => deletePortfolio(p, e)}
                      disabled={deleting === p.id}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all text-sm p-1"
                      title="Eliminar cartera">
                      {deleting === p.id ? '...' : '✕'}
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
