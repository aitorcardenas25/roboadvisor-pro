import { getDb } from './supabase';

export interface Lead {
  id:        string;
  name:      string;
  email:     string;
  phone?:    string;
  interest:  string;
  message?:  string;
  source:    string;
  status:    'new' | 'contacted' | 'converted' | 'discarded';
  createdAt: string;
}

let _db: Lead[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLead(r: Record<string, any>): Lead {
  return {
    id:        r.id,
    name:      r.name,
    email:     r.email,
    phone:     r.phone ?? undefined,
    interest:  r.interest,
    message:   r.message ?? undefined,
    source:    r.source,
    status:    r.status,
    createdAt: r.created_at ?? r.createdAt,
  };
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = getDb();
  if (!db) return [..._db].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data, error } = await db.from('leads').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToLead);
}

export async function createLead(
  data: Pick<Lead, 'name' | 'email' | 'interest' | 'source'> & Partial<Pick<Lead, 'phone' | 'message'>>
): Promise<Lead> {
  const now  = new Date().toISOString();
  const lead: Lead = { ...data, id: `lead-${Date.now()}`, status: 'new', createdAt: now };
  const db = getDb();
  if (!db) { _db.push(lead); return lead; }
  const { error } = await db.from('leads').insert({
    id: lead.id, name: lead.name, email: lead.email, phone: lead.phone ?? null,
    interest: lead.interest, message: lead.message ?? null,
    source: lead.source, status: lead.status, created_at: lead.createdAt,
  });
  if (error) throw new Error(error.message);
  return lead;
}

export async function updateLeadStatus(id: string, status: Lead['status']): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const l = _db.find(x => x.id === id);
    if (!l) return false;
    l.status = status;
    return true;
  }
  const { error } = await db.from('leads').update({ status }).eq('id', id);
  return !error;
}
