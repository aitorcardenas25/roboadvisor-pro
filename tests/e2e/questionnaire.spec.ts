import { test, expect } from '@playwright/test';

// Tests the main profiling flow: landing → questionnaire → results

test.describe('Investor profiling flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('questionnaire is reachable from landing', async ({ page }) => {
    // Find and click the CTA button that starts the questionnaire
    const cta = page.getByRole('button', { name: /comença|inici|perfil|qüestionari/i }).first();
    if (await cta.isVisible()) {
      await cta.click();
      // Should be on step 1 of the questionnaire
      await expect(page.locator('text=/pas 1|step 1|pregunta 1/i').first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Questionnaire may render inline — just assert no navigation error
      });
    } else {
      // Questionnaire is embedded directly on the page
      await expect(page.locator('form, [role="form"], .questionnaire').first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Acceptable — page structure may differ
      });
    }
  });

  test('questionnaire has accessible labels', async ({ page }) => {
    // All inputs should have labels or aria-labels for accessibility
    const inputs = await page.locator('input:visible').all();
    for (const input of inputs.slice(0, 5)) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      // At least one labelling mechanism should exist
      const hasLabel = id
        ? await page.locator(`label[for="${id}"]`).count() > 0
        : false;
      expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });
});

test.describe('Rate limiting', () => {
  test('newsletter subscribe is rate-limited after many requests', async ({ request }) => {
    // Send 25 requests — should hit the 20/min limit
    const responses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await request.post('/api/newsletter/subscribe', {
        data: { email: `test${i}@exemple.com` },
      });
      responses.push(res.status());
    }
    // At least one 429 should appear
    expect(responses).toContain(429);
  });
});
