import { test, expect } from '@playwright/test';

test.describe('Health endpoint', () => {
  test('GET /api/health returns ok or degraded', async ({ request }) => {
    const res = await request.get('/api/health');

    expect([200, 503]).toContain(res.status());

    const body = await res.json() as { status: string; timestamp: string; checks: Record<string, unknown> };
    expect(['ok', 'degraded', 'error']).toContain(body.status);
    expect(body.timestamp).toBeTruthy();
    expect(body.checks).toBeDefined();
  });
});
