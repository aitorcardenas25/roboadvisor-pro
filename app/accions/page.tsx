'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { TrackedStock, StockSignal } from '@/lib/stockTracker';
import { SIGNAL_META } from '@/lib/stockTracker';
import type { Quote } from '@/services/quotes';

interface StockWithQuote extends TrackedStock { quote?: Quote }

const SIGNAL_ORDER: StockSignal[] = ['oportunitat', 'vigilancia', 'neutral', 'risc-elevat'];

export default function AccionsPage() {
  const [stocks, setStocks]       = useState<StockWithQuote[]>([]);
  const [selected, setSelected]   = useState<StockWithQuote | null>(null);
  const [history, setHistory]     = useState<{ date: string; close: number }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [filter, setFilter]       = useState<StockSignal | 'all'>('all');

  useEffect(() => {
    fetch('/api/stocks')
      .then(r => r.json())
      .then(async data => {
        const list: TrackedStock[] = data.stocks ?? [];
        // Quotes en paral·lel (millor esforç)
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
    <div className="min-h-screen bg-[#0a0f0d]">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC</p>
          <h1 className="text-white font-black text-4xl mb-2">Seguiment d'Accions</h1>
          <p className="text-white/40 text-sm">Anàlisi informativa. Les senyals no constitueixen recomanació d'inversió.</p>
        </div>

        {/* Disclaimer */}
        <div className="mb-8 bg-yellow-400/5 border border-yellow-400/20 rounded-xl px-5 py-3">
          <p className="text-yellow-400/80 text-xs leading-relaxed">
            ⚠️ <strong>Avís important:</strong> Les senyals mostrades (Oportunitat, Vigilància, Risc elevat) són opinions informatives elaborades per l'equip de Factor OTC amb finalitat exclusivament educativa. No constitueixen assessorament financer regulat ni recomanació de compra o venda. Sempre consulta un assessor financer autoritzat.
          </p>
        </div>

        {/* Signal filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === 'all' ? 'bg-[#c9a84c] text-[#0d1f1a]' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'}`}>
            Totes ({stocks.length})
          </button>
          {SIGNAL_ORDER.map(sig => {
            const m   = SIGNAL_META[sig];
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
          {/* Stock list */}
          <div className="lg:col-span-1 space-y-3">
            {loading ? (
              [...Array(5)].map((_, i) => <div key={i} className="bg-white/5 rounded-xl h-24 animate-pulse" />)
            ) : filtered.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">Cap acció en aquesta categoria.</p>
            ) : (
              filtered.map(s => <StockCard key={s.id} stock={s} selected={selected?.id === s.id} onClick={() => selectStock(s)} />)
            )}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="h-full flex items-center justify-center border border-white/10 rounded-2xl bg-white/3 min-h-[400px]">
                <div className="text-center">
                  <p className="text-4xl mb-3">📈</p>
                  <p className="text-white/40 text-sm">Selecciona una acció per veure l'anàlisi</p>
                </div>
              </div>
            ) : (
              <StockDetail stock={selected} history={history} loadingChart={loadingChart} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── StockCard ─────────────────────────────────────────────────────────────────

function StockCard({ stock, selected, onClick }: { stock: StockWithQuote; selected: boolean; onClick: () => void }) {
  const m      = SIGNAL_META[stock.signal];
  const quote  = stock.quote;
  const change = quote?.changePercent ?? 0;

  return (
    <button onClick={onClick} className={`w-full text-left p-4 rounded-xl border transition-all ${selected ? 'border-[#c9a84c]/50 bg-[#c9a84c]/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white font-bold text-sm">{stock.symbol}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: m.color, backgroundColor: m.color + '20' }}>
              {m.icon} {m.label}
            </span>
          </div>
          <p className="text-white/50 text-xs truncate">{stock.name}</p>
          <p className="text-white/30 text-xs">{stock.sector}</p>
        </div>
        <div className="text-right flex-shrink-0">
          {quote ? (
            <>
              <p className="text-white text-sm font-mono font-semibold">{quote.price.toFixed(2)} {quote.currency}</p>
              <p className={`text-xs font-mono ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </p>
            </>
          ) : (
            <p className="text-white/20 text-xs">—</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── StockDetail ───────────────────────────────────────────────────────────────

function StockDetail({ stock, history, loadingChart }: { stock: StockWithQuote; history: { date: string; close: number }[]; loadingChart: boolean }) {
  const m     = SIGNAL_META[stock.signal];
  const quote = stock.quote;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-white font-black text-2xl">{stock.symbol}</h2>
            <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ color: m.color, backgroundColor: m.color + '20' }}>
              {m.icon} {m.label}
            </span>
          </div>
          <p className="text-white/60 text-sm">{stock.name}</p>
          <p className="text-white/30 text-xs">{stock.sector} · {stock.region}</p>
        </div>
        {quote && (
          <div className="text-right">
            <p className="text-white font-black text-3xl font-mono">{quote.price.toFixed(2)} <span className="text-white/40 text-base font-normal">{quote.currency}</span></p>
            <p className={`text-lg font-mono font-bold ${(quote.changePercent ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(quote.changePercent ?? 0) >= 0 ? '+' : ''}{(quote.changePercent ?? 0).toFixed(2)}%
              <span className="text-sm font-normal ml-1">({(quote.change ?? 0) >= 0 ? '+' : ''}{(quote.change ?? 0).toFixed(2)})</span>
            </p>
            {quote.source === 'simulated' && <p className="text-white/20 text-xs mt-0.5">Preu simulat</p>}
          </div>
        )}
      </div>

      {/* Quote stats */}
      {quote && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Obertura',    quote.open?.toFixed(2)   ?? '—'],
            ['Màxim dia',   quote.high?.toFixed(2)   ?? '—'],
            ['Mínim dia',   quote.low?.toFixed(2)    ?? '—'],
            ['Volum',       quote.volume ? (quote.volume / 1e6).toFixed(1) + 'M' : '—'],
            ['Màx 52s',     quote.week52High?.toFixed(2)  ?? '—'],
            ['Mín 52s',     quote.week52Low?.toFixed(2)   ?? '—'],
            ['Cap. Mkt',    quote.marketCap ? (quote.marketCap / 1e9).toFixed(1) + 'B' : '—'],
            ['P/E',         quote.pe?.toFixed(1) ?? '—'],
          ].map(([label, val]) => (
            <div key={label} className="bg-white/5 rounded-lg p-2.5">
              <p className="text-white/40 text-xs mb-0.5">{label}</p>
              <p className="text-white text-sm font-mono font-semibold">{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div>
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Evolució 12 mesos</p>
        {loadingChart ? (
          <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
        ) : history.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#0d1f1a', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number) => [v.toFixed(2), 'Preu']}
              />
              <Line type="monotone" dataKey="close" stroke="#c9a84c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-white/20 text-sm border border-white/5 rounded-xl">
            Dades no disponibles
          </div>
        )}
      </div>

      {/* Signal note */}
      <div className="rounded-xl p-4" style={{ backgroundColor: m.color + '10', borderLeft: `3px solid ${m.color}` }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: m.color }}>Senyal · {m.label}</p>
        <p className="text-white/80 text-sm leading-relaxed">{stock.signalNote || '—'}</p>
      </div>

      {/* Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stock.fundamentalNote && (
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">🔬 Anàlisi fonamental</p>
            <p className="text-white/70 text-sm leading-relaxed">{stock.fundamentalNote}</p>
          </div>
        )}
        {stock.technicalNote && (
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2">📊 Anàlisi tècnica</p>
            <p className="text-white/70 text-sm leading-relaxed">{stock.technicalNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
