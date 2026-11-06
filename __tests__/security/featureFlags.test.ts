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
