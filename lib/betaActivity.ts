// lib/betaActivity.ts
// Ús de la beta: registra quan un client entra i què consulta, i calcula
// l'ús setmanal per client. Decisió 2026-11-04: al mes 3 es mira l'ús setmanal.
// Només es guarda usuari, tipus d'esdeveniment i hora: cap dada financera.
import { getDb } from './supabase';

export type ActivityEvent =
  | 'login'
  | 'finances.view'
  | 'finances.update'
  | 'portfolio.view'
  | 'reports.view'
  | 'data.export';

export interface ActivityRow { userId: string; event: ActivityEvent; at: string }

const _mem: ActivityRow[] = [];
const MAX_MEM = 20_000;

/** No bloqueja mai la petició: si falla la BD, es perd l'esdeveniment. */
export function recordActivity(userId: string | undefined | null, event: ActivityEvent, now = new Date()): void {
  if (!userId) return;
  const row: ActivityRow = { userId, event, at: now.toISOString() };
  const db = getDb();
  if (!db) {
    _mem.push(row);
    if (_mem.length > MAX_MEM) _mem.shift();
    return;
  }
  db.from('client_activity').insert({ user_id: row.userId, event: row.event, at: row.at })
    .then(({ error }) => { if (error) console.error('[activity] no s\'ha pogut desar:', error.message); });
}

export async function getActivitySince(since: Date): Promise<ActivityRow[]> {
  const db = getDb();
  if (!db) return _mem.filter(r => r.at >= since.toISOString());
  const { data, error } = await db.from('client_activity').select('user_id,event,at')
    .gte('at', since.toISOString()).order('at', { ascending: true }).limit(50_000);
  if (error || !data) return [];
  return data.map(r => ({ userId: String(r.user_id), event: r.event as ActivityEvent, at: String(r.at) }));
}

export function __resetActivityForTests() { _mem.length = 0; }

// ── Càlcul (pur) ────────────────────────────────────────────────────────────

const DAY = 86_400_000;

/** Dilluns 00:00 UTC de la setmana ISO que conté `d`. */
export function weekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // dilluns = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY);
}

export interface ClientUsage {
  id:          string;
  name:        string;
  email:       string;
  /** Una entrada per setmana, de la més antiga a l'actual: dies diferents amb activitat. */
  activeDays:  number[];
  weeksActive: number;
  lastSeen:    string | null;
  logins:      number;
  updates:     number;
  consentAt:   string | null;
  /** L'afegeix la ruta d'admin a partir de la fitxa (lib/diagnosis.ts) */
  diagnosis?:  { status: 'vermell' | 'ambre' | 'verd' | 'incomplet'; headline: string };
}

export interface UsageSummary {
  weeks:   string[];   // data (AAAA-MM-DD) del dilluns de cada setmana
  /** Clients amb almenys un dia d'activitat cada setmana */
  weeklyActive: number[];
  clients: ClientUsage[];
}

export function summarizeUsage(
  rows: ActivityRow[],
  clients: { id: string; name: string; email: string }[],
  consents: Record<string, string | undefined>,
  now: Date,
  weeks = 8,
): UsageSummary {
  const current = weekStart(now).getTime();
  const starts = Array.from({ length: weeks }, (_, i) => current - (weeks - 1 - i) * 7 * DAY);
  const first = starts[0];

  const byUser = new Map<string, ActivityRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  const out: ClientUsage[] = clients.map(c => {
    const list = byUser.get(c.id) ?? [];
    const days = starts.map(() => new Set<string>());
    let lastSeen: string | null = null;
    let logins = 0, updates = 0;
    for (const r of list) {
      const t = Date.parse(r.at);
      if (Number.isNaN(t)) continue;
      if (!lastSeen || r.at > lastSeen) lastSeen = r.at;
      if (t < first || t > now.getTime()) continue;
      const idx = Math.floor((t - first) / (7 * DAY));
      days[idx].add(r.at.slice(0, 10));
      if (r.event === 'login') logins++;
      if (r.event === 'finances.update') updates++;
    }
    const activeDays = days.map(s => s.size);
    return {
      id: c.id, name: c.name, email: c.email, activeDays,
      weeksActive: activeDays.filter(n => n > 0).length,
      lastSeen, logins, updates, consentAt: consents[c.id] ?? null,
    };
  });

  out.sort((a, b) => b.weeksActive - a.weeksActive || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));

  return {
    weeks: starts.map(s => new Date(s).toISOString().slice(0, 10)),
    weeklyActive: starts.map((_, i) => out.filter(c => c.activeDays[i] > 0).length),
    clients: out,
  };
}
