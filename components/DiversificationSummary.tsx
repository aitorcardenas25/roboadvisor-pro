'use client';
// Diversificació de la proposta (i, si n'hi ha, de la cartera actual del client)
// per regió, sector i mida d'empresa, i concentració. Els càlculs són a
// lib/fundExposure.ts; aquí només es dibuixa. No hi ha cap «puntuació».
import { useMemo } from 'react';
import {
  exposureBreakdown, asOfLabel, REGIONS, SECTORS, SIZES, REGION_LABEL, SECTOR_LABEL, SIZE_LABEL,
  type ExposureBreakdown, type WeightedItem,
} from '@/lib/fundExposure';

const pct = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: n < 10 ? 1 : 0 })} %`;

interface Row { label: string; a: number; b?: number }

function rowsFor<K extends string>(keys: K[], labels: Record<K, string>, a: ExposureBreakdown, b: ExposureBreakdown | undefined,
  pick: (x: ExposureBreakdown) => Record<K, number>, missing: (x: ExposureBreakdown) => number, max = 99): Row[] {
  let rows: Row[] = keys.map(k => ({ label: labels[k], a: pick(a)[k], b: b ? pick(b)[k] : undefined }))
    .filter(r => r.a > 0.4 || (r.b ?? 0) > 0.4)
    .sort((x, y) => (y.a - x.a) || ((y.b ?? 0) - (x.b ?? 0)));
  // «No detallat» sempre al final
  // «No detallat» sempre al final i mai barrejat amb «Resta de sectors»
  const nd = rows.filter(r => /no detallat/.test(r.label));
  rows = rows.filter(r => !/no detallat/.test(r.label));
  if (rows.length > max) {
    const rest = rows.slice(max - 1);
    rows = [...rows.slice(0, max - 1), { label: 'Resta de sectors', a: rest.reduce((s, r) => s + r.a, 0), b: b ? rest.reduce((s, r) => s + (r.b ?? 0), 0) : undefined }];
  }
  rows = [...rows, ...nd];
  if (missing(a) > 0.4 || (b && missing(b) > 0.4)) rows.push({ label: 'Sense dades', a: missing(a), b: b ? missing(b) : undefined });
  return rows;
}

function Dimension({ title, rows, compare }: { title: string; rows: Row[]; compare: boolean }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-ink-muted text-[11px] mb-1.5">{title}</p>
      <div className="space-y-1">
        {rows.map(r => (
          <div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2 items-center" role="img"
            aria-label={`${r.label}: proposta ${pct(r.a)}${compare ? `, cartera actual ${pct(r.b ?? 0)}` : ''}`}>
            <span className={`text-xs truncate ${r.label === 'Sense dades' ? 'text-ink-muted italic' : 'text-ink-soft'}`} title={r.label}>{r.label}</span>
            <div className="space-y-0.5">
              <Bar v={r.a} tone={r.label === 'Sense dades' ? 'bg-line' : 'bg-accent'} />
              {compare && <Bar v={r.b ?? 0} tone={r.label === 'Sense dades' ? 'bg-line' : 'bg-ink-muted'} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ v, tone }: { v: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-subtle overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
      </div>
      <span className="text-[11px] text-ink tabular-nums w-10 text-right">{pct(v)}</span>
    </div>
  );
}

export default function DiversificationSummary({ items, current, className = '' }: {
  items: WeightedItem[];
  current?: WeightedItem[];   // cartera actual del client (per comparar)
  className?: string;
}) {
  const a = useMemo(() => exposureBreakdown(items), [items]);
  const b = useMemo(() => (current?.length ? exposureBreakdown(current) : undefined), [current]);
  const compare = !!b && b.equity > 0;
  if (a.equity <= 0 && !compare) return null;
  const bb = compare ? b : undefined;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <p className="text-ink text-sm font-medium">Diversificació de la renda variable</p>
        <div className="flex gap-4 text-[11px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-accent" />Proposta ({pct(a.equity)} en RV)</span>
          {compare && <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-ink-muted" />Cartera actual ({pct(b!.equity)} en RV)</span>}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        <Dimension title="Regió" compare={compare}
          rows={rowsFor(REGIONS, REGION_LABEL, a, bb, x => x.region, x => x.regionMissing)} />
        <Dimension title="Sector" compare={compare}
          rows={rowsFor(SECTORS, SECTOR_LABEL, a, bb, x => x.sector, x => x.sectorMissing, 7)} />
        <div className="space-y-5">
          <Dimension title="Mida d'empresa" compare={compare}
            rows={rowsFor(SIZES, SIZE_LABEL, a, bb, x => x.size, x => x.sizeMissing)} />
          <Concentration a={a} b={bb} />
        </div>
      </div>
      <p className="text-ink-muted text-[11px] mt-3">
        Percentatges sobre la part en renda variable de cada cartera, segons la fitxa oficial de cada fons
        {asOfLabel(a) ? ` (dades ${asOfLabel(a)})` : ''}. «No detallat»: la fitxa només publica els països o sectors principals.
        {a.missingFunds.length > 0 && ` Sense fitxa carregada: ${a.missingFunds.join(', ')}.`}
        {compare && b!.missingFunds.length > 0 && ` Cartera actual sense fitxa: ${b!.missingFunds.join(', ')}.`}
      </p>
    </div>
  );
}

function Concentration({ a, b }: { a: ExposureBreakdown; b?: ExposureBreakdown }) {
  if (a.top10 == null && b?.top10 == null) return null;
  const list = (x: ExposureBreakdown) => x.companies.slice(0, 5);
  return (
    <div>
      <p className="text-ink-muted text-[11px] mb-1.5">Concentració</p>
      <p className="text-xs text-ink-soft">
        Les 10 primeres posicions de cada fons pesen de mitjana{' '}
        <span className="text-ink font-semibold">{a.top10 != null ? pct(a.top10) : '—'}</span>
        {b && <> (cartera actual <span className="text-ink font-semibold">{b.top10 != null ? pct(b.top10) : '—'}</span>)</>}.
      </p>
      {a.companies.length > 0 && (
        <div className={`mt-2 grid ${b?.companies.length ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
          <Companies title="Més pes a la proposta" rows={list(a)} />
          {b && b.companies.length > 0 && <Companies title="Més pes a la cartera actual" rows={list(b)} />}
        </div>
      )}
      <p className="text-ink-muted text-[10px] mt-1">% sobre el total de la cartera. És un mínim: només es veu el top-10 de cada fons.</p>
    </div>
  );
}

function Companies({ title, rows }: { title: string; rows: { name: string; pct: number }[] }) {
  return (
    <div>
      <p className="text-[10px] text-ink-muted">{title}</p>
      <ul className="mt-0.5 space-y-0.5">
        {rows.map(c => (
          <li key={c.name} className="flex justify-between gap-2 text-[11px]">
            <span className="text-ink-soft truncate" title={c.name}>{c.name}</span>
            <span className="text-ink tabular-nums">{pct(c.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
