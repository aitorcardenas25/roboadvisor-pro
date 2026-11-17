'use client';

import { useState } from 'react';

type Period = 'month' | 'quarter' | 'year';
const LABEL: Record<Period, string> = { month: 'Mensual', quarter: 'Trimestral', year: 'Anual' };

/** Descàrrega de l'Excel d'evolució de la cartera (client o assessor). */
export default function PortfolioExcelButton({ baseUrl, className = '' }: { baseUrl: string; className?: string }) {
  const [period, setPeriod] = useState<Period>('month');
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="text-white/40">Evolució en Excel</span>
      <select value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Període"
        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#c9a84c]/50">
        {(Object.keys(LABEL) as Period[]).map(p => <option key={p} value={p} className="bg-[#0d1f1a]">{LABEL[p]}</option>)}
      </select>
      <a href={`${baseUrl}?period=${period}`} download
        className="px-3 py-1.5 rounded-lg border border-[#c9a84c]/40 text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors">
        Descarregar Excel
      </a>
    </div>
  );
}
