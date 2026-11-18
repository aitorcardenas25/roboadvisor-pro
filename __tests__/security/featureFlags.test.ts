import { describe, it, expect, vi, afterEach } from 'vitest';

// Decisió 2026-11-06: recomanacions activades per defecte; només
// NEXT_PUBLIC_ENABLE_RECOMMENDATIONS=false les apaga.
async function load(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv('NEXT_PUBLIC_ENABLE_RECOMMENDATIONS', undefined as unknown as string);
  else vi.stubEnv('NEXT_PUBLIC_ENABLE_RECOMMENDATIONS', value);
  return (await import('@/lib/featureFlags')).RECOMMENDATIONS_ENABLED;
}

describe('RECOMMENDATIONS_ENABLED', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('està activat si la variable no existeix', async () => {
    expect(await load(undefined)).toBe(true);
  });
  it('està activat amb "true"', async () => {
    expect(await load('true')).toBe(true);
  });
  it('es desactiva només amb "false"', async () => {
    expect(await load('false')).toBe(false);
  });
});

// Decisió 2026-11-18: beta tancada. Pàgines fora del flux amagades tret que
// s'activin; la fiscalitat del client es mostra tret que es desactivi.
describe('beta tancada', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  async function flags(env: Record<string, string> = {}) {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SHOW_NON_BETA_FEATURES', env.SHOW ?? (undefined as unknown as string));
    vi.stubEnv('NEXT_PUBLIC_ENABLE_CLIENT_TAX_REPORT', env.TAX ?? (undefined as unknown as string));
    return import('@/lib/featureFlags');
  }

  it('per defecte amaga les funcions fora de la beta i mostra la fiscalitat', async () => {
    const f = await flags();
    expect(f.SHOW_NON_BETA_FEATURES).toBe(false);
    expect(f.CLIENT_TAX_REPORT_ENABLED).toBe(true);
  });

  it('les funcions fora de la beta tornen només amb "true"', async () => {
    const f = await flags({ SHOW: 'true' });
    expect(f.SHOW_NON_BETA_FEATURES).toBe(true);
  });

  it('la fiscalitat del client només s\'amaga amb "false"', async () => {
    expect((await flags({ TAX: 'false' })).CLIENT_TAX_REPORT_ENABLED).toBe(false);
    expect((await flags({ TAX: 'true' })).CLIENT_TAX_REPORT_ENABLED).toBe(true);
  });

  it('isNonBetaPage reconeix les rutes amagades i les seves subrutes', async () => {
    const { isNonBetaPage } = await flags();
    expect(isNonBetaPage('/comparador')).toBe(true);
    expect(isNonBetaPage('/client/seguiment-accions/ASML')).toBe(true);
    expect(isNonBetaPage('/checkout/success')).toBe(true);
    expect(isNonBetaPage('/client/roboadvisor')).toBe(true);
  });

  it('isNonBetaPage deixa passar el flux de la beta', async () => {
    const { isNonBetaPage } = await flags();
    expect(isNonBetaPage('/')).toBe(false);
    expect(isNonBetaPage('/login')).toBe(false);
    expect(isNonBetaPage('/client/cartera')).toBe(false);
    expect(isNonBetaPage('/client/finances')).toBe(false);
    expect(isNonBetaPage('/client/informes/abc')).toBe(false);
    expect(isNonBetaPage('/accionsx')).toBe(false);
  });
});
