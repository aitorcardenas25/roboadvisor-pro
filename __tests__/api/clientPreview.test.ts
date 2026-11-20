import { describe, it, expect, vi, beforeEach } from 'vitest';

// Vista del client per a l'admin: les rutes /api/client/* llegeixen les dades del
// client de la galeta només si la sessió és d'administrador, i no s'hi pot escriure.
vi.mock('@/lib/supabase', () => ({ getDb: () => null }));
const session = vi.hoisted(() => ({ current: null as unknown }));
const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => (jar.value ? { value: jar.value } : undefined) }) }));
vi.mock('@/lib/users', () => ({
  findUserById: async (id: string) => (
    id === 'gemma' ? { id: 'gemma', role: 'client', name: 'Gemma', email: 'g@x' }
      : id === 'boss' ? { id: 'boss', role: 'admin', name: 'Admin', email: 'a@x' } : null),
}));
const leads = vi.hoisted(() => ({ byUser: {} as Record<string, unknown> }));
vi.mock('@/lib/leads', () => ({
  findLeadForUser: async (id: string) => leads.byUser[id] ?? null,
  createLead: async () => { throw new Error('no s\'hauria de crear'); },
  saveLeadQuestionnaire: async () => { throw new Error('no s\'hauria de desar'); },
}));

import { getClientTarget } from '@/lib/clientTarget';
import { GET as financesGET, PUT as financesPUT } from '@/app/api/client/finances/route';
import { POST as consentPOST } from '@/app/api/client/consent/route';

const req = (body: unknown) => new Request('http://x', { method: 'PUT', body: JSON.stringify(body) }) as never;

describe('vista del client (admin)', () => {
  beforeEach(() => {
    session.current = null; jar.value = undefined;
    leads.byUser = { gemma: { id: 'l1', questionnaireData: { monthlyNetIncome: 2500 } } };
  });

  it('un client amb la galeta d\'un altre continua veient només les seves dades', async () => {
    session.current = { user: { id: 'u9', role: 'client' } };
    jar.value = 'gemma';
    expect(await getClientTarget()).toMatchObject({ id: 'u9', preview: false });
    const d = await (await financesGET()).json();
    expect(d.data.monthlyNetIncome).toBeUndefined();
  });

  it('l\'admin amb la galeta llegeix les dades del client', async () => {
    session.current = { user: { id: 'adm', role: 'admin' } };
    jar.value = 'gemma';
    expect(await getClientTarget()).toMatchObject({ id: 'gemma', role: 'admin', preview: true, name: 'Gemma' });
    const d = await (await financesGET()).json();
    expect(d.data.monthlyNetIncome).toBe(2500);
  });

  it('la galeta d\'un id que no és client no té efecte', async () => {
    session.current = { user: { id: 'adm', role: 'admin' } };
    jar.value = 'boss';
    expect(await getClientTarget()).toMatchObject({ id: 'adm', preview: false });
  });

  it('en la vista del client no es pot escriure', async () => {
    session.current = { user: { id: 'adm', role: 'admin' } };
    jar.value = 'gemma';
    const r = await financesPUT(req({ monthlyNetIncome: 1 }));
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe('preview_read_only');
    expect((await consentPOST(req({ version: 'v1', accepted: true }))).status).toBe(403);
  });
});
