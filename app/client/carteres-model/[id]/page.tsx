'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getPortfolioDetail } from '@/lib/portfolioData';

function RiskDots({ level, highlight }: { level: number; highlight: string }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-3 h-3 rounded-full"
          style={{ background: i <= level ? highlight : 'rgba(255,255,255,0.08)' }} />
      ))}
    </div>
  );
}

function SrriDot({ level }: { level: number }) {
  const colors = ['#16a34a', '#22c55e', '#c9a84c', '#f59e0b', '#f97316', '#dc2626', '#9f1239'];
  const labels = ['1', '2', '3', '4', '5', '6', '7'];
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold font-sans"
          style={{ background: i === level ? colors[i-1] : 'rgba(255,255,255,0.06)', color: i === level ? '#fff' : 'rgba(255,255,255,0.2)' }}>
          {labels[i-1]}
        </div>
      ))}
    </div>
  );
}

export default function PortfolioDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const portfolio = getPortfolioDetail(id);

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

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-[#080e0b] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 font-sans">Cartera no trobada: {id}</p>
        <Link href="/client/carteres-model" className="text-[#c9a84c] text-sm font-sans hover:underline">
          ← Tornar a les carteres
        </Link>
      </div>
    );
  }

  const totalTer = portfolio.funds.reduce((acc, f) => acc + (f.weight / 100) * f.ter, 0);

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
          <div className="flex items-center gap-5 text-xs uppercase tracking-widest font-sans">
            <Link href="/client/carteres-model" className="text-[#c9a84c] font-semibold">← Carteres</Link>
            <Link href="/client/seguiment-accions" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Accions</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#2d6a4f] text-xs uppercase tracking-[0.3em] mb-2 font-sans">Factor OTC — Zona clients</p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-white font-black text-4xl tracking-tight mb-1">Cartera {portfolio.name}</h1>
              <p className="text-white/40 text-sm font-sans uppercase tracking-widest">{portfolio.subtitle}</p>
            </div>
            <RiskDots level={portfolio.risk} highlight={portfolio.highlight} />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Rendiment est.',  value: portfolio.returnEst },
            { label: 'Volatilitat',     value: portfolio.volatility },
            { label: 'Horitzó',         value: portfolio.horizon },
            { label: 'TER mig pond.',   value: `${totalTer.toFixed(2)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-xl p-4 text-center">
              <div className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-1.5">{label}</div>
              <div style={{ color: portfolio.highlight }} className="font-mono font-bold text-lg">{value}</div>
            </div>
          ))}
        </div>

        {/* Allocation chart */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-6"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <h2 className="text-white font-bold text-base mb-4 font-sans">Distribució d&apos;actius</h2>
          {/* Stacked bar */}
          <div className="flex rounded-lg overflow-hidden h-3 bg-white/5 mb-4">
            {portfolio.allocations.map(a => (
              <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
            {portfolio.allocations.map(a => (
              <div key={a.label} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
                <span className="text-white/50 text-xs font-sans flex-1">{a.label}</span>
                <span style={{ color: a.color }} className="font-mono font-bold text-xs">{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fund table */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl overflow-hidden mb-6"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-bold text-base font-sans">Fons i ETFs inclosos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-white/5">
                  {['Fons / ETF', 'Ticker', 'ISIN', 'Pes', 'TER', 'Categoria', 'Risc SRRI'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-white/25 font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.funds.map((f, i) => (
                  <tr key={f.isin} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium text-xs leading-tight">{f.name}</div>
                      <div className="text-white/30 text-[10px] mt-1 leading-relaxed">{f.justification}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#c9a84c] font-mono font-bold text-xs">{f.ticker}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/40 font-mono text-[10px] whitespace-nowrap">{f.isin}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: portfolio.highlight }} className="font-mono font-bold text-sm">{f.weight}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/60 font-mono text-xs">{f.ter.toFixed(2)}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/40 text-xs whitespace-nowrap">{f.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <SrriDot level={f.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#1a3a2a]">
                  <td colSpan={3} className="px-4 py-3 text-white/25 text-xs font-sans">TER mig ponderat</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3">
                    <span style={{ color: portfolio.highlight }} className="font-mono font-bold text-sm">{totalTer.toFixed(2)}%</span>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Where to buy */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-6"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <h2 className="text-white font-bold text-base mb-4 font-sans">On es pot comprar</h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {portfolio.whereToBuy.map(wb => (
              <div key={wb.platform} className="bg-[#0d1a14] border border-[#1a3a2a] rounded-xl p-4">
                <div className="text-[#c9a84c] font-bold text-sm font-sans mb-1.5">{wb.platform}</div>
                <p className="text-white/40 text-xs font-sans leading-relaxed">{wb.note}</p>
              </div>
            ))}
          </div>
          <p className="text-white/20 text-xs font-sans">
            ⚠ Disponibilitat subjecta a cada plataforma. Verifica que els ETFs estiguin disponibles al teu broker abans d&apos;operar.
          </p>
        </div>

        {/* Rationale */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-8"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)' }}>
          <h2 className="text-white font-bold text-base mb-3 font-sans">Justificació de la cartera</h2>
          <p className="text-white/50 text-sm font-sans leading-relaxed mb-3">{portfolio.description}</p>
          <p className="text-white/35 text-xs font-sans leading-relaxed border-t border-white/5 pt-3">{portfolio.rationale}</p>
        </div>

        <p className="text-white/15 text-xs text-center font-sans leading-relaxed">
          Cartera model orientativa · Rendiments estimats no garantits · TERs subjectes a canvi per part dels emissors · No constitueix assessorament financer regulat
        </p>

      </main>
    </div>
  );
}
