import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase', () => ({ getDb: () => null }));
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/leads', () => ({ findLeadForUser: async () => ({ name: 'Marta', questionnaireData: { goals: [{ description: 'Pis', amount: 25000 }] } }) }));

import { GET } from '@/app/api/client/initial-report/route';
import { saveDraft, approveProposal, __resetProposalsForTests, type ProposalItem } from '@/lib/proposals';

const item = (isin: string, weight: number): ProposalItem => ({
  isin, name: isin, category: 'RV Global', weight, risk: 6, ter: 0.2, platform: '', justification: '',
  historicalReturn5Y: 6, historicalVolatility: 12, performanceSource: 'Fitxa test',
});
const params = { profile: 'moderat' as const, objective: 'Pis', horizon: 10, initialAmount: 5000, monthlyAmount: 100, adminNote: 'Nota' };

describe('GET /api/client/initial-report', () => {
  beforeEach(() => { __resetProposalsForTests(); session.current = null; });

  it('sense sessió → 401', async () => {
    expect((await GET()).status).toBe(401);
  });

  it('esborrany sense aprovar → el client no veu cap proposta', async () => {
    await saveDraft('u1', { ...params, items: [item('A', 100)] });
    session.current = { user: { id: 'u1', role: 'client', email: 'm@x' } };
    const d = await (await GET()).json();
    expect(d.proposal).toBeNull();
    expect(d.personal.goals).toHaveLength(1);
  });

  it('només la seva última proposta aprovada, sense els camps interns de l\'assessor', async () => {
    const p = await saveDraft('u1', { ...params, items: [item('A', 100)] });
    await approveProposal('u1', p.id, 'admin@x', { suitability: { status: 'adequate', issues: [] } });
    await saveDraft('u2', { ...params, items: [item('B', 100)] });
    session.current = { user: { id: 'u1', role: 'client', email: 'm@x' } };
    const d = await (await GET()).json();
    expect(d.proposal.version).toBe(1);
    expect(d.proposal.items[0].isin).toBe('A');
    expect(d.proposal.stats).toBeDefined();
    expect(d.proposal.approvedBy).toBeUndefined();
    expect(d.proposal.suitability).toBeUndefined();
  });
});
