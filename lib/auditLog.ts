import { getDb } from './supabase';

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'report.generated'
  | 'report.email_sent'
  | 'portfolio.created'
  | 'portfolio.updated'
  | 'portfolio.deleted'
  | 'portfolio.imported'
  | 'proposal.saved'
  | 'proposal.approved'
  | 'client.created'
  | 'client.role_changed'
  | 'client.deactivated'
  | 'client.finances_updated'
  | 'client.data_exported'
  | 'client.deletion_requested'
  | 'client.consent_accepted'
  | 'client.password_changed'
  | 'client.welcome_sent'
  | 'client.expense_added'
  | 'client.expense_removed'
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

  // Best-effort Supabase persistence (non-blocking)
  const db = getDb();
  if (db) {
    db.from('audit_log').insert({
      id:         entry.id,
      timestamp:  entry.timestamp,
      action:     entry.action,
      user_id:    entry.userId,
      user_email: entry.userEmail,
      resource:   entry.resource,
      metadata:   entry.metadata,
      ip:         entry.ip,
    }).then(({ error }) => {
      if (error) { /* silent — in-memory fallback is always populated */ }
    });
  }

  return entry;
}

export interface GetAuditLogOpts {
  limit?:   number;
  action?:  AuditAction;
  userId?:  string;
  since?:   string;
  search?:  string;
}

export async function getAuditLog(opts: GetAuditLogOpts = {}): Promise<AuditEntry[]> {
  const db = getDb();

  if (db) {
    let query = db.from('audit_log').select('*').order('timestamp', { ascending: false });
    if (opts.action)  query = query.eq('action', opts.action);
    if (opts.userId)  query = query.eq('user_id', opts.userId);
    if (opts.since)   query = query.gte('timestamp', opts.since);
    query = query.limit(opts.limit ?? 100);

    const { data, error } = await query;
    if (!error && data) {
      let entries = data.map((r: Record<string, unknown>) => ({
        id:        r.id as string,
        timestamp: r.timestamp as string,
        action:    r.action as AuditAction,
        userId:    r.user_id as string | null,
        userEmail: r.user_email as string | null,
        resource:  r.resource as string | null,
        metadata:  (r.metadata as Record<string, unknown>) ?? {},
        ip:        r.ip as string | null,
      }));
      if (opts.search) {
        const q = opts.search.toLowerCase();
        entries = entries.filter(e =>
          e.action.includes(q) ||
          e.userId?.toLowerCase().includes(q) ||
          e.userEmail?.toLowerCase().includes(q) ||
          e.resource?.toLowerCase().includes(q),
        );
      }
      return entries;
    }
  }

  // Fallback: in-memory
  let entries = [..._log];
  if (opts.action)  entries = entries.filter(e => e.action  === opts.action);
  if (opts.userId)  entries = entries.filter(e => e.userId  === opts.userId);
  if (opts.since)   entries = entries.filter(e => e.timestamp >= opts.since!);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    entries = entries.filter(e =>
      e.action.includes(q) ||
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
