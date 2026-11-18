'use client';
// Informe mensual del client: el mateix que veu l'assessor, per llegir-lo o desar-lo en PDF.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MonthlyReportView from '@/components/MonthlyReportView';
import type { MonthlyReportData } from '@/lib/portfolioReport';

export default function ClientReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/client/reports/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? 'Error'); return d; })
      .then((d: { report: MonthlyReportData }) => setReport(d.report))
      .catch((e: Error) => setError(e.message || 'No s\'ha pogut carregar l\'informe'));
  }, [id]);

  return (
    <div className="theme-client min-h-screen bg-canvas print:bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3 mb-5 print:hidden">
          <Link href="/client/cartera" className="text-ink-soft hover:text-ink text-sm">← Tornar a la cartera</Link>
          {report && (
            <button onClick={() => window.print()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg">
              Desar en PDF / imprimir
            </button>
          )}
        </div>
        {error && <p className="text-negative text-sm" role="alert">{error}</p>}
        {!report && !error && <div className="animate-pulse bg-subtle rounded-lg h-96" />}
        {report && <MonthlyReportView report={report} />}
      </div>
    </div>
  );
}
