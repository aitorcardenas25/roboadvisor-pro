import { describe, it, expect } from 'vitest';
import { computeDashboardStats } from '@/lib/dashboardStats';

describe('computeDashboardStats', () => {
  it('compta altes i propostes aprovades per mes, i el perfil vigent de cada client', () => {
    const s = computeDashboardStats(
      [{ createdAt: '2026-11-02' }, { createdAt: '2026-10-15T10:00:00Z' }, { createdAt: '2024-01-01' }],
      [
        { clientId: 'a', status: 'approved', approvedAt: '2026-10-20T09:00:00Z', version: 1, profile: 'moderat' },
        { clientId: 'a', status: 'approved', approvedAt: '2026-11-10T09:00:00Z', version: 2, profile: 'dinamic' },
        { clientId: 'b', status: 'approved', approvedAt: '2026-11-11T09:00:00Z', version: 1, profile: 'moderat' },
        { clientId: 'c', status: 'draft', version: 1, profile: 'agressiu' },
      ],
      '2026-11-17',
    );
    expect(s.activity.map(a => a.mes)).toEqual(['Jun 26', 'Jul 26', 'Ago 26', 'Set 26', 'Oct 26', 'Nov 26']);
    expect(s.activity.slice(-2).map(a => [a.clients, a.propostes])).toEqual([[1, 1], [1, 2]]);
    expect(s.profiles).toEqual([
      { profile: 'moderat', name: 'Moderat', value: 1 },
      { profile: 'dinamic', name: 'Dinàmic', value: 1 },
    ]);
    expect(s.clientsWithProposal).toBe(2);
  });

  it('creua el canvi d\'any', () => {
    expect(computeDashboardStats([], [], '2027-02-03').activity.map(a => a.key))
      .toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
  });
});
