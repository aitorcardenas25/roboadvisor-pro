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
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
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
    <nav className="border-b border-white/10 px-6 py-4 sticky top-0 z-20 bg-[#0a0f0d]/90 backdrop-blur">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-white font-black text-lg tracking-wider">FACTOR</span>
          <span className="text-[#c9a84c] font-light text-lg tracking-widest">OTC</span>
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/noticies"   className="text-white/50 hover:text-white transition-colors">Notícies</Link>
          <Link href="/comparador" className="text-white/50 hover:text-white transition-colors">Comparador</Link>
          <Link href="/accions"    className="text-[#c9a84c] font-medium">Accions</Link>
          <Link href="/admin"      className="text-white/30 hover:text-white/60 transition-colors text-xs uppercase tracking-widest">Admin</Link>
        </div>
      </div>
    </nav>
  );
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
          {/* Title bar */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-white font-black text-2xl">{result.symbol}</span>
              <span className="text-white/40 text-sm ml-3">{result.timeframe} · {result.asset_type === 'crypto' ? 'Cripto' : 'Acció'}</span>
            </div>
            {result.candles.length > 0 && (
              <span className="text-[#c9a84c] font-mono font-bold text-lg">
                {formatPrice(result.candles[result.candles.length - 1].close)}
              </span>
            )}
          </div>

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
              if (r.ok) return (await r.json()) as StockWithQuote;
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
  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-xl border transition-all ${selected ? 'border-[#c9a84c]/50 bg-[#c9a84c]/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
      <div className="flex items-center gap-3">
        <StockLogo symbol={stock.symbol} name={stock.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-bold text-sm">{stock.symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: m.color, backgroundColor: m.color + '20' }}>
              {m.icon} {m.label}
            </span>
          </div>
          <p className="text-white/50 text-xs truncate">{stock.name}</p>
        </div>
        {stock.quote && (
          <div className="text-right flex-shrink-0">
            <p className="text-white font-mono text-sm">{stock.quote.price?.toFixed(2)}</p>
            <p className={`text-xs font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}%
            </p>
          </div>
        )}
      </div>
    </button>
  );
}

function WatchlistDetail({ stock, history, loadingChart }: { stock: StockWithQuote; history: { date: string; close: number }[]; loadingChart: boolean }) {
  const m = SIGNAL_META[stock.signal];
  return (
    <div className="border border-white/10 rounded-2xl bg-white/3 p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-black text-2xl">{stock.symbol}</h2>
          <p className="text-white/50 text-sm">{stock.name}</p>
        </div>
        <span className="px-3 py-1.5 rounded-xl text-sm font-bold" style={{ color: m.color, backgroundColor: m.color + '20' }}>
          {m.icon} {m.label}
        </span>
      </div>
      {stock.quote && (
        <div className="flex gap-6">
          <div><p className="text-white/40 text-xs uppercase">Preu</p><p className="text-white font-mono font-bold text-xl">{stock.quote.price?.toFixed(2)}</p></div>
          <div><p className="text-white/40 text-xs uppercase">Canvi 1d</p><p className={`font-mono font-bold text-lg ${(stock.quote.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(stock.quote.changePercent ?? 0) >= 0 ? '+' : ''}{(stock.quote.changePercent ?? 0).toFixed(2)}%</p></div>
        </div>
      )}
      {stock.signalNote && (
        <div>
          <p className="text-white/40 text-xs mb-1">Senyal</p>
          <p className="text-white/70 text-sm leading-relaxed">{stock.signalNote}</p>
        </div>
      )}
      {stock.technicalNote && (
        <div>
          <p className="text-white/40 text-xs mb-1">Tècnic</p>
          <p className="text-white/60 text-sm leading-relaxed">{stock.technicalNote}</p>
        </div>
      )}
      <div>
        <p className="text-white/40 text-xs mb-3">Evolució (1 any)</p>
        {loadingChart ? (
          <div className="h-[200px] bg-white/5 rounded-xl animate-pulse" />
        ) : history.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#0d1f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff' }} />
              <Line type="monotone" dataKey="close" stroke="#c9a84c" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-white/30 text-sm text-center py-8">Sense dades de preu disponibles.</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccionsPage() {
  const [tab, setTab] = useState<'analysis' | 'watchlist'>('analysis');

  return (
    <div className="min-h-screen bg-[#0a0f0d]">
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
