'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IntegrationCheck, HealthReport, IntegrationStatus } from '@/lib/integrationHealthService';
import { DATA_SOURCES, CATEGORY_LABELS, type SourceId, type SourceCategory } from '@/lib/dataSourceRegistry';

// ── Status styles ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
  ok:          { label: 'Connectat',     dot: 'bg-positive', text: 'text-positive', bg: 'bg-positive/8',  border: 'border-positive/20' },
  missing_key: { label: 'Falta API key', dot: 'bg-warning',   text: 'text-warning',   bg: 'bg-warning/8',    border: 'border-warning/20'   },
  error:       { label: 'Error',         dot: 'bg-negative',     text: 'text-negative',     bg: 'bg-negative/8',      border: 'border-negative/20'     },
  demo:        { label: 'Mode demo',     dot: 'bg-info',    text: 'text-info',    bg: 'bg-info/8',     border: 'border-info/20'    },
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
    <div

      className={`border rounded-lg overflow-hidden transition-colors ${cfg.border} ${check.status === 'ok' ? 'bg-subtle' : cfg.bg}`}>

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-subtle transition-colors">

        {/* icon / initials */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border text-xs font-semibold"
          style={def ? {
            backgroundColor: `${def.accentColor}15`,
            borderColor:     `${def.accentColor}30`,
            color:            def.accentColor,
          } : { backgroundColor: 'rgb(var(--c-subtle))', borderColor: 'rgb(var(--c-line))', color: 'rgb(var(--c-ink-muted))' }}
        >
          {def?.initials ?? check.id.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-ink text-sm">{check.name}</span>
            <StatusBadge status={check.status} />
            {def && !def.apiKeyRequired && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-positive/8 border border-positive/15 text-positive/60">
                Sense API key
              </span>
            )}
            {check.keyHint && (
              <span className="text-ink-muted text-xs font-mono">clau: {check.keyHint}</span>
            )}
          </div>
          <p className="text-ink-soft text-xs mt-0.5 line-clamp-1">{check.message}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {check.latencyMs !== undefined && (
            <span className="text-ink-muted text-xs">{check.latencyMs}ms</span>
          )}
          <svg
            className={`w-4 h-4 text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <>
        {expanded && (
          <div
            className="overflow-hidden">
            <div className="px-5 pb-4 space-y-3 border-t border-line pt-4">
              <p className="text-ink-soft text-sm">{check.message}</p>

              {/* use cases from registry */}
              {def && def.usedFor.length > 0 && (
                <div>
                  <p className="text-ink-muted text-[10px] font-medium mb-2 font-semibold">On s&apos;utilitza</p>
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
                <div className="flex items-start gap-2 bg-accent-soft border border-accent/20 rounded-lg px-3 py-2.5">
                  <span className="text-accent text-sm flex-shrink-0">→</span>
                  <p className="text-accent/80 text-xs">{check.action}</p>
                </div>
              )}
              <p className="text-ink-muted text-xs">
                Comprovat: {new Date(check.checkedAt).toLocaleTimeString('ca-ES')}
              </p>
            </div>
          </div>
        )}
      </>
    </div>
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
      <p className="text-ink-muted text-[10px] font-medium mb-2.5 font-semibold pl-1">
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
    ? { text: 'text-positive', bg: 'bg-positive/8', border: 'border-positive/20', label: 'Totes les integracions actives' }
    : report.overall === 'degraded'
    ? { text: 'text-warning',   bg: 'bg-warning/8',   border: 'border-warning/20',   label: 'Algunes integracions necessiten configuració' }
    : { text: 'text-negative',     bg: 'bg-negative/8',     border: 'border-negative/20',     label: 'Errors en integracions crítiques' };

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 rounded-lg border ${cfg.border} ${cfg.bg}`}>
      <div className={`text-lg ${cfg.text}`}>
        {report.overall === 'ok' ? '✓' : report.overall === 'degraded' ? '⚠' : '✗'}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</p>
        <p className="text-ink-muted text-xs mt-0.5">
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
          <h1 className="text-2xl font-semibold text-ink mb-1">Integracions</h1>
          <p className="text-ink-muted text-sm">
            Estat de totes les connexions externes en temps real.
            Clica qualsevol integració per veure on s&apos;utilitza.
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-subtle border border-line-strong rounded-lg text-ink-soft hover:text-ink hover:border-line-strong text-sm transition-colors disabled:opacity-50">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Comprovant...' : 'Re-comprovar'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-negative/8 border border-negative/20 rounded-lg">
          <span className="text-negative">✗</span>
          <p className="text-negative/80 text-sm">{error}</p>
        </div>
      )}

      {loading && !report && (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-subtle rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {report && (
        <div
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

          <div className="bg-subtle border border-line rounded-lg p-4 space-y-2">
            <p className="text-ink-muted text-xs font-semibold font-medium">Com configurar</p>
            <p className="text-ink-soft text-xs leading-relaxed">
              Les claus API <strong className="text-ink-soft">mai</strong> s&apos;han d&apos;introduir via el panel d&apos;admin.
              Afegeix-les al fitxer{' '}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">.env.local</code>{' '}
              al servidor i reinicia. Consulta{' '}
              <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">.env.example</code>{' '}
              per a la llista completa de variables.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
