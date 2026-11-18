'use client';

import { useState, useCallback } from 'react';
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

const INPUT  = 'w-full bg-canvas border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/40 placeholder-ink-muted';
const LABEL  = 'block text-ink-muted text-xs font-medium mb-1';
const BTN_GOLD  = 'px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-bold text-sm rounded-lg disabled:opacity-50 transition-colors';
const BTN_GHOST = 'px-3 py-1.5 bg-subtle hover:bg-subtle-strong text-ink-soft hover:text-ink text-xs rounded-lg transition-colors';

function patchPortfolio(id: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`/api/admin/client-portfolios/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export function AlertsBar({ portfolios }: { portfolios: ClientPortfolio[] }) {
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
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <p className="text-warning text-sm font-semibold mb-1">⚠ Preus sense actualitzar (+30 dies)</p>
          <p className="text-warning/70 text-xs">
            {stale.slice(0, 5).map(s => `${s.name} (${s.client})`).join(' · ')}
            {stale.length > 5 ? ` i ${stale.length - 5} més` : ''}
          </p>
        </div>
      )}
      {noFollowup.length > 0 && (
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <p className="text-info text-sm font-semibold mb-1">Clients sense proper seguiment definit</p>
          <p className="text-info/70 text-xs">
            {noFollowup.slice(0, 5).map(p => p.clientName).join(' · ')}
            {noFollowup.length > 5 ? ` i ${noFollowup.length - 5} més` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Holdings tab ─────────────────────────────────────────────────────────────

const PRICE_SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  fmp:     { label: 'FMP',     cls: 'text-positive/70' },
  manual:  { label: 'Manual',  cls: 'text-warning/70'   },
  pending: { label: 'Pendent', cls: 'text-ink-muted'        },
};

function HoldingsTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const emptyH = { assetIsin: '', assetName: '', assetSymbol: '', assetCategory: '', broker: '', quantity: '', avgEntryPrice: '', commission: '', currency: 'EUR', notes: '', date: today };
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
    const price      = fetchedPrice ?? (parseFloat(manualPrice) || 0);
    const qty        = parseFloat(form.quantity);
    const entryPrice = parseFloat(form.avgEntryPrice);
    const total      = Math.round(qty * entryPrice * 100) / 100;
    setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-holding',
      holding: {
        assetIsin:     form.assetIsin,
        assetName:     form.assetName,
        assetSymbol:   form.assetSymbol || undefined,
        assetCategory: form.assetCategory,
        broker:        form.broker,
        quantity:      qty,
        avgEntryPrice: entryPrice,
        currentPrice:  price,
        priceSource:   priceSource,
        currency:      form.currency,
        notes:         form.notes || undefined,
      },
    });
    // Register buy transaction automatically
    if (form.date && qty > 0) {
      await patchPortfolio(portfolio.id, {
        action: 'add-transaction',
        transaction: {
          operationType: 'buy',
          ticker:        form.assetSymbol || undefined,
          assetName:     form.assetName,
          date:          form.date,
          quantity:      qty,
          priceEur:      entryPrice,
          totalEur:      total,
          commission:    parseFloat(form.commission) || 0,
          broker:        form.broker,
          notes:         form.notes || undefined,
        },
      });
    }
    setSaving(false); reload();
    setForm({ ...emptyH, date: today }); setFetchedPrice(null); setManualPrice(''); setPriceMsg(''); setShowManualPrice(false); setPriceSource('pending');
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

  const activeHoldings  = portfolio.holdings.filter(h => h.quantity > 0);
  const pendingHoldings = portfolio.holdings.filter(h => h.quantity === 0);
  const totalVal   = activeHoldings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
  const hasSymbols = portfolio.holdings.some(h => h.assetSymbol);

  return (
    <div className="space-y-4">
      {portfolio.holdings.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted text-xs">{activeHoldings.length} posicions actives{pendingHoldings.length > 0 ? ` · ${pendingHoldings.length} proposades` : ''}</span>
            {hasSymbols && (
              <button onClick={refreshAllPrices} disabled={refreshing} className={BTN_GHOST}>
                {refreshing ? '↻ Actualitzant...' : '↻ Actualitzar tots els preus'}
              </button>
            )}
          </div>

          {/* Active holdings table */}
          {activeHoldings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-muted text-xs font-medium border-b border-line">
                    {['Actiu', 'Qttat', 'P.Compra', 'P.Actual', 'Valor', 'P&L', 'Pes', 'Actualitzat', ''].map(h => (
                      <th key={h} className={`pb-2 font-medium ${h === 'Actiu' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {activeHoldings.map(h => {
                    const val      = h.currentPrice * h.quantity;
                    const cost     = h.avgEntryPrice * h.quantity;
                    const pnl      = val - cost;
                    const pnlPct   = cost > 0 ? (pnl / cost) * 100 : 0;
                    const weight   = totalVal > 0 ? (val / totalVal) * 100 : 0;
                    const srcBadge = PRICE_SOURCE_BADGE[h.priceSource ?? 'pending'];
                    return (
                      <tr key={h.id}>
                        <td className="py-2.5 pr-4">
                          <div className="text-ink text-xs font-medium">{h.assetName}</div>
                          <div className="text-ink-muted text-xs">{h.assetSymbol || h.assetIsin || h.assetCategory}</div>
                        </td>
                        <td className="py-2.5 text-right text-ink-soft text-xs">{h.quantity}</td>
                        <td className="py-2.5 text-right text-ink-soft text-xs">{fEur(h.avgEntryPrice)}</td>
                        <td className="py-2.5 text-right text-xs">
                          {editPrice?.id === h.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number" step="0.01"
                                value={editPrice.value}
                                onChange={e => setEditPrice({ id: h.id, value: e.target.value })}
                                className="w-20 bg-canvas border border-accent/40 rounded px-2 py-1 text-ink text-xs"
                              />
                              <button onClick={() => savePrice(h.id)} className="text-accent text-xs hover:underline">✓</button>
                              <button onClick={() => setEditPrice(null)} className="text-ink-muted text-xs hover:text-ink">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => setEditPrice({ id: h.id, value: String(h.currentPrice) })}
                                className="text-ink hover:text-accent transition-colors" title="Clic per editar manualment">
                                {fEur(h.currentPrice)}
                              </button>
                              <span className={`text-xs ${srcBadge.cls}`}>{srcBadge.label}</span>
                              {h.assetSymbol && (
                                <button onClick={() => refreshSinglePrice(h)} title="Actualitzar preu" className="text-ink-muted hover:text-accent text-xs transition-colors">↻</button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-right text-ink text-xs font-medium">{fEur(val)}</td>
                        <td className={`py-2.5 text-right text-xs font-medium ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {fEur(pnl)} <span className="opacity-70">({fPct(pnlPct)})</span>
                        </td>
                        <td className="py-2.5 text-right text-ink-muted text-xs">{weight.toFixed(1)}%</td>
                        <td className="py-2.5 text-right text-ink-muted text-xs">{h.priceLastUpdated || '—'}</td>
                        <td className="py-2.5 pl-2">
                          <button onClick={() => removeH(h.id)} className="text-ink-muted hover:text-negative transition-colors text-xs">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Proposed (pending) holdings */}
          {pendingHoldings.length > 0 && (
            <div>
              <p className="text-ink-muted text-xs font-medium mb-2">Propostes de cartera (pendents de compra)</p>
              <div className="space-y-1.5">
                {pendingHoldings.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-subtle border border-line rounded-lg px-4 py-2.5 opacity-60">
                    <div>
                      <span className="text-ink text-xs font-medium">{h.assetName}</span>
                      {h.assetSymbol && <span className="text-ink-muted text-xs ml-1.5">({h.assetSymbol})</span>}
                      <span className="text-ink-muted text-xs ml-2">{h.assetCategory}</span>
                      {h.notes && <span className="text-accent/50 text-xs ml-2">{h.notes.split('·')[0]?.trim()}</span>}
                    </div>
                    <button onClick={() => removeH(h.id)} className="text-ink-muted hover:text-negative transition-colors text-xs ml-4">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <details className="group">
        <summary className="cursor-pointer text-accent/70 text-xs hover:text-accent transition-colors select-none">+ Registrar compra real</summary>
        <form onSubmit={addHolding} className="mt-3 bg-canvas border border-line rounded-lg p-4 space-y-3">
          <p className="text-ink-muted text-xs">Introdueix les dades reals de la compra. El preu actual s&apos;obtindrà automàticament via API.</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Nom actiu *</label><input required value={form.assetName} onChange={e => setForm(p => ({ ...p, assetName: e.target.value }))} placeholder="iShares MSCI World" className={INPUT} /></div>
            <div><label className={LABEL}>ISIN</label><input value={form.assetIsin} onChange={e => setForm(p => ({ ...p, assetIsin: e.target.value }))} placeholder="IE00B4L5Y983" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Ticker (símbol API)</label>
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

          {/* Live price status */}
          {(fetchingPrice || priceMsg) && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              fetchedPrice
                ? 'text-positive bg-positive/10 border-positive/20'
                : priceMsg.includes('manualment')
                  ? 'text-warning bg-warning/10 border-warning/20'
                  : 'text-ink-muted bg-subtle border-line'
            }`}>
              {fetchingPrice ? '↻ Buscant preu actual...' : priceMsg}
            </div>
          )}
          {showManualPrice && (
            <div>
              <label className={LABEL}>Preu actual de mercat (manual) *</label>
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

          <div className="grid grid-cols-4 gap-3">
            <div><label className={LABEL}>Data compra *</label><input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={INPUT} /></div>
            <div><label className={LABEL}>Participacions *</label><input required type="number" step="0.001" min="0.001" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="10" className={INPUT} /></div>
            <div><label className={LABEL}>Preu de compra *</label><input required type="number" step="0.01" min="0" value={form.avgEntryPrice} onChange={e => setForm(p => ({ ...p, avgEntryPrice: e.target.value }))} placeholder="85.00" className={INPUT} /></div>
            <div><label className={LABEL}>Comissió (€)</label><input type="number" step="0.01" min="0" value={form.commission} onChange={e => setForm(p => ({ ...p, commission: e.target.value }))} placeholder="0.00" className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Moneda</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={INPUT}>
                <option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option>
              </select>
            </div>
            <div><label className={LABEL}>Notes</label><input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={INPUT} /></div>
          </div>
          {form.quantity && form.avgEntryPrice && (
            <p className="text-ink-muted text-xs">
              Import total: {fEur(parseFloat(form.quantity) * parseFloat(form.avgEntryPrice) || 0)}
              {form.commission ? ` + ${form.commission} € comissió` : ''}
            </p>
          )}
          <button type="submit" disabled={saving || fetchingPrice || (!fetchedPrice && showManualPrice && !manualPrice)} className={BTN_GOLD}>
            {saving ? 'Registrant...' : 'Registrar compra'}
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
        <form onSubmit={addTx} className="bg-canvas border border-line rounded-lg p-4 space-y-3">
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
        <p className="text-ink-muted text-sm text-center py-10">Sense transaccions registrades.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((tx: ClientTransaction) => {
            const meta = OP_META[tx.operationType];
            return (
              <div key={tx.id} className="bg-surface border border-line rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ color: meta.color, backgroundColor: meta.bg }}>{meta.label}</span>
                  <div>
                    <div className="text-ink text-sm">
                      {tx.assetName || tx.ticker || '—'}
                      {tx.ticker && tx.assetName && <span className="text-ink-muted text-xs ml-1">({tx.ticker})</span>}
                    </div>
                    <div className="text-ink-muted text-xs">
                      {tx.date} · {tx.broker || 'Broker no especificat'}
                      {tx.commission > 0 ? ` · Comissió: ${fEur(tx.commission)}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-ink font-medium text-sm">{fEur(tx.totalEur)}</div>
                    {tx.quantity > 0 && <div className="text-ink-muted text-xs">{tx.quantity} × {fEur(tx.priceEur)}</div>}
                  </div>
                  <button onClick={() => removeTx(tx.id)} className="text-ink-muted hover:text-negative text-xs transition-colors">✕</button>
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
      <div className="bg-canvas border border-line rounded-lg p-4">
        <p className="text-ink-muted text-xs mb-3">Registra el valor total de la cartera en una data concreta per construir l&apos;historial real d&apos;evolució.</p>
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
        <div className="bg-surface border border-line rounded-lg p-4">
          <p className="text-ink-muted text-xs mb-3">Evolució del valor (basada en snapshots manuals)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e8e6" />
              <XAxis dataKey="date" tick={{ fill: '#5f6b67', fontSize: 10 }} />
              <YAxis tick={{ fill: '#5f6b67', fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
              <ReTT
                formatter={(v: number) => [fEur(v), 'Valor']}
                contentStyle={{ background: 'rgb(var(--c-surface))', border: '1px solid rgb(var(--c-line))', borderRadius: 8 }}
                labelStyle={{ color: 'rgb(var(--c-ink-soft))' }}
                itemStyle={{ color: 'rgb(var(--c-accent))' }}
              />
              <Line type="monotone" dataKey="valor" stroke="#1e5a47" strokeWidth={2} dot={{ r: 3, fill: '#1e5a47' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {portfolio.snapshots.length === 0 ? (
        <p className="text-ink-muted text-sm text-center py-6">Sense snapshots. Crea el primer per iniciar l&apos;historial.</p>
      ) : (
        <div className="space-y-2">
          {[...portfolio.snapshots].sort((a, b) => b.date.localeCompare(a.date)).map((s: PortfolioSnapshot) => (
            <div key={s.id} className="flex items-center justify-between bg-surface border border-line rounded-lg px-4 py-3">
              <div>
                <span className="text-ink font-medium text-sm">{fEur(s.totalValue)}</span>
                <span className="text-ink-muted text-xs ml-3">{s.date}</span>
                {s.notes && <span className="text-ink-muted text-xs ml-3 italic">{s.notes}</span>}
              </div>
              <button onClick={() => removeSnap(s.id)} className="text-ink-muted hover:text-negative text-xs transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

export function NotesTab({ portfolio, reload }: { portfolio: ClientPortfolio; reload: () => Promise<void> | void }) {
  const [text, setText]       = useState('');
  const [visible, setVisible] = useState(false);   // per defecte interna: millor no ensenyar al client una nota per error
  const [saving, setSaving]   = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault(); if (!text.trim()) return;
    setSaving(true);
    await patchPortfolio(portfolio.id, {
      action: 'add-advisor-note', text: text.trim(),
      author: 'Admin Factor OTC', isVisibleToClient: visible,
    });
    // Esperem la recàrrega: la fitxa triga uns segons i, si no, semblava que la nota no s'havia desat
    await reload(); setSaving(false); setText('');
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
      <form onSubmit={addNote} className="bg-canvas border border-line rounded-lg p-4">
        <label className={LABEL}>Nova nota</label>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          rows={3} placeholder="Escriu una nota d'assessoria..."
          className={`${INPUT} resize-none mb-3`}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} className="accent-accent" />
            <span className="text-ink-soft text-xs">Visible pel client</span>
          </label>
          <button type="submit" disabled={saving || !text.trim()} className={BTN_GOLD}>{saving ? 'Guardant...' : 'Afegir nota'}</button>
        </div>
      </form>

      {portfolio.advisorNotes.length === 0 ? (
        <p className="text-ink-muted text-sm text-center py-10">Sense notes.</p>
      ) : (
        <div className="space-y-3">
          {portfolio.advisorNotes.map((note: AdvisorNote) => (
            <div key={note.id} className="bg-surface border border-line rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-ink-muted text-xs">{note.author} · {note.createdAt.split('T')[0]}</span>
                  <button
                    onClick={() => toggleVisibility(note)}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                      note.isVisibleToClient
                        ? 'bg-positive/15 text-positive hover:bg-positive/25'
                        : 'bg-subtle text-ink-muted hover:bg-subtle-strong'
                    }`}>
                    {note.isVisibleToClient ? 'Client' : 'Intern'}
                  </button>
                </div>
                <button onClick={() => removeNote(note.id)} className="text-ink-muted hover:text-negative text-xs transition-colors flex-shrink-0">✕</button>
              </div>
              <p className="text-ink-soft text-sm leading-relaxed">{note.text}</p>
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
        {portfolio.description && <p className="text-ink-muted text-sm mb-1">{portfolio.description}</p>}
        {portfolio.nextFollowup && <p className="text-accent/60 text-xs">Proper seguiment: {portfolio.nextFollowup}</p>}
      </div>
      <button onClick={() => setEditing(true)} className="text-ink-muted hover:text-ink text-xs transition-colors flex-shrink-0">Editar info</button>
    </div>
  );

  return (
    <form onSubmit={save} className="mb-5 bg-canvas border border-line rounded-lg p-4 space-y-3">
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

// ─── Editor (fitxa del client) ───────────────────────────────────────────────

type DetailTab = 'posicions' | 'transaccions' | 'snapshots';

/**
 * Editor de la cartera activa d'un client: posicions, moviments i evolució.
 * Es mostra dins la fitxa del client (pestanya "Cartera"); és l'únic lloc on
 * s'edita una cartera. Les carteres noves es creen des de la Proposta.
 */
export function PortfolioEditor({ portfolio: initial, onChange }: { portfolio: ClientPortfolio; onChange?: () => void }) {
  const [portfolio, setPortfolio] = useState(initial);
  const [tab, setTab]             = useState<DetailTab>('posicions');
  const [loading, setLoading]     = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/client-portfolios/${portfolio.id}`);
    const data = await res.json() as { portfolio: ClientPortfolio };
    if (data.portfolio) setPortfolio(data.portfolio);
    setLoading(false);
    onChange?.();
  }, [portfolio.id, onChange]);

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'posicions',    label: `Posicions (${portfolio.holdings.filter(h => h.quantity > 0).length})` },
    { id: 'transaccions', label: `Moviments (${portfolio.transactions.length})` },
    { id: 'snapshots',    label: 'Evolució' },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-ink font-semibold">{portfolio.name}</h3>
          <p className="text-ink-soft text-xs">{portfolio.description || 'Sense descripció'}</p>
        </div>
        {loading && <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
      </div>

      <MetaEditor portfolio={portfolio} reload={reload} />

      <div className="flex border-b border-line mb-5 gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-ink-muted hover:text-ink'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posicions'    && <HoldingsTab     portfolio={portfolio} reload={reload} />}
      {tab === 'transaccions' && <TransactionsTab portfolio={portfolio} reload={reload} />}
      {tab === 'snapshots'    && <SnapshotsTab    portfolio={portfolio} reload={reload} />}
    </div>
  );
}
