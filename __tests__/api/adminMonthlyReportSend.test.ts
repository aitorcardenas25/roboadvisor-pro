import { describe, it, expect, vi, beforeEach } from 'vitest';

// "Enviar al client" d'un informe mensual: el fa visible i envia el correu d'avís.
// Si el correu falla, es pot tornar a provar sense canviar la data d'enviament.
vi.mock('next-auth', () => ({ getServerSession: async () => ({ user: { id: 'adm', role: 'admin' } }) }));
vi.mock('@/lib/authOptions', () => ({ authOptions: {} }));
vi.mock('@/lib/auditLog', () => ({ logAuditEvent: () => {} }));
vi.mock('@/lib/clientPortfolios', () => ({ getPortfolioById: async () => ({ id: 'p1', clientId: 'u1' }) }));
vi.mock('@/lib/users', () => ({ findUserById: async () => ({ id: 'u1', email: 'pau@example.test', name: 'Pau Prova' }) }));
const m = vi.hoisted(() => ({
  rep: null as Record<string, unknown> | null,
  markSent: vi.fn(async () => true), markEmailed: vi.fn(async () => {}), send: vi.fn(),
}));
vi.mock('@/lib/monthlyReports', () => ({
  getMonthlyReportsByPortfolio: async () => [], getAllMonthlyReports: async () => [],
  getMonthlyReportById: async () => m.rep,
  markMonthlyReportSent: m.markSent, markMonthlyReportEmailed: m.markEmailed,
  periodLabel: () => 'octubre del 2026',
}));
vi.mock('@/lib/emails', () => ({ sendMonthlyReportAvailable: m.send }));

import { PATCH } from '@/app/api/admin/monthly-reports/route';
const req = () => new Request('http://x', { method: 'PATCH', body: JSON.stringify({ id: 'oct' }) }) as never;

describe('PATCH /api/admin/monthly-reports', () => {
  beforeEach(() => { m.markSent.mockClear(); m.markEmailed.mockClear(); m.send.mockReset(); });

  it('primer enviament: el marca com a enviat i avisa per correu', async () => {
    m.rep = { id: 'oct', portfolioId: 'p1', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
    m.send.mockResolvedValue({ success: true });
    const d = await (await PATCH(req())).json();
    expect(d.email).toEqual({ sent: true, error: undefined });
    expect(m.markSent).toHaveBeenCalledOnce();
    expect(m.markEmailed).toHaveBeenCalledOnce();
    expect(m.send).toHaveBeenCalledWith('pau@example.test', 'Pau Prova', 'octubre del 2026');
  });

  it('si el correu falla, l\'informe queda visible però sense emailedAt', async () => {
    m.rep = { id: 'oct', portfolioId: 'p1', periodStart: '2026-10-01', periodEnd: '2026-10-31' };
    m.send.mockResolvedValue({ success: false, error: 'Correu no configurat' });
    const r = await PATCH(req());
    expect(r.status).toBe(200);
    expect((await r.json()).email.sent).toBe(false);
    expect(m.markSent).toHaveBeenCalledOnce();
    expect(m.markEmailed).not.toHaveBeenCalled();
  });

  it('tornar a provar el correu no canvia la data d\'enviament', async () => {
    m.rep = { id: 'oct', portfolioId: 'p1', periodStart: '2026-10-01', periodEnd: '2026-10-31', sentAt: '2026-11-02' };
    m.send.mockResolvedValue({ success: true });
    await PATCH(req());
    expect(m.markSent).not.toHaveBeenCalled();
    expect(m.markEmailed).toHaveBeenCalledOnce();
  });
});
