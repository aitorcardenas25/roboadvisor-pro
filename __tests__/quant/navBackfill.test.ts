// Càrrega de l'històric complet: només s'afegeix el que falta, i res si la font no coincideix.
import { describe, it, expect } from 'vitest';
import { adjustForDistributions, planBackfill } from '@/lib/navBackfill';

const pt = (date: string, nav: number, currency = 'EUR') => ({ date, nav, currency });

describe('planBackfill', () => {
  const stored = [pt('2020-11-30', 100), pt('2020-12-31', 102)];

  it('afegeix només els dies que falten si els comuns coincideixen', () => {
    const src = [pt('2020-11-27', 99.5), pt('2020-11-30', 100), pt('2020-12-30', 101.9), pt('2020-12-31', 102.0001)];
    const r = planBackfill(stored, src);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.rows.map(p => p.date)).toEqual(['2020-11-27', '2020-12-30']); expect(r.checked).toBe(2); }
  });

  it('no desa res si la font és una altra classe (preus diferents)', () => {
    const r = planBackfill(stored, [pt('2020-11-27', 50), pt('2020-11-30', 55), pt('2020-12-31', 56)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/no coincideix/);
  });

  it('no desa res si no hi ha cap dia en comú', () => {
    const r = planBackfill(stored, [pt('2019-01-02', 80)]);
    expect(r.ok).toBe(false);
  });

  it('atura la càrrega si hi ha un salt impossible', () => {
    const r = planBackfill(stored, [pt('2020-11-26', 10), pt('2020-11-27', 99), pt('2020-11-30', 100), pt('2020-12-31', 102)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/salt/);
  });

  it('classe ajustada pels dividends: reescriu tota la sèrie si els últims dies coincideixen', () => {
    const src = [pt('2020-11-27', 95), pt('2020-11-30', 96), pt('2020-12-31', 102)];
    const r = planBackfill(stored.slice(1), src, { replaceAll: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(3);
  });
});

describe('adjustForDistributions', () => {
  it('multiplica els preus anteriors al dia ex-dividend per P_ex / (P_ex + D)', () => {
    const pts = [pt('2024-01-02', 100), pt('2024-01-03', 101), pt('2024-01-04', 99), pt('2024-01-05', 100)];
    const adj = adjustForDistributions(pts, [{ exDate: '2024-01-04', amount: 1, currency: 'EUR' }]);
    const f = 99 / 100;
    expect(adj[0].nav).toBeCloseTo(100 * f, 6);
    expect(adj[1].nav).toBeCloseTo(101 * f, 6);
    expect(adj[2].nav).toBe(99);
    expect(adj[3].nav).toBe(100);
  });
});
