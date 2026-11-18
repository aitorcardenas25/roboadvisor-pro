'use client';

import { useState } from 'react';

type Period = 'month' | 'quarter' | 'year';
const LABEL: Record<Period, string> = { month: 'Mensual', quarter: 'Trimestral', year: 'Anual' };

/** Descàrrega de l'Excel d'evolució de la cartera (client o assessor). */
export default function PortfolioExcelButton({ baseUrl, className = '' }: { baseUrl: string; className?: string }) {
  const [period, setPeriod] = useState<Period>('month');
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      <span className="text-ink-muted">Evolució en Excel</span>
      <select value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Període"
        className="bg-subtle border border-line rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-accent/50">
        {(Object.keys(LABEL) as Period[]).map(p => <option key={p} value={p} className="bg-surface">{LABEL[p]}</option>)}
      </select>
      <a href={`${baseUrl}?period=${period}`} download
        className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent hover:bg-accent-soft transition-colors">
        Descarregar Excel
      </a>
    </div>
  );
}
