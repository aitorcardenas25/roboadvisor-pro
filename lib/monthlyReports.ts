import { getDb } from './supabase';
import type { MonthlyReportData } from './portfolioReport';

export interface MonthlyReportRecord {
  id:          string;
  portfolioId: string;
  clientId?:   string;
  clientName:  string;
  periodStart: string;
  periodEnd:   string;
  data:        MonthlyReportData;
  sentAt?:     string;
  emailedAt?:  string;
  createdAt:   string;
}

const _mem: MonthlyReportRecord[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: Record<string, any>): MonthlyReportRecord {
  return {
    id:          row.id,
    portfolioId: row.portfolio_id,
    clientId:    row.client_id ?? undefined,
    clientName:  row.client_name,
    periodStart: row.period_start,
    periodEnd:   row.period_end,
    data:        typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    sentAt:      row.sent_at ?? undefined,
    emailedAt:   row.emailed_at ?? undefined,
    createdAt:   row.created_at,
  };
}

export async function saveMonthlyReport(
  report: Omit<MonthlyReportRecord, 'id' | 'createdAt'>
): Promise<MonthlyReportRecord> {
  const rec: MonthlyReportRecord = {
    ...report,
    id:        `mr-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  if (!db) {
    _mem.unshift(rec);
    if (_mem.length > 500) _mem.pop();
    return rec;
  }

  const { error } = await db.from('monthly_reports').insert({
    id:           rec.id,
    portfolio_id: rec.portfolioId,
    client_id:    rec.clientId ?? null,
    client_name:  rec.clientName,
    period_start: rec.periodStart,
    period_end:   rec.periodEnd,
    data:         rec.data,
    created_at:   rec.createdAt,
  });
  if (error) throw new Error(error.message);
  return rec;
}

export async function getMonthlyReportsByPortfolio(portfolioId: string): Promise<MonthlyReportRecord[]> {
  const db = getDb();
  if (!db) return _mem.filter(r => r.portfolioId === portfolioId);

  const { data, error } = await db
    .from('monthly_reports')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecord);
}

export async function getAllMonthlyReports(): Promise<MonthlyReportRecord[]> {
  const db = getDb();
  if (!db) return [..._mem];

  const { data, error } = await db
    .from('monthly_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecord);
}

export async function markMonthlyReportSent(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const db  = getDb();
  if (!db) {
    const r = _mem.find(x => x.id === id);
    if (!r) return false;
    r.sentAt = now;
    return true;
  }
  const { error } = await db.from('monthly_reports').update({ sent_at: now }).eq('id', id);
  return !error;
}
