import { getDb } from './supabase';

export interface ReportRecord {
  id:            string;
  clientName:    string;
  clientEmail:   string;
  profile:       string;
  score:         number;
  monthlyAmount: number;
  investable:    number;
  horizon:       number;
  portfolio:     string[];
  pdfGenerated:  boolean;
  emailSent:     boolean;
  date:          string;
  createdAt:     string;
}

// In-memory fallback (dev sense Supabase)
const _mem: ReportRecord[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: Record<string, any>): ReportRecord {
  return {
    id:            row.id,
    clientName:    row.client_name,
    clientEmail:   row.client_email,
    profile:       row.profile,
    score:         Number(row.score),
    monthlyAmount: Number(row.monthly_amount),
    investable:    Number(row.investable),
    horizon:       Number(row.horizon),
    portfolio:     row.portfolio as string[],
    pdfGenerated:  Boolean(row.pdf_generated),
    emailSent:     Boolean(row.email_sent),
    date:          row.date,
    createdAt:     row.created_at,
  };
}

export async function saveReport(
  report: Omit<ReportRecord, 'id' | 'createdAt'>
): Promise<ReportRecord> {
  const rec: ReportRecord = {
    ...report,
    id:        `RA-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  if (!db) {
    _mem.unshift(rec);
    if (_mem.length > 500) _mem.pop();
    return rec;
  }

  const { error } = await db.from('reports').insert({
    id:             rec.id,
    client_name:    rec.clientName,
    client_email:   rec.clientEmail,
    profile:        rec.profile,
    score:          rec.score,
    monthly_amount: rec.monthlyAmount,
    investable:     rec.investable,
    horizon:        rec.horizon,
    portfolio:      rec.portfolio,
    pdf_generated:  rec.pdfGenerated,
    email_sent:     rec.emailSent,
    date:           rec.date,
    created_at:     rec.createdAt,
  });
  if (error) throw new Error(error.message);
  return rec;
}

export async function getReports(): Promise<ReportRecord[]> {
  const db = getDb();
  if (!db) return [..._mem];

  const { data, error } = await db.from('reports').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRecord);
}

export async function getReportById(id: string): Promise<ReportRecord | undefined> {
  const db = getDb();
  if (!db) return _mem.find(r => r.id === id);

  const { data, error } = await db.from('reports').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRecord(data) : undefined;
}
