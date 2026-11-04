'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { IntegrationCheck, HealthReport, IntegrationStatus } from '@/lib/integrationHealthService';
import { DATA_SOURCES, CATEGORY_LABELS, type SourceId, type SourceCategory } from '@/lib/dataSourceRegistry';

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ok:          { label: 'Connectat',     dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/8',  border: 'border-emerald-400/20' },
  missing_key: { label: 'Falta API key', dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-400/8',    border: 'border-amber-400/20'   },
  error:       { label: 'Error',         dot: 'bg-red-400',     text: 'text-red-400',     bg: 'bg-red-400/8',      border: 'border-red-400/20'     },
  demo:        { label: 'Mode demo',     dot: 'bg-blue-400',    text: 'text-blue-400',    bg: 'bg-blue-400/8',     border: 'border-blue-400/20'    },
};

// ── Group definitions (ordered) ───────────────────────────────────────────────

const GROUP_ORDER: { cat: SourceCategory; ids: string[] }[] = [
  { cat: 'market_data',   ids: ['fmp', 'alphavantage', 'yahoo', 'ecb', 'tradingview'] },
  { cat: 'fx',            ids: ['frankfurter'] },
  { cat: 'persistence',   ids: ['supabase', 'newsletter'] },
  { cat: 'communication', ids: ['resend'] },
  { cat: 'payment',       ids: ['stripe'] },
];

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({ check }: { check: IntegrationCheck }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[check.status];
  const def = DATA_SOURCES[check.id as SourceId];

  return (
    <motion.div
      layout
      className={`border rounded-xl overflow-hidden transition-colors ${cfg.border} ${check.status === 'ok' ? 'bg-white/3' : cfg.bg}`}>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors">

        {/* icon / initials */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border text-xs font-black"
          style={def ? {
            backgroundColor: `${def.accentColor}15`,
            borderColor:     `${def.accentColor}30`,
            color:            def.accentColor,
          } : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}
        >
          {def?.initials ?? check.id.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-white text-sm">{check.name}</span>
            <StatusBadge status={check.status} />
            {def && !def.apiKeyRequired && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/8 border border-emerald-500/15 text-emerald-400/60">
                Sense API key
              </span>
            )}
            {check.keyHint && (
              <span className="text-white/30 text-xs font-mono">clau: {check.keyHint}</span>
            )}
          </div>
          <p className="text-white/50 text-xs mt-0.5 line-clamp-1">{check.message}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {check.latencyMs !== undefined && (
            <span className="text-white/30 text-xs">{check.latencyMs}ms</span>
          )}
          <svg
            className={`w-4 h-4 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden">
            <div className="px-5 pb-4 space-y-3 border-t border-white/6 pt-4">
              <p className="text-white/70 text-sm">{check.message}</p>

              {/* use cases from registry */}
              {def && def.usedFor.length > 0 && (
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2 font-semibold">On s&apos;utilitza</p>
                  <div className="flex flex-wrap gap-1.5">
                    {def.usedFor.map(u => (
                      <span
                        key={u}
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          color:           `${def.accentColor}70`,
                          borderColor:     `${def.accentColor}20`,
                          backgroundColor: `${def.accentColor}08`,
                        }}
                      >
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {check.action && (
                <div className="flex items-start gap-2 bg-[#c9a84c]/8 border border-[#c9a84c]/20 rounded-lg px-3 py-2.5">
                  <span className="text-[#c9a84c] text-sm flex-shrink-0">→</span>
                  <p className="text-[#c9a84c]/80 text-xs">{check.action}</p>
                </div>
              )}
              <p className="text-white/25 text-xs">
                Comprovat: {new Date(check.checkedAt).toLocaleTimeString('ca-ES')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Group of integrations ─────────────────────────────────────────────────────

function IntegrationGroup({
  cat, ids, checks,
}: { cat: SourceCategory; ids: string[]; checks: IntegrationCheck[] }) {
  const grouped = ids
    .map(id => checks.find(c => c.id === id))
    .filter((c): c is IntegrationCheck => !!c);

  if (!grouped.length) return null;

  return (
    <div>
      <p className="text-white/25 text-[10px] uppercase tracking-widest mb-2.5 font-semibold pl-1">
        {CATEGORY_LABELS[cat]}
      </p>
      <div className="space-y-2">
        {grouped.map(check => <IntegrationCard key={check.id} check={check} />)}
      </div>
    </div>
  );
}

// ── Overall banner ────────────────────────────────────────────────────────────

function OverallBanner({ report }: { report: HealthReport }) {
  const ok    = report.checks.filter(c => c.status === 'ok').length;
  const total = report.checks.length;
  const cfg   = report.overall === 'ok'
    ? { text: 'text-emerald-400', bg: 'bg-emerald-400/8', border: 'border-emerald-400/20', label: 'Totes les integracions actives' }
    : report.overall === 'degraded'
    ? { text: 'text-amber-400',   bg: 'bg-amber-400/8',   border: 'border-amber-400/20',   label: 'Algunes integracions necessiten configuració' }
    : { text: 'text-red-400',     bg: 'bg-red-400/8',     border: 'border-red-400/20',     label: 'Errors en integracions crítiques' };

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border ${cfg.border} ${cfg.bg}`}>
      <div className={`text-lg ${cfg.text}`}>
        {report.overall === 'ok' ? '✓' : report.overall === 'degraded' ? '⚠' : '✗'}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
        <p className="text-white/40 text-xs mt-0.5">
          {ok}/{total} actives · Comprovat: {new Date(report.checkedAt).toLocaleTimeString('ca-ES')}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntegrationsManager() {
  const [report,  setReport]  = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/integrations/health');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Integracions</h1>
          <p className="text-white/40 text-sm">
            Estat de totes les connexions externes en temps real.
            Clica qualsevol integració per veure on s&apos;utilitza.
          </p>
        </div>
        <motion.button
          onClick={fetchHealth}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/8 border border-white/15 rounded-lg text-white/70 hover:text-white hover:border-white/30 text-sm transition-colors disabled:opacity-50">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Comprovant...' : 'Re-comprovar'}
        </motion.button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-xl">
          <span className="text-red-400">✗</span>
          <p className="text-red-400/80 text-sm">{error}</p>
        </div>
      )}

      {loading && !report && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {report && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6">

          <OverallBanner report={report} />

          {GROUP_ORDER.map(({ cat, ids }) => (
            <IntegrationGroup
              key={cat}
              cat={cat}
              ids={ids}
              checks={report.checks}
            />
          ))}

          <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Com configurar</p>
            <p className="text-white/50 text-xs leading-relaxed">
              Les claus API <strong className="text-white/70">mai</strong> s&apos;han d&apos;introduir via el panel d&apos;admin.
              Afegeix-les al fitxer{' '}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">.env.local</code>{' '}
              al servidor i reinicia. Consulta{' '}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">.env.example</code>{' '}
              per a la llista completa de variables.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
