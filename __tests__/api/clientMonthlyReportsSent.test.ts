import { describe, it, expect, vi, beforeEach } from 'vitest';

// El client només veu els informes mensuals que l'assessor li ha enviat.
vi.mock('@/lib/supabase', () => ({ getDb: () => null }));
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('next-auth', () => ({ getServerSession: async () => session.current }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('@/lib/betaActivity', () => ({ recordActivity: () => {} }));
vi.mock('@/lib/clientPortfolios', () => ({ getPortfolioByClientId: async () => ({ id: 'p1' }) }));
vi.mock('@/lib/monthlyReports', () => ({
  getMonthlyReportsByPortfolio: async () => [
    { id: 'oct', portfolioId: 'p1', periodStart: '2026-10-01', periodEnd: '2026-10-31', createdAt: 'x', sentAt: '2026-11-02', data: { a: 1 } },
    { id: 'nov', portfolioId: 'p1', periodStart: '2026-11-01', periodEnd: '2026-11-30', createdAt: 'x', data: { a: 2 } },
  ],
}));

import { GET as list } from '@/app/api/client/reports/route';
import { GET as one } from '@/app/api/client/reports/[id]/route';

const req = () => ({ nextUrl: new URL('http://x/api/client/reports') }) as never;
const p = (id: string) => ({ params: Promise.resolve({ id }) });

describe('informes mensuals del client', () => {
  beforeEach(() => { session.current = { user: { id: 'u1', role: 'client' } }; });

  it('la llista només té els enviats', async () => {
    const d = await (await list(req())).json();
    expect(d.reports.map((r: { id: string }) => r.id)).toEqual(['oct']);
  });

  it('un informe no enviat no es pot obrir', async () => {
    expect((await one(new Request('http://x'), p('nov'))).status).toBe(404);
    expect((await one(new Request('http://x'), p('oct'))).status).toBe(200);
  });

  it('l\'admin (fora de la vista del client) els veu tots', async () => {
    session.current = { user: { id: 'adm', role: 'admin' } };
    const d = await (await list(req())).json();
    expect(d.reports).toHaveLength(2);
  });
});
