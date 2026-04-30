// lib/newsletter.ts

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

let subscribersDB: Subscriber[] = [];
let newslettersDB: Newsletter[] = [];

// ── Subscribers ──────────────────────────────────────────────────────────────

export function subscribe(email: string, name: string): { ok: boolean; error?: string } {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Format d\'email invàlid.' };
  }
  const exists = subscribersDB.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    if (exists.active) return { ok: false, error: 'Aquest email ja està subscrit.' };
    exists.active = true;
    return { ok: true };
  }
  subscribersDB.push({
    id:           `sub-${Date.now()}`,
    email:        email.toLowerCase(),
    name:         name.trim() || email.split('@')[0],
    subscribedAt: new Date().toISOString().split('T')[0],
    active:       true,
  });
  return { ok: true };
}

export function unsubscribe(email: string): boolean {
  const sub = subscribersDB.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (!sub) return false;
  sub.active = false;
  return true;
}

export function getActiveSubscribers(): Subscriber[] {
  return subscribersDB.filter(s => s.active);
}

export function getAllSubscribers(): Subscriber[] {
  return [...subscribersDB];
}

// ── Newsletters ───────────────────────────────────────────────────────────────

export function createNewsletter(title: string, subject: string, sections?: Partial<NewsletterSections>): Newsletter {
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
  newslettersDB.push(nl);
  return nl;
}

export function getNewsletter(id: string): Newsletter | null {
  return newslettersDB.find(n => n.id === id) ?? null;
}

export function getAllNewsletters(): Newsletter[] {
  return [...newslettersDB].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateNewsletter(id: string, updates: Partial<Omit<Newsletter, 'id' | 'createdAt'>>): Newsletter | null {
  const nl = newslettersDB.find(n => n.id === id);
  if (!nl) return null;
  if (nl.status === 'sent') return null; // no editable un cop enviada
  Object.assign(nl, updates, { updatedAt: new Date().toISOString().split('T')[0] });
  return nl;
}

export function changeStatus(id: string, newStatus: NewsletterStatus): Newsletter | null {
  const nl = newslettersDB.find(n => n.id === id);
  if (!nl) return null;
  const transitions: Record<NewsletterStatus, NewsletterStatus[]> = {
    draft:     ['pending'],
    pending:   ['draft', 'validated'],
    validated: ['pending', 'sent'],
    sent:      [],
  };
  if (!transitions[nl.status].includes(newStatus)) return null;
  nl.status    = newStatus;
  nl.updatedAt = new Date().toISOString().split('T')[0];
  if (newStatus === 'sent') {
    nl.sentAt = new Date().toISOString();
    nl.sentTo = getActiveSubscribers().length;
  }
  return nl;
}

export function deleteNewsletter(id: string): boolean {
  const idx = newslettersDB.findIndex(n => n.id === id);
  if (idx === -1 || newslettersDB[idx].status === 'sent') return false;
  newslettersDB.splice(idx, 1);
  return true;
}
