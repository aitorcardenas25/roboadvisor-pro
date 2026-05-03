'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { MarketAnalysis } from '@/lib/technicalAnalysis';
import SignalPanel from '@/components/trading/SignalPanel';
import type { TrackedStock, StockSignal } from '@/lib/stockTracker';
import { SIGNAL_META } from '@/lib/stockTracker';
import type { Quote } from '@/services/quotes';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Lazy-load chart to avoid SSR issues with DOM APIs
const CandlestickChart = dynamic(() => import('@/components/trading/CandlestickChart'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockWithQuote extends TrackedStock { quote?: Quote }
const SIGNAL_ORDER: StockSignal[] = ['oportunitat', 'vigilancia', 'neutral', 'risc-elevat'];

const TIMEFRAMES = ['15m', '1h', '4h', '1d'] as const;
type Timeframe = typeof TIMEFRAMES[number];

const CRYPTO_EXAMPLES = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const STOCK_EXAMPLES  = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META'];

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="border-b border-[#1a3a2a]/70 px-6 py-4 sticky top-0 z-20 bg-[#080e0b]/92 backdrop-blur"
      style={{ boxShadow: '0 1px 0 rgba(26,58,42,0.3)' }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center">
            <span className="text-[#c9a84c] font-black text-[10px] leading-none">F</span>
          </div>
          <span className="text-white font-black text-sm tracking-wider">FACTOR</span>
          <span className="text-[#2d6a4f] font-light text-sm tracking-widest">OTC</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/noticies"   className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors text-xs uppercase tracking-widest">Notícies</Link>
          <Link href="/comparador"      className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors text-xs uppercase tracking-widest">Comparador</Link>
          <Link href="/accions"         className="text-[#c9a84c] font-semibold text-xs uppercase tracking-widest">Accions</Link>
          <Link href="/informe-bursatil" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors text-xs uppercase tracking-widest">Informe</Link>
          <Link href="/admin"           className="text-[#1a3a2a] hover:text-[#2d6a4f] transition-colors text-xs uppercase tracking-widest border border-[#1a3a2a] hover:border-[#2d6a4f]/40 px-2 py-0.5 rounded">Admin</Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────

function AnalysisTab() {
  const [assetType, setAssetType] = useState<'stock' | 'crypto'>('stock');
  const [symbol, setSymbol]       = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<MarketAnalysis | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const runAnalysis = useCallback(async (sym?: string) => {
    const s = (sym ?? symbol).trim().toUpperCase();
    if (!s) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/analysis?symbol=${encodeURIComponent(s)}&asset_type=${assetType}&timeframe=${timeframe}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error desconegut'); return; }
      setResult(data as MarketAnalysis);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [symbol, assetType, timeframe]);

  const handleQuick = (sym: string) => {
    setSymbol(sym);
    runAnalysis(sym);
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        {/* Asset type toggle */}
        <div className="flex gap-2 mb-4">
          {(['stock', 'crypto'] as const).map(t => (
            <button key={t} onClick={() => setAssetType(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${assetType === t ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
              {t === 'stock' ? '📊 Accions' : '₿ Cripto'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && runAnalysis()}
            placeholder={assetType === 'stock' ? 'AAPL, NVDA, TSLA...' : 'BTC/USDT, ETH/USDT...'}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#c9a84c]/50"
          />
          {/* Timeframe */}
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-3 py-2 rounded-xl text-xs font-mono transition-all ${timeframe === tf ? 'bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                {tf}
              </button>
            ))}
          </div>
          <button
            onClick={() => runAnalysis()}
            disabled={loading || !symbol}
            className="px-5 py-2.5 bg-[#c9a84c] text-[#0d1f1a] rounded-xl text-sm font-bold hover:bg-[#d4b560] transition-colors disabled:opacity-40">
            {loading ? '...' : 'Analitzar'}
          </button>
        </div>

        {/* Quick picks */}
        <div className="mt-3 flex flex-wrap gap-2">
          {(assetType === 'stock' ? STOCK_EXAMPLES : CRYPTO_EXAMPLES).map(s => (
            <button key={s} onClick={() => handleQuick(s)}
              className="px-3 py-1 text-xs bg-white/5 text-white/40 hover:text-white/70 rounded-lg border border-white/8 hover:border-white/20 transition-all font-mono">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="bg-white/3 border border-white/8 rounded-2xl h-[360px] animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="bg-white/3 border border-white/8 rounded-2xl h-48 animate-pulse" />)}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Title bar + price stats */}
          {(() => {
            const last    = result.candles[result.candles.length - 1];
            const prev    = result.candles[result.candles.length - 2];
            const chg     = last && prev ? ((last.close - prev.close) / prev.close) * 100 : null;
            const isUp    = (chg ?? 0) >= 0;
            const dayHigh = last?.high ?? 0;
            const dayLow  = last?.low  ?? 0;
            return (
              <div className="bg-white/3 border border-white/8 rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-white font-black text-2xl tracking-tight">{result.symbol}</span>
                    <span className="text-white/30 text-xs ml-3 font-mono">{result.timeframe} · {result.asset_type === 'crypto' ? 'Cripto' : 'Acció'}</span>
                  </div>
                  {last && (
                    <div className="text-right">
                      <p className="text-[#c9a84c] font-mono font-black text-xl leading-none">{formatPrice(last.close)}</p>
                      {chg !== null && (
                        <p className={`text-sm font-mono font-semibold mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          {isUp ? '+' : ''}{chg.toFixed(2)}%
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {last && (
                  <div className="flex gap-5 text-xs font-mono text-white/35">
                    {dayHigh > 0 && <span>H <span className="text-white/55">{formatPrice(dayHigh)}</span></span>}
                    {dayLow  > 0 && <span>L <span className="text-white/55">{formatPrice(dayLow)}</span></span>}
                    {(result.indicators.support ?? 0) > 0    && <span>Sup <span className="text-green-400/60">{formatPrice(result.indicators.support ?? 0)}</span></span>}
                    {(result.indicators.resistance ?? 0) > 0 && <span>Res <span className="text-red-400/60">{formatPrice(result.indicators.resistance ?? 0)}</span></span>}
                    {last.volume > 0 && <span className="ml-auto">Vol <span className="text-white/55">{formatVolume(last.volume)}</span></span>}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Candlestick chart */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
            <CandlestickChart
              candles={result.candles}
              ema20={result.indicators.ema20}
              ema50={result.indicators.ema50}
              ema200={result.indicators.ema200}
              support={result.indicators.support}
              resistance={result.indicators.resistance}
            />
          </div>

          {/* Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <SignalPanel
                signal={result.signal}
                fundamental={result.fundamental}
                combined={result.combined}
                rsi={result.indicators.rsi}
                macd={result.indicators.macd}
                atr={result.indicators.atr}
                support={result.indicators.support}
                resistance={result.indicators.resistance}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-400/5 border border-amber-400/15 rounded-xl px-4 py-3">
            <p className="text-amber-400/60 text-xs leading-relaxed">
              ⚠️ Anàlisi tècnica i fonamental amb finalitat informativa i educativa. No constitueix recomanació d'inversió. Consulta sempre un assessor financer autoritzat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('ca-ES', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

// ─── Watchlist tab (existing functionality) ───────────────────────────────────

function WatchlistTab() {
  const [stocks, setStocks]         = useState<StockWithQuote[]>([]);
  const [selected, setSelected]     = useState<StockWithQuote | null>(null);
  const [history, setHistory]       = useState<{ date: string; close: number }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [filter, setFilter]         = useState<StockSignal | 'all'>('all');

  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.json())
      .then(async data => {
        const list: TrackedStock[] = data.stocks ?? [];
        const withQuotes = await Promise.all(
          list.map(async s => {
            try {
              const r = await fetch(`/api/stocks/${s.symbol}`);
              if (r.ok) return { ...s, ...(await r.json()) } as StockWithQuote;
            } catch { /* ok */ }
            return s;
          })
        );
        setStocks(withQuotes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectStock = async (s: StockWithQuote) => {
    setSelected(s);
    setLoadingChart(true);
    try {
      const r = await fetch(`/api/market-data?ticker=${encodeURIComponent(s.symbol)}&period=1y`);
      if (r.ok) {
        const d = await r.json();
        setHistory((d.prices ?? []).map((p: { date: string; close: number }) => ({ date: p.date.slice(0, 7), close: p.close })));
      }
    } catch { /* ok */ }
    setLoadingChart(false);
  };

  const filtered = filter === 'all'
    ? [...stocks].sort((a, b) => SIGNAL_ORDER.indexOf(a.signal) - SIGNAL_ORDER.indexOf(b.signal))
    : stocks.filter(s => s.signal === filter);

  return (
    <div>
      {/* Signal filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'}`}>
          Totes ({stocks.length})
        </button>
        {SIGNAL_ORDER.map(sig => {
          const m = SIGNAL_META[sig];
          const cnt = stocks.filter(s => s.signal === sig).length;
          return (
            <button key={sig} onClick={() => setFilter(sig)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${filter === sig ? 'border-transparent' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
              style={filter === sig ? { backgroundColor: m.color + '30', color: m.color, borderColor: m.color + '50' } : {}}>
              {m.icon} {m.label} ({cnt})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="bg-white/5 rounded-xl h-24 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">Cap acció en aquesta categoria.</p>
          ) : (
            filtered.map(s => (
              <WatchlistCard key={s.id} stock={s} selected={selected?.id === s.id} onClick={() => selectStock(s)} />
            ))
          )}
        </div>
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/3 min-h-[400px]">
              <div className="text-center">
                <p className="text-4xl mb-3">📈</p>
                <p className="text-white/40 text-sm">Selecciona una acció per veure l'anàlisi</p>
              </div>
            </div>
          ) : (
            <WatchlistDetail stock={selected} history={history} loadingChart={loadingChart} />
          )}
        </div>
      </div>
    </div>
  );
}

function StockLogo({ symbol, name }: { symbol: string; name: string }) {
  const domain = TICKER_DOMAINS[symbol] ?? null;
  const initials = symbol.slice(0, 2).toUpperCase();

  if (!domain) {
    return (
      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-black text-white/60">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        width={36}
        height={36}
        className="w-full h-full object-contain p-1"
        onError={e => {
          const el = e.currentTarget;
          el.style.display = 'none';
          const parent = el.parentElement;
          if (parent) {
            parent.innerHTML = `<span class="text-xs font-black text-white/60">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// Mapeig ticker → domini per Clearbit Logo API
const TICKER_DOMAINS: Record<string, string> = {
  AAPL: 'apple.com', MSFT: 'microsoft.com', NVDA: 'nvidia.com', GOOGL: 'google.com',
  AMZN: 'amazon.com', META: 'meta.com', TSLA: 'tesla.com', ASML: 'asml.com',
  SAP: 'sap.com', LVMH: 'lvmh.com', SIE: 'siemens.com', BAS: 'basf.com',
  NESN: 'nestle.com', ROG: 'roche.com', NOVN: 'novartis.com', AZN: 'astrazeneca.com',
  HSBA: 'hsbc.com', LLOY: 'lloydsbank.com', BP: 'bp.com', SHEL: 'shell.com',
  INTU: 'intuit.com', CRM: 'salesforce.com', ADBE: 'adobe.com', ORCL: 'oracle.com',
};

function WatchlistCard({ stock, selected, onClick }: { stock: StockWithQuote; selected: boolean; onClick: () => void }) {
  const m = SIGNAL_META[stock.signal];
  const change = stock.quote?.changePercent ?? 0;
  const isUp = change >= 0;
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
        selected
          ? 'border-[#c9a84c]/40 bg-[#c9a84c]/5 shadow-[0_0_20px_rgba(201,168,76,0.06)]'
          : 'border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/5'
      }`}>
      <div className="flex items-center gap-3">
        <StockLogo symbol={stock.symbol} name={stock.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-white font-bold text-sm tracking-tight">{stock.symbol}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ color: m.color, backgroundColor: m.color + '18', border: `1px solid ${m.color}30` }}>
              {m.label}
            </span>
          </div>
          <p className="text-white/40 text-[11px] truncate leading-none">{stock.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {stock.quote ? (
            <>
              <p className="text-white font-mono text-sm font-semibold leading-tight">
                {stock.quote.price >= 1000
                  ? stock.quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 })
                  : stock.quote.price.toFixed(2)}
              </p>
              <div className={`flex items-center justify-end gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d={isUp ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
                </svg>
                <span className="text-[11px] font-mono font-semibold">
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </span>
              </div>
            </>
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </div>
      </div>
      {stock.quote && (
        <div className="mt-2 pt-2 border-t border-white/5 flex gap-4 text-[10px] font-mono text-white/30">
          {stock.quote.high > 0 && <span>H <span className="text-white/50">{stock.quote.high.toFixed(2)}</span></span>}
          {stock.quote.low > 0  && <span>L <span className="text-white/50">{stock.quote.low.toFixed(2)}</span></span>}
          {stock.quote.volume > 0 && (
            <span className="ml-auto">
              Vol <span className="text-white/50">{formatVolume(stock.quote.volume)}</span>
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function WatchlistDetail({ stock, history, loadingChart }: { stock: StockWithQuote; history: { date: string; close: number }[]; loadingChart: boolean }) {
  const m = SIGNAL_META[stock.signal];
  const q = stock.quote;
  const change = q?.changePercent ?? 0;
  const isUp = change >= 0;

  // First point to compute total evolution %
  const firstClose = history[0]?.close;
  const lastClose  = history[history.length - 1]?.close;
  const totalEvo   = firstClose && lastClose ? ((lastClose - firstClose) / firstClose) * 100 : null;

  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.015) 100%)' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-white/8">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <StockLogo symbol={stock.symbol} name={stock.name} />
            <div>
              <h2 className="text-white font-black text-xl leading-none">{stock.symbol}</h2>
              <p className="text-white/40 text-xs mt-0.5">{stock.name}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ color: m.color, backgroundColor: m.color + '18', border: `1px solid ${m.color}30` }}>
            {m.icon} {m.label}
          </span>
        </div>

        {q && (
          <div className="flex items-end gap-3">
            <span className="text-white font-mono font-black text-3xl leading-none">
              {q.price >= 1000 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : q.price.toFixed(2)}
            </span>
            <span className={`font-mono text-base font-bold mb-0.5 flex items-center gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d={isUp ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
              </svg>
              {isUp ? '+' : ''}{change.toFixed(2)}%
            </span>
            <span className="text-white/25 text-xs mb-0.5 font-mono">avui</span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      {q && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-px bg-white/5 border-b border-white/8">
          {[
            { label: 'Màx. dia',  value: q.high   > 0 ? q.high.toFixed(2)  : '—' },
            { label: 'Mín. dia',  value: q.low    > 0 ? q.low.toFixed(2)   : '—' },
            { label: 'Obertura',  value: q.open   > 0 ? q.open.toFixed(2)  : '—' },
            { label: 'Volum',     value: q.volume > 0 ? formatVolume(q.volume) : '—' },
            { label: 'Var. 1any', value: totalEvo !== null ? `${totalEvo >= 0 ? '+' : ''}${totalEvo.toFixed(1)}%` : '—',
              color: totalEvo !== null ? (totalEvo >= 0 ? 'text-green-400' : 'text-red-400') : '' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#080e0b] px-3 py-2.5">
              <p className="text-white/30 text-[9px] uppercase tracking-widest mb-0.5">{label}</p>
              <p className={`font-mono text-xs font-semibold ${color ?? 'text-white/70'}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white/30 text-[10px] uppercase tracking-widest">Evolució 1 any</p>
          {totalEvo !== null && (
            <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full ${totalEvo >= 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
              {totalEvo >= 0 ? '+' : ''}{totalEvo.toFixed(2)}%
            </span>
          )}
        </div>
        {loadingChart ? (
          <div className="h-[220px] bg-white/3 rounded-xl animate-pulse" />
        ) : history.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={isUp ? '#c9a84c' : '#ef4444'} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={isUp ? '#c9a84c' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
                tickLine={false} axisLine={false} domain={['auto', 'auto']}
                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)} />
              <Tooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, fontSize: 11, padding: '8px 12px' }}
                formatter={(v: number) => [`${v.toFixed(2)}`, 'Preu']}
                labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              />
              {firstClose && (
                <ReferenceLine y={firstClose} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              )}
              <Area type="monotone" dataKey="close"
                stroke={isUp ? '#c9a84c' : '#ef4444'} strokeWidth={2}
                fill={`url(#grad-${stock.symbol})`} dot={false} activeDot={{ r: 3, fill: isUp ? '#c9a84c' : '#ef4444' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center gap-2">
            <svg className="w-8 h-8 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-white/25 text-xs">Sense dades de preu disponibles</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {(stock.signalNote || stock.technicalNote) && (
        <div className="px-6 pb-5 pt-2 space-y-3 border-t border-white/5 mt-2">
          {stock.signalNote && (
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Senyal</p>
              <p className="text-white/65 text-xs leading-relaxed">{stock.signalNote}</p>
            </div>
          )}
          {stock.technicalNote && (
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-1">Tècnic</p>
              <p className="text-white/50 text-xs leading-relaxed">{stock.technicalNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccionsPage() {
  const [tab, setTab] = useState<'analysis' | 'watchlist'>('analysis');

  return (
    <div className="min-h-screen bg-[#080e0b]">
      <Nav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC — Zona clients</p>
          <h1 className="text-white font-black text-4xl mb-1">Anàlisi de Mercats</h1>
          <p className="text-white/40 text-sm">Tècnica · Fonamental · Combinada</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-white/3 rounded-xl p-1 w-fit border border-white/8">
          <button onClick={() => setTab('analysis')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'analysis' ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'text-white/50 hover:text-white'}`}>
            Anàlisi tècnica
          </button>
          <button onClick={() => setTab('watchlist')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'watchlist' ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'text-white/50 hover:text-white'}`}>
            Seguiment d'accions
          </button>
        </div>

        {tab === 'analysis' ? <AnalysisTab /> : <WatchlistTab />}
      </main>
    </div>
  );
}
