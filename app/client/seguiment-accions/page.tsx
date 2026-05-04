'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STOCKS = [
  { ticker: 'AAPL',  name: 'Apple Inc.',         sector: 'Technology',     price: 189.30, change: +1.24, status: 'Oportunitat', statusColor: '#16a34a', note: 'Recompra acceleerada. Free cash flow rècord.' },
  { ticker: 'NVDA',  name: 'NVIDIA Corp.',        sector: 'Semiconductors', price: 875.40, change: +2.87, status: 'Oportunitat', statusColor: '#16a34a', note: 'Creixement de data centers >200% YoY.' },
  { ticker: 'MSFT',  name: 'Microsoft Corp.',     sector: 'Technology',     price: 415.50, change: +0.43, status: 'Neutral',     statusColor: '#c9a84c', note: 'Azure creixent però valoració exigent.' },
  { ticker: 'ASML',  name: 'ASML Holding',        sector: 'Industrials',    price: 820.10, change: -1.15, status: 'Oportunitat', statusColor: '#16a34a', note: 'Monopoli en EUV. Demanda estructural semiconductors.' },
  { ticker: 'META',  name: 'Meta Platforms',      sector: 'Communication',  price: 490.20, change: +1.68, status: 'Neutral',     statusColor: '#c9a84c', note: 'Monetització IA en Reels millora marges.' },
  { ticker: 'AMZN',  name: 'Amazon.com Inc.',     sector: 'Consumer',       price: 185.60, change: +0.92, status: 'Vigilància',  statusColor: '#f59e0b', note: 'Regulació antimonopoli pendent als EUA.' },
  { ticker: 'SAN.MC',name: 'Banco Santander',     sector: 'Financial',      price: 4.82,   change: -0.33, status: 'Vigilància',  statusColor: '#f59e0b', note: "Exposició Latam. Tipus d'interès en revisió." },
  { ticker: 'TSLA',  name: 'Tesla Inc.',          sector: 'Consumer',       price: 172.80, change: -2.14, status: 'Risc',        statusColor: '#dc2626', note: 'Pressió marges per guerra de preus EV.' },
];

function StatusBadge({ status, color }: { status: string; color: string }) {
  const bg = color + '18';
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}40` }}
      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide font-sans">
      {status}
    </span>
  );
}

function Nav() {
  return (
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
          <Link href="/client/seguiment-accions" className="text-[#c9a84c] font-semibold">Accions</Link>
          <Link href="/client/carteres-model" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Carteres</Link>
          <Link href="/informe-bursatil" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Informe</Link>
        </div>
      </div>
    </nav>
  );
}

export default function SeguimentAccionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080e0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#080e0b] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 bg-[#1a3a2a] border border-[#2d6a4f]/40 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-7 h-7 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-3">Accés restringit</p>
        <h1 className="text-white font-black text-2xl mb-4">Inicia sessió per accedir</h1>
        <button onClick={() => router.push('/login')}
          className="px-6 py-2.5 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] text-sm font-semibold rounded-sm hover:bg-[#1f4432] transition-colors">
          Iniciar sessió
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e0b]">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">

        <div className="mb-10">
          <p className="text-[#2d6a4f] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC — Zona clients</p>
          <h1 className="text-white font-black text-4xl mb-2 tracking-tight">Seguiment d&apos;Accions</h1>
          <p className="text-white/40 text-sm">Senyals i estatus actualitzats de les principals posicions monitorades.</p>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Oportunitat', count: STOCKS.filter(s => s.status === 'Oportunitat').length, color: '#16a34a' },
            { label: 'Neutral',     count: STOCKS.filter(s => s.status === 'Neutral').length,     color: '#c9a84c' },
            { label: 'Vigilància',  count: STOCKS.filter(s => s.status === 'Vigilància').length,  color: '#f59e0b' },
            { label: 'Risc',        count: STOCKS.filter(s => s.status === 'Risc').length,        color: '#dc2626' },
          ].map(({ label, count, color }) => (
            <div key={label} className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-xl p-4 text-center">
              <div style={{ color }} className="font-mono text-2xl font-black">{count}</div>
              <div className="text-white/40 text-xs uppercase tracking-widest mt-1 font-sans">{label}</div>
            </div>
          ))}
        </div>

        {/* Stock cards */}
        <div className="grid gap-3">
          {STOCKS.map(stock => {
            const isUp = stock.change >= 0;
            const changeColor = isUp ? '#16a34a' : '#dc2626';
            return (
              <Link href={`/client/seguiment-accions/${encodeURIComponent(stock.ticker)}`}
                key={stock.ticker}
                className="block bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-5 hover:border-[#2d6a4f]/50 transition-all cursor-pointer"
                style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    {/* Ticker badge */}
                    <div className="w-14 h-14 bg-[#0d1a14] border border-[#1a3a2a] rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-[#c9a84c] font-mono font-black text-xs tracking-wider leading-tight text-center px-1">
                        {stock.ticker.replace('.MC', '')}
                      </span>
                    </div>
                    <div>
                      <div className="text-white font-bold text-base leading-tight">{stock.name}</div>
                      <div className="text-white/30 text-xs font-sans mt-0.5">{stock.sector}</div>
                      <div className="mt-2">
                        <StatusBadge status={stock.status} color={stock.statusColor} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Price */}
                    <div className="text-right">
                      <div className="text-white font-mono font-bold text-lg">${stock.price.toFixed(2)}</div>
                      <div style={{ color: changeColor }} className="font-mono text-sm font-semibold">
                        {isUp ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)}%
                      </div>
                    </div>
                    {/* Note */}
                    <div className="hidden sm:block max-w-[240px]">
                      <p className="text-white/35 text-xs font-sans leading-relaxed">{stock.note}</p>
                    </div>
                    {/* Action */}
                    <Link href={`/informe-bursatil?ticker=${stock.ticker}`}
                      className="flex items-center gap-1.5 px-3 py-2 bg-[#1a3a2a] border border-[#2d6a4f]/40 text-[#c9a84c] text-xs font-semibold rounded-lg hover:bg-[#1f4432] transition-colors whitespace-nowrap font-sans">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Informe
                    </Link>
                  </div>
                </div>
                <p className="sm:hidden text-white/35 text-xs font-sans mt-3 leading-relaxed">{stock.note}</p>
              </Link>
            );
          })}
        </div>

        <p className="text-white/15 text-xs text-center mt-10 leading-relaxed font-sans">
          Estatus revisat setmanalment · Dades orientatives · No constitueix assessorament financer regulat
        </p>
      </main>
    </div>
  );
}
