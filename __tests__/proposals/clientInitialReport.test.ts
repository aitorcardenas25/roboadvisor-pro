import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/leads', () => ({ findLeadForUser: async () => ({ name: 'Marta', questionnaireData: { goals: [{ description: 'Pis', amount: 25000 }] } }) }));

import { GET } from '@/app/api/client/initial-report/route';
import { saveDraft, approveProposal, shareProposal, __resetProposalsForTests, type ProposalItem } from '@/lib/proposals';

const item = (isin: string, weight: number): ProposalItem => ({
  isin, name: isin, category: 'RV Global', weight, risk: 6, ter: 0.2, platform: '', justification: '',
  historicalReturn5Y: 6, historicalVolatility: 12, performanceSource: 'Fitxa test',
});
const req = (q = '') => new Request(`http://x/api/client/initial-report${q}`);
const params = { profile: 'moderat' as const, objective: 'Pis', horizon: 10, initialAmount: 5000, monthlyAmount: 100, adminNote: 'Nota' };

describe('GET /api/client/initial-report', () => {
  beforeEach(() => { __resetProposalsForTests(); session.current = null; });

  it('sense sessió → 401', async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it('esborrany sense aprovar → el client no veu cap proposta', async () => {
    await saveDraft('u1', { ...params, items: [item('A', 100)] });
    session.current = { user: { id: 'u1', role: 'client', email: 'm@x' } };
    const d = await (await GET(req())).json();
    expect(d.proposal).toBeNull();
    expect(d.personal.goals).toHaveLength(1);
  });

  it('només la seva última proposta aprovada, sense els camps interns de l\'assessor', async () => {
    const p = await saveDraft('u1', { ...params, items: [item('A', 100)] });
    await approveProposal('u1', p.id, 'admin@x', { suitability: { status: 'adequate', issues: [] } });
    await saveDraft('u2', { ...params, items: [item('B', 100)] });
    session.current = { user: { id: 'u1', role: 'client', email: 'm@x' } };
    // Aprovada però no enviada: el client encara no la veu
    expect((await (await GET(req())).json()).proposal).toBeNull();
    await shareProposal('u1', p.id, 'admin@x');
    const d = await (await GET(req())).json();
    expect(d.proposal.version).toBe(1);
    expect(d.proposal.items[0].isin).toBe('A');
    expect(d.proposal.stats).toBeDefined();
    expect(d.proposal.approvedBy).toBeUndefined();
    expect(d.proposal.suitability).toBeUndefined();
    expect(d.proposal.sharedBy).toBeUndefined();
  });

  it('la vigent és l\'última enviada; les anteriors queden a l\'historial; una aprovada sense enviar no surt', async () => {
    const p1 = await saveDraft('u1', { ...params, items: [item('A', 100)] });
    await approveProposal('u1', p1.id, 'admin@x', { suitability: { status: 'adequate', issues: [] } });
    await shareProposal('u1', p1.id, 'admin@x');
    const p2 = await saveDraft('u1', { ...params, items: [item('A', 95), item('B', 5)] });
    await approveProposal('u1', p2.id, 'admin@x', { suitability: { status: 'adequate', issues: [] } });
    session.current = { user: { id: 'u1', role: 'client', email: 'm@x' } };
    // v2 aprovada però no enviada → el client continua veient la v1 (és el cas de la captura)
    let d = await (await GET(req())).json();
    expect(d.proposal.version).toBe(1);
    expect(d.history.map((h: { version: number }) => h.version)).toEqual([1]);
    await shareProposal('u1', p2.id, 'admin@x');
    d = await (await GET(req())).json();
    expect(d.proposal.version).toBe(2);
    expect(d.history.map((h: { version: number }) => h.version)).toEqual([2, 1]);
    expect(d.history[1].approvedBy).toBeUndefined();
    const s = await (await GET(req('?summary=1'))).json();
    expect(s.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(s.proposal).toBeUndefined();
  });
});
