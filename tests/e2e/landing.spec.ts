import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and shows main CTA', async ({ page }) => {
    await page.goto('/');

    // Page title
    await expect(page).toHaveTitle(/Factor OTC|RoboAdvisor/i);

    // Brand name visible
    await expect(page.getByText('FACTOR', { exact: false }).first()).toBeVisible();
  });

  test('security headers are present', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('unauthenticated access to /cartera redirects', async ({ page }) => {
    await page.goto('/cartera');
    // Should redirect to restricted access page or login
    await expect(page).not.toHaveURL('/cartera');
  });

  test('unauthenticated access to /admin shows the login, not the dashboard', async ({ page }) => {
    // /admin és públic a proxy.ts a propòsit: sense sessió renderitza el seu
    // propi formulari d'accés en lloc de redirigir.
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Accés restringit' })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('Gestió de Fons')).toHaveCount(0);
  });
});
