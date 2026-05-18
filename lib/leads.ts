import { getDb } from './supabase';

export interface Lead {
  id:           string;
  name:         string;
  lastName?:    string;
  email:        string;
  phone?:       string;
  interest:     string;
  profile?:     string;
  message?:     string;
  source:       string;
  status:       'new' | 'contacted' | 'converted' | 'discarded';
  gdprConsent:  boolean;
  createdAt:    string;
}

let _db: Lead[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLead(r: Record<string, unknown>): Lead {
  return {
    id:          r.id as string,
    name:        r.name as string,
    lastName:    (r.last_name ?? r.lastName) as string | undefined,
    email:       r.email as string,
    phone:       (r.phone ?? undefined) as string | undefined,
    interest:    r.interest as string,
    profile:     (r.profile ?? undefined) as string | undefined,
    message:     (r.message ?? undefined) as string | undefined,
    source:      r.source as string,
    status:      r.status as Lead['status'],
    gdprConsent: Boolean(r.gdpr_consent ?? r.gdprConsent),
    createdAt:   (r.created_at ?? r.createdAt) as string,
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
  data: Pick<Lead, 'name' | 'email' | 'interest' | 'source'> &
        Partial<Pick<Lead, 'lastName' | 'phone' | 'profile' | 'message' | 'gdprConsent'>>
): Promise<Lead> {
  const now  = new Date().toISOString();
  const lead: Lead = { gdprConsent: false, ...data, id: `lead-${Date.now()}`, status: 'new', createdAt: now };
  const db = getDb();
  if (!db) { _db.push(lead); return lead; }
  const { error } = await db.from('leads').insert({
    id: lead.id, name: lead.name, last_name: lead.lastName ?? null,
    email: lead.email, phone: lead.phone ?? null,
    interest: lead.interest, profile: lead.profile ?? null,
    message: lead.message ?? null, source: lead.source, status: lead.status,
    gdpr_consent: lead.gdprConsent, created_at: lead.createdAt,
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
