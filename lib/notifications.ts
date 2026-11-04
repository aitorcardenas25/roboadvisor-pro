import { getDb } from './supabase';

export type NotificationType =
  | 'new_lead'
  | 'questionnaire_completed'
  | 'client_converted'
  | 'monthly_report_due'
  | 'stale_prices'
  | 'api_error';

export interface AdminNotification {
  id:        string;
  type:      NotificationType;
  title:     string;
  message:   string;
  link?:     string;
  readAt?:   string;
  createdAt: string;
}

const MAX = 200;
const _store: AdminNotification[] = [];

function rowToNotification(r: Record<string, unknown>): AdminNotification {
  return {
    id:        r.id as string,
    type:      r.type as NotificationType,
    title:     r.title as string,
    message:   r.message as string,
    link:      r.link as string | undefined,
    readAt:    r.read_at as string | undefined,
    createdAt: (r.created_at as string) ?? new Date().toISOString(),
  };
}

export async function createNotification(
  input: Pick<AdminNotification, 'type' | 'title' | 'message' | 'link'>
): Promise<AdminNotification> {
  const n: AdminNotification = {
    ...input,
    id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  if (!db) {
    _store.unshift(n);
    if (_store.length > MAX) _store.pop();
    return n;
  }

  const { error } = await db.from('notifications').insert({
    id:         n.id,
    type:       n.type,
    title:      n.title,
    message:    n.message,
    link:       n.link ?? null,
    created_at: n.createdAt,
  });
  if (error) {
    // Fallback to in-memory if insert fails (e.g. table doesn't exist yet)
    _store.unshift(n);
    if (_store.length > MAX) _store.pop();
  }
  return n;
}

export async function getNotifications(limit = 50): Promise<AdminNotification[]> {
  const db = getDb();
  if (!db) return _store.slice(0, limit);

  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100));

  if (error) return _store.slice(0, limit);
  return (data ?? []).map(rowToNotification);
}

export async function getUnreadCount(): Promise<number> {
  const db = getDb();
  if (!db) return _store.filter(n => !n.readAt).length;

  const { count, error } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .is('read_at', null);

  if (error) return _store.filter(n => !n.readAt).length;
  return count ?? 0;
}

export async function markAsRead(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    const n = _store.find(x => x.id === id);
    if (!n) return false;
    n.readAt = now;
    return true;
  }
  const { error } = await db.from('notifications').update({ read_at: now }).eq('id', id);
  return !error;
}

export async function markAllAsRead(): Promise<void> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    _store.forEach(n => { if (!n.readAt) n.readAt = now; });
    return;
  }
  await db.from('notifications').update({ read_at: now }).is('read_at', null);
}
