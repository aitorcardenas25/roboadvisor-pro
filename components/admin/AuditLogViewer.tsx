'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AuditEntry, AuditAction } from '@/lib/auditLog';

const ACTION_COLORS: Record<string, string> = {
  'auth.login':         'text-positive',
  'auth.logout':        'text-ink-muted',
  'report.generated':   'text-accent',
  'report.email_sent':  'text-info',
  'portfolio.created':  'text-positive',
  'portfolio.updated':  'text-warning',
  'portfolio.deleted':  'text-negative',
  'client.created':     'text-positive',
  'client.role_changed':'text-warning',
  'client.deactivated': 'text-negative',
  'client.finances_updated': 'text-warning',
  'client.data_exported':    'text-info',
  'client.deletion_requested': 'text-negative',
  'client.consent_accepted':  'text-positive',
  'client.password_changed':  'text-warning',
  'client.welcome_sent':      'text-info',
  'client.expense_added':     'text-warning',
  'client.expense_removed':   'text-ink-soft',
  'newsletter.sent':    'text-info',
  'fund.created':       'text-positive',
  'fund.updated':       'text-warning',
  'fund.deleted':       'text-negative',
};

const ACTIONS: AuditAction[] = [
  'auth.login', 'auth.logout',
  'report.generated', 'report.email_sent',
  'portfolio.created', 'portfolio.updated', 'portfolio.deleted',
  'client.created', 'client.role_changed', 'client.deactivated',
  'client.finances_updated', 'client.data_exported', 'client.deletion_requested',
  'client.consent_accepted', 'client.password_changed', 'client.welcome_sent',
  'client.expense_added', 'client.expense_removed',
  'newsletter.sent', 'fund.created', 'fund.updated', 'fund.deleted',
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ca-ES', { dateStyle: 'short', timeStyle: 'medium' });
}

interface Stats {
  total:     number;
  byAction:  Record<string, number>;
}

export default function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<AuditAction | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filter)  params.set('action', filter);
      if (search)  params.set('search', search);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json() as { entries: AuditEntry[]; stats: Stats };
      setEntries(data.entries ?? []);
      setStats(data.stats ?? null);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const topActions = stats
    ? Object.entries(stats.byAction).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-ink text-xl font-bold mb-1">Registre d&apos;activitat</h2>
          <p className="text-ink-muted text-sm">
            {`${stats?.total ?? 0} esdeveniments registrats · s'actualitza cada 30 s`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-ink-muted hover:text-ink border border-line hover:border-line-strong rounded-lg text-sm transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualitzar
        </button>
      </div>

      {/* Stats strip */}
      {topActions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {topActions.map(([action, count]) => (
            <button
              key={action}
              onClick={() => setFilter(prev => prev === action ? '' : action as AuditAction)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                filter === action
                  ? 'border-accent/50 bg-accent-soft text-accent'
                  : 'border-line bg-subtle text-ink-muted hover:text-ink'
              }`}>
              <span className={ACTION_COLORS[action] ?? 'text-ink-muted'}>●</span>
              {action}
              <span className="bg-subtle-strong px-1.5 py-0.5 rounded text-xs">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter row */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cercar per usuari, acció, recurs..."
            className="w-full bg-subtle border border-line rounded-lg pl-9 pr-3 py-2 text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-accent/40"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as AuditAction | '')}
          className="bg-subtle border border-line rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-accent/40">
          <option value="" style={{ background: 'rgb(var(--c-surface))' }}>Totes les accions</option>
          {ACTIONS.map(a => (
            <option key={a} value={a} style={{ background: 'rgb(var(--c-surface))' }}>{a}</option>
          ))}
        </select>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          {filter || search ? 'Cap resultat per aquesta cerca.' : 'Encara no hi ha events registrats.'}
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-line text-ink-muted text-xs font-medium font-medium">
            <div className="col-span-2">Hora</div>
            <div className="col-span-3">Acció</div>
            <div className="col-span-3">Usuari</div>
            <div className="col-span-2">Recurs</div>
            <div className="col-span-2">IP</div>
          </div>

          <div className="divide-y divide-line max-h-[600px] overflow-y-auto">
            {entries.map(entry => (
              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-start hover:bg-subtle transition-colors">
                <div className="col-span-2 text-ink-muted text-xs font-mono mt-0.5">
                  {formatTime(entry.timestamp)}
                </div>
                <div className="col-span-3">
                  <span className={`text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'text-ink-soft'}`}>
                    {entry.action}
                  </span>
                </div>
                <div className="col-span-3 min-w-0">
                  {entry.userEmail ? (
                    <div className="text-ink-soft text-xs truncate">{entry.userEmail}</div>
                  ) : (
                    <span className="text-ink-muted text-xs">—</span>
                  )}
                </div>
                <div className="col-span-2 text-ink-muted text-xs truncate font-mono">
                  {entry.resource ?? '—'}
                </div>
                <div className="col-span-2 text-ink-muted text-xs font-mono truncate">
                  {entry.ip ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
