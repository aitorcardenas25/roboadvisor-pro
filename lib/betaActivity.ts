// lib/betaActivity.ts
// Ús de la beta: registra quan un client entra i què consulta, i calcula
// l'ús setmanal per client. Decisió 2026-11-04: al mes 3 es mira l'ús setmanal.
// Només es guarda usuari, tipus d'esdeveniment, pàgina i hora: cap dada financera.
// Temps connectat: mentre la pàgina és visible, el navegador envia un "ping"
// cada minut; els minuts connectats són els minuts diferents amb ping.
import { getDb } from './supabase';

export type ActivityEvent =
  | 'login'
  | 'finances.view'
  | 'finances.update'
  | 'portfolio.view'
  | 'reports.view'
  | 'data.export'
  | 'ping';

export type ActivityPage = 'finances' | 'cartera' | 'altres';
export const PING_INTERVAL_MS = 60_000;

export interface ActivityRow { userId: string; event: ActivityEvent; at: string; page?: ActivityPage | null }

const _mem: ActivityRow[] = [];
const MAX_MEM = 20_000;

/** No bloqueja mai la petició: si falla la BD, es perd l'esdeveniment. */
export function recordActivity(userId: string | undefined | null, event: ActivityEvent, now = new Date(), page?: ActivityPage): void {
  if (!userId) return;
  const row: ActivityRow = { userId, event, at: now.toISOString(), page: page ?? null };
  const db = getDb();
  if (!db) {
    _mem.push(row);
    if (_mem.length > MAX_MEM) _mem.shift();
    return;
  }
  db.from('client_activity').insert({ user_id: row.userId, event: row.event, at: row.at, page: row.page })
    .then(({ error }) => { if (error) console.error('[activity] no s\'ha pogut desar:', error.message); });
}

export async function getActivitySince(since: Date): Promise<ActivityRow[]> {
  const db = getDb();
  if (!db) return _mem.filter(r => r.at >= since.toISOString());
  const { data, error } = await db.from('client_activity').select('user_id,event,at,page')
    .gte('at', since.toISOString()).order('at', { ascending: true }).limit(50_000);
  if (error || !data) return [];
  return data.map(r => ({ userId: String(r.user_id), event: r.event as ActivityEvent, at: String(r.at), page: (r.page ?? null) as ActivityPage | null }));
}

export function __resetActivityForTests() { _mem.length = 0; }

// ── Càlcul (pur) ────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const MADRID = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Data AAAA-MM-DD a l'hora de Madrid (el "dia" del client). */
export const madridDay = (d: Date) => MADRID.format(d);

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
  /** Minuts connectats (minuts diferents amb ping) */
  minutes:     { today: number; week: number; month: number };
  /** Dies diferents amb activitat els darrers 30 dies */
  daysActive30: number;
  /** Entrades (logins) els darrers 30 dies */
  logins30:    number;
  /** Minuts per secció els darrers 30 dies */
  byPage30:    Record<ActivityPage, number>;
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
  const nowMs = now.getTime();

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
    let logins = 0, updates = 0, logins30 = 0;
    const today = madridDay(now);
    const weekAgo = nowMs - 7 * DAY, monthAgo = nowMs - 30 * DAY;
    const minToday = new Set<number>(), minWeek = new Set<number>(), minMonth = new Set<number>();
    const days30 = new Set<string>();
    const pageMin: Record<ActivityPage, Set<number>> = { finances: new Set(), cartera: new Set(), altres: new Set() };
    for (const r of list) {
      const t = Date.parse(r.at);
      if (Number.isNaN(t) || t > nowMs) continue;
      if (!lastSeen || r.at > lastSeen) lastSeen = r.at;
      if (t >= monthAgo) {
        days30.add(madridDay(new Date(t)));
        if (r.event === 'login') logins30++;
        if (r.event === 'ping') {
          const m = Math.floor(t / 60_000);
          minMonth.add(m);
          pageMin[r.page ?? 'altres'].add(m);
          if (t >= weekAgo) minWeek.add(m);
          if (madridDay(new Date(t)) === today) minToday.add(m);
        }
      }
      if (t < first) continue;
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
      minutes: { today: minToday.size, week: minWeek.size, month: minMonth.size },
      daysActive30: days30.size, logins30,
      byPage30: { finances: pageMin.finances.size, cartera: pageMin.cartera.size, altres: pageMin.altres.size },
    };
  });

  out.sort((a, b) => b.minutes.month - a.minutes.month || b.weeksActive - a.weeksActive || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));

  return {
    weeks: starts.map(s => new Date(s).toISOString().slice(0, 10)),
    weeklyActive: starts.map((_, i) => out.filter(c => c.activeDays[i] > 0).length),
    clients: out,
  };
}
