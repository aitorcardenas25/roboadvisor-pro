'use client';

import { memo, useEffect } from 'react';
import {
  DATA_SOURCES, SOURCES_BY_CATEGORY, CATEGORY_LABELS,
  type DataSourceDef, type SourceCategory,
} from '@/lib/dataSourceRegistry';

// ── Cartera data → source mapping ────────────────────────────────────────────

const CARTERA_MAP: { icon: string; label: string; detail: string; sourceIds: string[] }[] = [
  {
    icon:      '€',
    label:     'Valor total, P&L, rendibilitat',
    detail:    'Calculat internament a partir del preu actual i el cost d\'adquisició',
    sourceIds: ['internal', 'fmp'],
  },
  {
    icon:      '📈',
    label:     'Preu actual de cada actiu',
    detail:    'Font primaria: FMP. Fallback: Alpha Vantage → Yahoo Finance',
    sourceIds: ['fmp', 'alphavantage', 'yahoo'],
  },
  {
    icon:      '📷',
    label:     'Evolució del patrimoni',
    detail:    'Instantànies periòdiques guardades a la base de dades',
    sourceIds: ['supabase'],
  },
  {
    icon:      '◑',
    label:     'Distribució per actiu i categoria',
    detail:    'Calculada a partir dels pesos actuals de la cartera',
    sourceIds: ['internal'],
  },
  {
    icon:      '↕',
    label:     'Moviments i transaccions',
    detail:    'Registrades per l\'assessor a la base de dades',
    sourceIds: ['supabase'],
  },
  {
    icon:      '✉',
    label:     'Notes de l\'assessor',
    detail:    'Escrites per l\'assessor i emmagatzemades de forma segura',
    sourceIds: ['supabase'],
  },
  {
    icon:      '📄',
    label:     'Informes mensuals',
    detail:    'Generats per FACTOR OTC i arxivats a la base de dades',
    sourceIds: ['internal', 'supabase'],
  },
  {
    icon:      '📧',
    label:     'Notificacions per email',
    detail:    'Enviades via Resend quan hi ha nous informes o comunicats',
    sourceIds: ['resend'],
  },
];

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ def }: { def: DataSourceDef }) {
  const isInternal = def.id === 'internal';

  return (
    <div
      className="relative rounded-xl border p-4 flex flex-col gap-2.5 overflow-hidden"
      style={{
        backgroundColor: `${def.accentColor}07`,
        borderColor:     `${def.accentColor}20`,
      }}
    >
      {/* accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, ${def.accentColor}40, transparent)` }}
      />

      {/* header */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
          style={{ backgroundColor: `${def.accentColor}18`, color: def.accentColor }}
        >
          {def.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/85 text-sm font-semibold">{def.name}</span>
            {!def.apiKeyRequired && !isInternal && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/70">
                Gratuït
              </span>
            )}
          </div>
          <p className="text-white/30 text-[10px] truncate">{def.url.replace('https://', '')}</p>
        </div>
      </div>

      {/* description */}
      <p className="text-white/45 text-xs leading-relaxed">{def.description}</p>

      {/* use cases */}
      <div className="flex flex-wrap gap-1.5">
        {def.usedFor.slice(0, 3).map(u => (
          <span
            key={u}
            className="text-[10px] px-2 py-0.5 rounded-full border"
            style={{
              color:           `${def.accentColor}80`,
              borderColor:     `${def.accentColor}20`,
              backgroundColor: `${def.accentColor}08`,
            }}
          >
            {u}
          </span>
        ))}
        {def.usedFor.length > 3 && (
          <span className="text-[10px] text-white/20">+{def.usedFor.length - 3} més</span>
        )}
      </div>
    </div>
  );
}

// ── Category group ────────────────────────────────────────────────────────────

const CATEGORY_ORDER: SourceCategory[] = [
  'market_data', 'fx', 'persistence', 'communication', 'payment', 'internal',
];

function CategoryGroup({ cat }: { cat: SourceCategory }) {
  const sources = SOURCES_BY_CATEGORY[cat];
  if (!sources.length) return null;

  return (
    <div>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-3 font-semibold">
        {CATEGORY_LABELS[cat]}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map(def => <SourceCard key={def.id} def={def} />)}
      </div>
    </div>
  );
}

// ── Data flow row ─────────────────────────────────────────────────────────────

function FlowRow({
  icon, label, detail, sourceIds,
}: { icon: string; label: string; detail: string; sourceIds: string[] }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-white/70 text-sm font-medium">{label}</p>
            <p className="text-white/30 text-xs mt-0.5">{detail}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
            {sourceIds.map(sid => {
              const def = DATA_SOURCES[sid as keyof typeof DATA_SOURCES];
              if (!def) return null;
              return (
                <span
                  key={sid}
                  className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                  style={{
                    color:           def.accentColor,
                    borderColor:     `${def.accentColor}25`,
                    backgroundColor: `${def.accentColor}10`,
                  }}
                >
                  {def.shortName}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export const DataSourcePanel = memo(function DataSourcePanel({ onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-2xl bg-[#080f0c] border-l border-white/[0.07] z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-label="D'on surt cada dada?"
      >
        {/* header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h2 className="text-white font-black text-xl">D&apos;on surt cada dada?</h2>
            <p className="text-white/35 text-sm mt-1">
              Totes les dades del teu dashboard amb la font exacta i el nivell de confiança.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-colors flex-shrink-0 ml-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* section 1: data flow map */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-md bg-[#c9a84c]/10 border border-[#c9a84c]/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]/60" />
              </div>
              <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wider">
                La meva cartera — origen de cada dada
              </h3>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              {CARTERA_MAP.map(row => (
                <FlowRow key={row.label} {...row} />
              ))}
            </div>
          </div>

          {/* section 2: all sources */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
              </div>
              <h3 className="text-white/70 text-sm font-semibold uppercase tracking-wider">
                Totes les fonts, una a una
              </h3>
            </div>
            <div className="space-y-6">
              {CATEGORY_ORDER.map(cat => (
                <CategoryGroup key={cat} cat={cat} />
              ))}
            </div>
          </div>

          {/* footer note */}
          <div className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-4">
            <p className="text-white/25 text-xs leading-relaxed">
              <span className="text-white/40 font-semibold">Sobre la fiabilitat:</span>{' '}
              Les fonts s&apos;utilitzen per ordre de prioritat. Si la font primaria no retorna dades,
              s&apos;activa automàticament la font de suport. Cap dada s&apos;inventa:
              si cap font respon, el valor es marca com a <em>pendent</em> fins que l&apos;assessor l&apos;actualitzi.
            </p>
          </div>
        </div>
      </div>
    </>
  );
});
