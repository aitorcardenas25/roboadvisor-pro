'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getStockDetail } from '@/lib/stocksData';

// Exchange → TradingView prefix mapping
function tvSymbol(ticker: string, exchange: string): string {
  const t = ticker.toUpperCase();
  if (t.endsWith('.MC')) return `BME:${t.replace('.MC', '')}`;
  if (t.endsWith('.PA')) return `EURONEXT:${t.replace('.PA', '')}`;
  if (t.endsWith('.DE')) return `XETR:${t.replace('.DE', '')}`;
  if (t.endsWith('.L'))  return `LSE:${t.replace('.L', '')}`;
  if (t.endsWith('.AS')) return `EURONEXT:${t.replace('.AS', '')}`;
  if (exchange === 'NYSE') return `NYSE:${t}`;
  return `NASDAQ:${t}`;
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  return (
    <span style={{ color, background: color + '18', border: `1px solid ${color}40` }}
      className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider font-sans">
      {status}
    </span>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/[0.03] border border-[#1a3a2a]/50 rounded-xl p-4">
      <div className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-1.5">{label}</div>
      <div className="text-white font-mono font-bold text-lg leading-tight">{value}</div>
      {sub && <div className="text-white/25 text-[10px] font-sans mt-1">{sub}</div>}
    </div>
  );
}

export default function StockDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const tickerParam = decodeURIComponent(params.ticker as string).toUpperCase();
  const stock = getStockDetail(tickerParam);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080e0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  if (!stock) {
    return (
      <div className="min-h-screen bg-[#080e0b] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 font-sans">Acció no trobada: {tickerParam}</p>
        <Link href="/client/seguiment-accions" className="text-[#c9a84c] text-sm font-sans hover:underline">
          ← Tornar al seguiment
        </Link>
      </div>
    );
  }

  const cur = stock.currency === 'EUR' ? '€' : '$';
  const tv  = tvSymbol(stock.ticker, stock.exchange);
  const tvUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tv)}&interval=D&theme=dark&style=1&locale=es&toolbarbg=080e0b&hideideas=1&range=6M&hidetoptoolbar=0&hidesidetoolbar=1&saveimage=0&studies=%5B%22RSI%40tv-basicstudies%22%5D`;

  const fN = (n: number | null, decimals = 2) => n == null ? '—' : n.toFixed(decimals);
  const fB = (n: number | null) => n == null ? '—' : n >= 1000 ? `${cur}${(n/1000).toFixed(1)}T` : `${cur}${n.toFixed(1)}B`;
  const fPct = (n: number | null) => n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const epsSuprise = stock.lastQEpsAct != null && stock.lastQEpsEst != null
    ? ((stock.lastQEpsAct - stock.lastQEpsEst) / Math.abs(stock.lastQEpsEst)) * 100 : null;

  return (
    <div className="min-h-screen bg-[#080e0b]">

      {/* Nav */}
      <nav className="border-b border-[#1a3a2a]/70 px-6 py-4 sticky top-0 z-20 bg-[#080e0b]/92 backdrop-blur"
        style={{ boxShadow: '0 1px 0 rgba(26,58,42,0.3)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center">
              <span className="text-[#c9a84c] font-black text-[10px] leading-none">F</span>
            </div>
            <span className="text-white font-black text-sm tracking-wider">FACTOR</span>
            <span className="text-[#2d6a4f] font-light text-sm tracking-widest">OTC</span>
          </Link>
          <div className="flex items-center gap-5 text-xs uppercase tracking-widest">
            <Link href="/client/seguiment-accions" className="text-[#c9a84c] font-semibold font-sans">
              ← Seguiment
            </Link>
            <Link href="/informe-bursatil" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors font-sans">
              Informe
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-8 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="w-14 h-14 bg-[#0d1a14] border border-[#1a3a2a] rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-[#c9a84c] font-mono font-black text-xs tracking-wider text-center px-1 leading-tight">
                  {stock.ticker.replace('.MC', '').replace('.AS', '')}
                </span>
              </div>
              <div>
                <h1 className="text-white font-black text-3xl tracking-tight">{stock.ticker}</h1>
                <p className="text-white/40 text-sm font-sans">{stock.name}</p>
              </div>
              <StatusBadge status={stock.status} color={stock.statusColor} />
            </div>
            <p className="text-white/30 text-xs font-sans uppercase tracking-widest">{stock.sector} · {stock.exchange} · {stock.currency}</p>
          </div>
          <div className="text-right">
            <div className="text-[#c9a84c] font-mono font-black text-3xl">{cur}{stock.refPrice.toFixed(2)}</div>
            <div style={{ color: stock.refChange >= 0 ? '#16a34a' : '#dc2626' }}
              className="font-mono font-semibold text-base">
              {stock.refChange >= 0 ? '▲' : '▼'} {Math.abs(stock.refChange).toFixed(2)}%
            </div>
            <div className="text-white/20 text-[10px] font-sans mt-1">preu de referència</div>
          </div>
        </div>

        {/* TradingView chart */}
        <div className="border border-[#1a3a2a]/60 rounded-2xl overflow-hidden mb-8"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <iframe src={tvUrl} className="w-full block border-none" style={{ height: 380 }}
            allow="clipboard-write" loading="lazy" />
        </div>

        {/* Two-column grid */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">

          {/* Left: Fundamentals */}
          <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6"
            style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
            <h2 className="text-white font-bold text-base mb-4 font-sans">Resum fonamental</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <MetricCard label="P/E" value={fN(stock.pe)} />
              <MetricCard label="EPS TTM" value={`${cur}${fN(stock.eps)}`} />
              <MetricCard label="Ingressos" value={fB(stock.revenueB)} />
              <MetricCard label="Creix. Ingressos" value={fPct(stock.revenueGrowth)} sub="TTM YoY" />
              <MetricCard label="Marge Net" value={stock.margin != null ? `${stock.margin.toFixed(1)}%` : '—'} />
              <MetricCard label="ROE" value={stock.roe != null ? `${stock.roe.toFixed(0)}%` : '—'} />
            </div>

            {/* Quarterly */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-3">Resultats trimestrals</p>
              <div className="space-y-2">
                <div className="bg-[#0d1a14] border border-[#1a3a2a] rounded-xl p-3">
                  <div className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-1.5">Últim trimestre — {stock.lastQDate}</div>
                  <div className="flex gap-4 flex-wrap">
                    <div>
                      <div className="text-white/40 text-[10px] font-sans">EPS Real</div>
                      <div className="text-white font-mono font-bold">{cur}{fN(stock.lastQEpsAct)}</div>
                    </div>
                    <div>
                      <div className="text-white/40 text-[10px] font-sans">EPS Est.</div>
                      <div className="text-white font-mono font-bold">{cur}{fN(stock.lastQEpsEst)}</div>
                    </div>
                    {epsSuprise != null && (
                      <div>
                        <div className="text-white/40 text-[10px] font-sans">Sorpresa</div>
                        <div style={{ color: epsSuprise >= 0 ? '#16a34a' : '#dc2626' }}
                          className="font-mono font-bold">{fPct(epsSuprise)}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#0d1a14] border border-[#1a3a2a] rounded-xl p-3">
                  <div className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-1.5">Pròxim trimestre — {stock.nextQDate}</div>
                  <div>
                    <div className="text-white/40 text-[10px] font-sans">EPS Consens</div>
                    <div className="text-white font-mono font-bold">{cur}{fN(stock.nextQEpsEst)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Technical + catalysts */}
          <div className="flex flex-col gap-4">

            {/* Technical reading */}
            <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6"
              style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
              <h2 className="text-white font-bold text-base mb-3 font-sans">Lectura tècnica</h2>
              <p className="text-white/50 text-sm font-sans leading-relaxed mb-4">{stock.technicalNote}</p>

              {/* Support / Resistance */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-[#0d1a14] border border-[#16a34a]/30 rounded-xl p-3">
                  <div className="text-[#16a34a] text-[9px] uppercase tracking-widest font-sans mb-1">Suport 1</div>
                  <div className="text-white font-mono font-bold">{cur}{stock.support1}</div>
                </div>
                <div className="bg-[#0d1a14] border border-[#dc2626]/30 rounded-xl p-3">
                  <div className="text-[#dc2626] text-[9px] uppercase tracking-widest font-sans mb-1">Resistència 1</div>
                  <div className="text-white font-mono font-bold">{cur}{stock.resistance1}</div>
                </div>
                <div className="bg-[#0d1a14] border border-[#16a34a]/20 rounded-xl p-3">
                  <div className="text-[#16a34a]/60 text-[9px] uppercase tracking-widest font-sans mb-1">Suport 2</div>
                  <div className="text-white/70 font-mono">{cur}{stock.support2}</div>
                </div>
                <div className="bg-[#0d1a14] border border-[#dc2626]/20 rounded-xl p-3">
                  <div className="text-[#dc2626]/60 text-[9px] uppercase tracking-widest font-sans mb-1">Resistència 2</div>
                  <div className="text-white/70 font-mono">{cur}{stock.resistance2}</div>
                </div>
              </div>
              <div className="text-white/20 text-[10px] font-sans">Beta: {stock.beta} · Nivells orientatius</div>
            </div>

            {/* Catalysts */}
            <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6"
              style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
              <h2 className="text-white font-bold text-base mb-3 font-sans">Catalitzadors</h2>
              <ul className="space-y-2">
                {stock.catalysts.map((c, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-[#c9a84c] text-xs mt-0.5 flex-shrink-0">›</span>
                    <span className="text-white/55 text-xs font-sans leading-relaxed">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risks */}
            <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-5">
              <h2 className="text-red-400/70 font-bold text-sm mb-3 font-sans uppercase tracking-widest">Riscos</h2>
              <ul className="space-y-2">
                {stock.risks.map((r, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-red-400/60 text-xs mt-0.5 flex-shrink-0">—</span>
                    <span className="text-red-400/60 text-xs font-sans leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Business description */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-6"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <h2 className="text-white font-bold text-base mb-3 font-sans">Model de negoci</h2>
          <p className="text-white/50 text-sm font-sans leading-relaxed mb-4">{stock.description}</p>
          <div className="flex flex-wrap gap-2">
            {stock.segments.map(s => (
              <span key={s} className="px-2.5 py-1 bg-[#1a3a2a]/60 border border-[#2d6a4f]/30 rounded-lg text-[#c9a84c]/70 text-[10px] font-sans">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Competitive position */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-5">
            <h2 className="text-white/60 text-xs uppercase tracking-widest font-sans mb-2">Posició competitiva</h2>
            <p className="text-white/50 text-sm font-sans leading-relaxed">{stock.competitive}</p>
          </div>
          <div className="bg-[#0d1a14] border border-[#1a3a2a] rounded-2xl p-5">
            <div className="text-[#c9a84c] text-[9px] uppercase tracking-widest font-sans mb-2">Rival principal</div>
            <div className="text-white font-bold font-sans mb-2">{stock.rival}</div>
            <p className="text-white/40 text-xs font-sans leading-relaxed">{stock.rivalNote}</p>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <p className="text-white/15 text-xs font-sans">
            Anàlisi actualitzat: {stock.analysisDate} · Dades orientatives · No constitueix assessorament financer
          </p>
          <Link href={`/informe-bursatil?ticker=${stock.ticker}`}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] text-sm font-semibold rounded-xl hover:bg-[#1f4432] transition-colors font-sans">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generar informe complet
          </Link>
        </div>

      </main>
    </div>
  );
}
