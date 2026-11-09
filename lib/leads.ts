import { getDb } from './supabase';

export interface Lead {
  id:                 string;
  name:               string;
  lastName?:          string;
  email:              string;
  phone?:             string;
  interest:           string;
  profile?:           string;
  message?:           string;
  source:             string;
  type?:              string;
  notes?:             string;
  status:             'new' | 'contacted' | 'preparing-report' | 'report-sent' | 'converted' | 'discarded';
  gdprConsent:        boolean;
  createdAt:          string;
  // Flux connectat: camps afegits per vincular lead → usuari → cartera
  questionnaireData?: Record<string, unknown>;
  linkedUserId?:      string;
  linkedPortfolioId?: string;
}

let _db: Lead[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLead(r: Record<string, unknown>): Lead {
  return {
    id:                 r.id as string,
    name:               r.name as string,
    lastName:           (r.last_name ?? r.lastName) as string | undefined,
    email:              r.email as string,
    phone:              (r.phone ?? undefined) as string | undefined,
    interest:           r.interest as string,
    profile:            (r.profile ?? undefined) as string | undefined,
    message:            (r.message ?? undefined) as string | undefined,
    source:             r.source as string,
    type:               (r.type ?? undefined) as string | undefined,
    notes:              (r.notes ?? undefined) as string | undefined,
    status:             r.status as Lead['status'],
    gdprConsent:        Boolean(r.gdpr_consent ?? r.gdprConsent),
    createdAt:          (r.created_at ?? r.createdAt) as string,
    questionnaireData:  (r.questionnaire_data ?? r.questionnaireData) as Record<string, unknown> | undefined,
    linkedUserId:       (r.linked_user_id ?? r.linkedUserId) as string | undefined,
    linkedPortfolioId:  (r.linked_portfolio_id ?? r.linkedPortfolioId) as string | undefined,
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
        Partial<Pick<Lead, 'lastName' | 'phone' | 'profile' | 'message' | 'gdprConsent' | 'type'>>
): Promise<Lead> {
  const now  = new Date().toISOString();
  const lead: Lead = { gdprConsent: false, ...data, id: `lead-${Date.now()}`, status: 'new', createdAt: now };
  const db = getDb();
  if (!db) { _db.push(lead); return lead; }
  const { error } = await db.from('leads').insert({
    id: lead.id, name: lead.name, last_name: lead.lastName ?? null,
    email: lead.email, phone: lead.phone ?? null,
    interest: lead.interest, profile: lead.profile ?? null,
    message: lead.message ?? null, source: lead.source,
    type: lead.type ?? null, notes: null, status: lead.status,
    gdpr_consent: lead.gdprConsent, created_at: lead.createdAt, updated_at: lead.createdAt,
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

export async function updateLeadNotes(id: string, notes: string): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const l = _db.find(x => x.id === id);
    if (!l) return false;
    l.notes = notes;
    return true;
  }
  const { error } = await db.from('leads').update({ notes }).eq('id', id);
  return !error;
}

export async function saveLeadQuestionnaire(
  id: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const l = _db.find(x => x.id === id);
    if (!l) return false;
    l.questionnaireData = data;
    return true;
  }
  const { error } = await db.from('leads').update({ questionnaire_data: data, updated_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

export async function updateLeadLinks(
  id: string,
  linkedUserId: string,
  linkedPortfolioId: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) {
    const l = _db.find(x => x.id === id);
    if (!l) return false;
    l.linkedUserId      = linkedUserId;
    l.linkedPortfolioId = linkedPortfolioId;
    l.status            = 'converted';
    return true;
  }
  const { error } = await db.from('leads').update({
    linked_user_id:      linkedUserId,
    linked_portfolio_id: linkedPortfolioId,
    status:              'converted',
  }).eq('id', id);
  return !error;
}

export async function getLeadByEmail(email: string): Promise<Lead | null> {
  const db = getDb();
  if (!db) return _db.find(l => l.email === email) ?? null;
  const { data } = await db.from('leads').select('*').eq('email', email).maybeSingle();
  return data ? rowToLead(data) : null;
}

export async function getLeadByLinkedUser(userId: string): Promise<Lead | null> {
  const db = getDb();
  if (!db) return _db.find(l => l.linkedUserId === userId) ?? null;
  const { data } = await db.from('leads').select('*').eq('linked_user_id', userId).maybeSingle();
  return data ? rowToLead(data) : null;
}

/** Fitxa del client de la sessió: primer per usuari vinculat, després per email. */
export async function findLeadForUser(userId: string, email?: string | null): Promise<Lead | null> {
  return (await getLeadByLinkedUser(userId)) ?? (email ? await getLeadByEmail(email) : null);
}
