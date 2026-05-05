import { getDb } from './supabase';

export interface Subscriber {
  id:           string;
  email:        string;
  name:         string;
  subscribedAt: string;
  active:       boolean;
}

export type NewsletterStatus = 'draft' | 'pending' | 'validated' | 'sent';

export interface NewsletterSections {
  marketNews:        string;
  macroSummary:      string;
  buyOpportunities:  string;
  sellOpportunities: string;
  investmentIdeas:   string;
  fundamental:       string;
  technical:         string;
  mainRisks:         string;
  disclaimer:        string;
}

export interface Newsletter {
  id:        string;
  title:     string;
  subject:   string;
  status:    NewsletterStatus;
  sections:  NewsletterSections;
  createdAt: string;
  updatedAt: string;
  sentAt?:   string;
  sentTo?:   number;
}

const EMPTY_SECTIONS: NewsletterSections = {
  marketNews:        '',
  macroSummary:      '',
  buyOpportunities:  '',
  sellOpportunities: '',
  investmentIdeas:   '',
  fundamental:       '',
  technical:         '',
  mainRisks:         '',
  disclaimer:        'Les informacions contingudes en aquesta newsletter tenen caràcter exclusivament informatiu i educatiu. No constitueixen assessorament financer personalitzat ni recomanació d\'inversió. Factor OTC no és una entitat financera regulada. Els rendiments passats no garanteixen rendiments futurs. Invertir comporta riscos, incloent la possible pèrdua del capital invertit.',
};

// In-memory fallback (dev sense Supabase)
let _subscribers: Subscriber[] = [];
let _newsletters: Newsletter[] = [];

// ── Mappers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSubscriber(row: Record<string, any>): Subscriber {
  return { id: row.id, email: row.email, name: row.name, subscribedAt: row.subscribed_at, active: Boolean(row.active) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToNewsletter(row: Record<string, any>): Newsletter {
  return {
    id:        row.id,
    title:     row.title,
    subject:   row.subject,
    status:    row.status as NewsletterStatus,
    sections:  row.sections as NewsletterSections,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentAt:    row.sent_at ?? undefined,
    sentTo:    row.sent_to ?? undefined,
  };
}

// ── Subscribers ────────────────────────────────────────────────────────────

export async function subscribe(email: string, name: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Format d\'email invàlid.' };
  }

  const normalEmail = email.toLowerCase();
  const db = getDb();

  if (!db) {
    const exists = _subscribers.find(s => s.email === normalEmail);
    if (exists) {
      if (exists.active) return { ok: false, error: 'Aquest email ja està subscrit.' };
      exists.active = true;
      return { ok: true };
    }
    _subscribers.push({ id: `sub-${Date.now()}`, email: normalEmail, name: name.trim() || email.split('@')[0], subscribedAt: new Date().toISOString().split('T')[0], active: true });
    return { ok: true };
  }

  const { data: existing } = await db.from('newsletter_subscribers').select('id, active').eq('email', normalEmail).maybeSingle();

  if (existing) {
    if (existing.active) return { ok: false, error: 'Aquest email ja està subscrit.' };
    await db.from('newsletter_subscribers').update({ active: true }).eq('email', normalEmail);
    return { ok: true };
  }

  const { error } = await db.from('newsletter_subscribers').insert({
    id:            `sub-${Date.now()}`,
    email:         normalEmail,
    name:          name.trim() || email.split('@')[0],
    subscribed_at: new Date().toISOString().split('T')[0],
    active:        true,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function unsubscribe(email: string): Promise<boolean> {
  const normalEmail = email.toLowerCase();
  const db = getDb();

  if (!db) {
    const sub = _subscribers.find(s => s.email === normalEmail);
    if (!sub) return false;
    sub.active = false;
    return true;
  }

  const { error, count } = await db.from('newsletter_subscribers').update({ active: false }, { count: 'exact' }).eq('email', normalEmail);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  const db = getDb();
  if (!db) return _subscribers.filter(s => s.active);

  const { data, error } = await db.from('newsletter_subscribers').select('*').eq('active', true);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSubscriber);
}

export async function getAllSubscribers(): Promise<Subscriber[]> {
  const db = getDb();
  if (!db) return [..._subscribers];

  const { data, error } = await db.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSubscriber);
}

// ── Newsletters ────────────────────────────────────────────────────────────

export async function createNewsletter(title: string, subject: string, sections?: Partial<NewsletterSections>): Promise<Newsletter> {
  const now = new Date().toISOString().split('T')[0];
  const nl: Newsletter = {
    id:        `nl-${Date.now()}`,
    title,
    subject,
    status:    'draft',
    sections:  { ...EMPTY_SECTIONS, ...sections },
    createdAt: now,
    updatedAt: now,
  };

  const db = getDb();
  if (!db) { _newsletters.push(nl); return nl; }

  const { error } = await db.from('newsletters').insert({
    id:         nl.id,
    title:      nl.title,
    subject:    nl.subject,
    status:     nl.status,
    sections:   nl.sections,
    created_at: nl.createdAt,
    updated_at: nl.updatedAt,
  });
  if (error) throw new Error(error.message);
  return nl;
}

export async function getNewsletter(id: string): Promise<Newsletter | null> {
  const db = getDb();
  if (!db) return _newsletters.find(n => n.id === id) ?? null;

  const { data, error } = await db.from('newsletters').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToNewsletter(data) : null;
}

export async function getAllNewsletters(): Promise<Newsletter[]> {
  const db = getDb();
  if (!db) return [..._newsletters].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const { data, error } = await db.from('newsletters').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToNewsletter);
}

export async function updateNewsletter(
  id: string,
  updates: Partial<Omit<Newsletter, 'id' | 'createdAt'>>
): Promise<Newsletter | null> {
  const db  = getDb();
  const now = new Date().toISOString().split('T')[0];

  if (!db) {
    const nl = _newsletters.find(n => n.id === id);
    if (!nl || nl.status === 'sent') return null;
    Object.assign(nl, updates, { updatedAt: now });
    return nl;
  }

  const current = await getNewsletter(id);
  if (!current || current.status === 'sent') return null;

  const patch: Record<string, unknown> = { updated_at: now };
  if (updates.title    !== undefined) patch.title    = updates.title;
  if (updates.subject  !== undefined) patch.subject  = updates.subject;
  if (updates.sections !== undefined) patch.sections = updates.sections;
  if (updates.status   !== undefined) patch.status   = updates.status;

  const { data, error } = await db.from('newsletters').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToNewsletter(data) : null;
}

export async function changeStatus(id: string, newStatus: NewsletterStatus): Promise<Newsletter | null> {
  const transitions: Record<NewsletterStatus, NewsletterStatus[]> = {
    draft:     ['pending'],
    pending:   ['draft', 'validated'],
    validated: ['pending', 'sent'],
    sent:      [],
  };

  const db = getDb();

  if (!db) {
    const nl = _newsletters.find(n => n.id === id);
    if (!nl || !transitions[nl.status].includes(newStatus)) return null;
    nl.status    = newStatus;
    nl.updatedAt = new Date().toISOString().split('T')[0];
    if (newStatus === 'sent') {
      nl.sentAt = new Date().toISOString();
      nl.sentTo = _subscribers.filter(s => s.active).length;
    }
    return nl;
  }

  const current = await getNewsletter(id);
  if (!current || !transitions[current.status].includes(newStatus)) return null;

  const patch: Record<string, unknown> = {
    status:     newStatus,
    updated_at: new Date().toISOString().split('T')[0],
  };
  if (newStatus === 'sent') {
    patch.sent_at = new Date().toISOString();
    const active = await getActiveSubscribers();
    patch.sent_to = active.length;
  }

  const { data, error } = await db.from('newsletters').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToNewsletter(data) : null;
}

export async function deleteNewsletter(id: string): Promise<boolean> {
  const db = getDb();

  if (!db) {
    const idx = _newsletters.findIndex(n => n.id === id);
    if (idx === -1 || _newsletters[idx].status === 'sent') return false;
    _newsletters.splice(idx, 1);
    return true;
  }

  const current = await getNewsletter(id);
  if (!current || current.status === 'sent') return false;

  const { error, count } = await db.from('newsletters').delete({ count: 'exact' }).eq('id', id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
