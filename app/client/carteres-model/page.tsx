'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Allocation { label: string; pct: number; color: string }
interface Portfolio {
  id:          string;
  name:        string;
  subtitle:    string;
  risk:        number;
  returnEst:   string;
  volatility:  string;
  horizon:     string;
  allocations: Allocation[];
  rationale:   string;
  highlight:   string;
}

const PORTFOLIOS: Portfolio[] = [
  {
    id: 'conservador',
    name: 'Conservador',
    subtitle: 'Preservació de capital',
    risk: 2,
    returnEst: '3–5%',
    volatility: '4–6%',
    horizon: '2–4 anys',
    highlight: '#16a34a',
    allocations: [
      { label: 'Renda fixa curta',  pct: 50, color: '#16a34a' },
      { label: 'Renda fixa llarga', pct: 25, color: '#22c55e' },
      { label: 'Renda variable',    pct: 15, color: '#c9a84c' },
      { label: 'Liquiditat',        pct: 10, color: '#6b7280' },
    ],
    rationale: "Cartera orientada a inversors amb baixa tolerància al risc o horitzó curt. El pes dominant en renda fixa de qualitat amortitza les correccions de mercat. Adequada per a capital que no pot permetre's pèrdues significatives.",
  },
  {
    id: 'moderat',
    name: 'Moderat',
    subtitle: 'Creixement equilibrat',
    risk: 3,
    returnEst: '5–8%',
    volatility: '8–12%',
    horizon: '4–7 anys',
    highlight: '#c9a84c',
    allocations: [
      { label: 'Renda variable',    pct: 45, color: '#c9a84c' },
      { label: 'Renda fixa',        pct: 35, color: '#16a34a' },
      { label: 'Alternatius',       pct: 12, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 8,  color: '#6b7280' },
    ],
    rationale: "La combinació 45/35 renda variable/fixa optimitza la ràtio rendiment/risc a mig termini. Els actius alternatius (REITs, infraestructures) aporten descorrelació. Adequada per a la majoria d'inversors particulars.",
  },
  {
    id: 'dinamic',
    name: 'Dinàmic',
    subtitle: 'Creixement actiu',
    risk: 4,
    returnEst: '8–12%',
    volatility: '12–18%',
    horizon: '7–12 anys',
    highlight: '#f59e0b',
    allocations: [
      { label: 'Renda variable',    pct: 70, color: '#f59e0b' },
      { label: 'Renda fixa HY',     pct: 15, color: '#c9a84c' },
      { label: 'Alternatius',       pct: 10, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 5,  color: '#6b7280' },
    ],
    rationale: "Exposició majoritària a renda variable global per capturar creixement a llarg termini. La renda fixa d'alt rendiment complementa la rendibilitat. Exigeix capacitat d'absorció de caigudes temporals de fins al 25–30%.",
  },
  {
    id: 'agressiu',
    name: 'Agressiu',
    subtitle: 'Màxim creixement',
    risk: 5,
    returnEst: '12–18%',
    volatility: '18–28%',
    horizon: '+12 anys',
    highlight: '#dc2626',
    allocations: [
      { label: 'Renda variable',    pct: 85, color: '#dc2626' },
      { label: 'Actius alternatius',pct: 10, color: '#8b5cf6' },
      { label: 'Liquiditat',        pct: 5,  color: '#6b7280' },
    ],
    rationale: 'Cartera concentrada en renda variable amb biaix cap a creixement (tecnologia, salut, emergents). Adequada per a inversors joves amb horitzó molt llarg i alta tolerància a la volatilitat. Correccions del 40–50% possibles.',
  },
];

function RiskDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-2.5 h-2.5 rounded-full transition-all"
          style={{ background: i <= level ? (level <= 2 ? '#16a34a' : level === 3 ? '#c9a84c' : level === 4 ? '#f59e0b' : '#dc2626') : 'rgba(255,255,255,0.1)' }} />
      ))}
    </div>
  );
}

function AllocationBar({ allocations }: { allocations: Allocation[] }) {
  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-2 bg-white/5">
        {allocations.map(a => (
          <div key={a.label} style={{ width: `${a.pct}%`, background: a.color }} />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {allocations.map(a => (
          <div key={a.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
            <span className="text-white/45 text-[10px] font-sans">{a.label}</span>
            <span className="text-white/70 text-[10px] font-mono ml-auto">{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
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
          <Link href="/client/seguiment-accions" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Accions</Link>
          <Link href="/client/carteres-model"    className="text-[#c9a84c] font-semibold">Carteres</Link>
          <Link href="/informe-bursatil"         className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Informe</Link>
        </div>
      </div>
    </nav>
  );
}

export default function CarteresModelPage() {
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
          <h1 className="text-white font-black text-4xl mb-2 tracking-tight">Carteres Model</h1>
          <p className="text-white/40 text-sm">Quatre perfils d&apos;inversió amb distribució d&apos;actius optimitzada i estimes de rendiment/risc.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {PORTFOLIOS.map(p => (
            <div key={p.id}
              className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 flex flex-col gap-5"
              style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.07)', borderTopColor: p.highlight + '60' }}>

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-white font-black text-xl tracking-tight">{p.name}</h2>
                  <p className="text-white/35 text-xs font-sans mt-1 uppercase tracking-widest">{p.subtitle}</p>
                </div>
                <RiskDots level={p.risk} />
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Rendiment est.', value: p.returnEst },
                  { label: 'Volatilitat',    value: p.volatility },
                  { label: 'Horitzó',        value: p.horizon },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] border border-[#1a3a2a]/50 rounded-xl p-3 text-center">
                    <div className="text-white/30 text-[9px] uppercase tracking-widest font-sans mb-1">{label}</div>
                    <div style={{ color: p.highlight }} className="font-mono font-bold text-sm">{value}</div>
                  </div>
                ))}
              </div>

              {/* Allocation bar */}
              <AllocationBar allocations={p.allocations} />

              {/* Rationale */}
              <p className="text-white/40 text-xs font-sans leading-relaxed border-t border-white/5 pt-4">{p.rationale}</p>
            </div>
          ))}
        </div>

        <p className="text-white/15 text-xs text-center mt-10 leading-relaxed font-sans">
          Carteres model orientatives · Rendiments estimats no garantits · No constitueix assessorament financer regulat
        </p>
      </main>
    </div>
  );
}
