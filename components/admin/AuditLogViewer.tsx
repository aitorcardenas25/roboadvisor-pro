'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AuditEntry, AuditAction } from '@/lib/auditLog';

const ACTION_COLORS: Record<string, string> = {
  'auth.login':         'text-green-400',
  'auth.logout':        'text-white/40',
  'report.generated':   'text-[#c9a84c]',
  'report.email_sent':  'text-blue-400',
  'portfolio.created':  'text-emerald-400',
  'portfolio.updated':  'text-yellow-400',
  'portfolio.deleted':  'text-red-400',
  'client.created':     'text-emerald-400',
  'client.role_changed':'text-yellow-400',
  'client.deactivated': 'text-red-400',
  'newsletter.sent':    'text-purple-400',
  'fund.created':       'text-emerald-400',
  'fund.updated':       'text-yellow-400',
  'fund.deleted':       'text-red-400',
};

const ACTIONS: AuditAction[] = [
  'auth.login', 'auth.logout',
  'report.generated', 'report.email_sent',
  'portfolio.created', 'portfolio.updated', 'portfolio.deleted',
  'client.created', 'client.role_changed', 'client.deactivated',
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
          <h2 className="text-white text-xl font-bold mb-1">Audit Trail</h2>
          <p className="text-white/40 text-sm">
            {stats?.total ?? 0} events registrats · s&apos;actualitza cada 30s
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-white/40 hover:text-white border border-white/10 hover:border-white/20 rounded-lg text-sm transition-all">
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
                  ? 'border-[#c9a84c]/50 bg-[#c9a84c]/10 text-[#c9a84c]'
                  : 'border-white/10 bg-white/5 text-white/40 hover:text-white'
              }`}>
              <span className={ACTION_COLORS[action] ?? 'text-white/40'}>●</span>
              {action}
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-xs">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + filter row */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cercar per usuari, acció, recurs..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c9a84c]/40"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as AuditAction | '')}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a84c]/40">
          <option value="" style={{ background: '#0d1f1a' }}>Totes les accions</option>
          {ACTIONS.map(a => (
            <option key={a} value={a} style={{ background: '#0d1f1a' }}>{a}</option>
          ))}
        </select>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          {filter || search ? 'Cap resultat per aquesta cerca.' : 'Encara no hi ha events registrats.'}
        </div>
      ) : (
        <div className="bg-[#0d1f1a] border border-white/10 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-white/10 text-white/30 text-xs font-medium uppercase tracking-wide">
            <div className="col-span-2">Hora</div>
            <div className="col-span-3">Acció</div>
            <div className="col-span-3">Usuari</div>
            <div className="col-span-2">Recurs</div>
            <div className="col-span-2">IP</div>
          </div>

          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
            {entries.map(entry => (
              <div key={entry.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-start hover:bg-white/[0.02] transition-colors">
                <div className="col-span-2 text-white/30 text-xs font-mono mt-0.5">
                  {formatTime(entry.timestamp)}
                </div>
                <div className="col-span-3">
                  <span className={`text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'text-white/50'}`}>
                    {entry.action}
                  </span>
                </div>
                <div className="col-span-3 min-w-0">
                  {entry.userEmail ? (
                    <div className="text-white/60 text-xs truncate">{entry.userEmail}</div>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </div>
                <div className="col-span-2 text-white/30 text-xs truncate font-mono">
                  {entry.resource ?? '—'}
                </div>
                <div className="col-span-2 text-white/20 text-xs font-mono truncate">
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
