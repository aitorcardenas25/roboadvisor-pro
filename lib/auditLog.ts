// Audit trail — in-memory store (last 1000 events).
// Replace with Supabase persistence once the DB is configured.

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'report.generated'
  | 'report.email_sent'
  | 'portfolio.created'
  | 'portfolio.updated'
  | 'portfolio.deleted'
  | 'client.created'
  | 'client.role_changed'
  | 'client.deactivated'
  | 'newsletter.sent'
  | 'fund.created'
  | 'fund.updated'
  | 'fund.deleted';

export interface AuditEntry {
  id:        string;
  timestamp: string;
  action:    AuditAction;
  userId:    string | null;
  userEmail: string | null;
  resource:  string | null;
  metadata:  Record<string, unknown>;
  ip:        string | null;
}

const MAX_ENTRIES = 1_000;
const _log: AuditEntry[] = [];

export function logAuditEvent(
  action: AuditAction,
  opts: {
    userId?:    string;
    userEmail?: string;
    resource?:  string;
    metadata?:  Record<string, unknown>;
    ip?:        string;
  } = {},
): AuditEntry {
  const entry: AuditEntry = {
    id:        `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    userId:    opts.userId    ?? null,
    userEmail: opts.userEmail ?? null,
    resource:  opts.resource  ?? null,
    metadata:  opts.metadata  ?? {},
    ip:        opts.ip        ?? null,
  };

  _log.unshift(entry);
  if (_log.length > MAX_ENTRIES) _log.pop();

  return entry;
}

export interface GetAuditLogOpts {
  limit?:   number;
  action?:  AuditAction;
  userId?:  string;
  since?:   string;
  search?:  string;
}

export function getAuditLog(opts: GetAuditLogOpts = {}): AuditEntry[] {
  let entries = [..._log];

  if (opts.action)  entries = entries.filter(e => e.action  === opts.action);
  if (opts.userId)  entries = entries.filter(e => e.userId  === opts.userId);
  if (opts.since)   entries = entries.filter(e => e.timestamp >= opts.since!);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    entries = entries.filter(e =>
      e.action.includes(q)    ||
      e.userId?.toLowerCase().includes(q) ||
      e.userEmail?.toLowerCase().includes(q) ||
      e.resource?.toLowerCase().includes(q),
    );
  }

  return entries.slice(0, opts.limit ?? 100);
}

export function auditLogStats(): { total: number; byAction: Record<string, number> } {
  const byAction: Record<string, number> = {};
  for (const entry of _log) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
  }
  return { total: _log.length, byAction };
}
