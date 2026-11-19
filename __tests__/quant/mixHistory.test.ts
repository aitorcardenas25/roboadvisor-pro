import { describe, it, expect } from 'vitest';
import { simulateMix } from '@/lib/mixHistory';
import type { NavPoint } from '@/lib/navMath';

function series(isin: string, start: string, navs: number[]): NavPoint[] {
  const [y, m] = start.split('-').map(Number);
  return navs.map((nav, i) => {
    const t = y * 12 + (m - 1) + i;
    const yy = Math.floor(t / 12), mm = t % 12 + 1;
    const last = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    return { isin, date: last, nav, currency: 'EUR' };
  });
}

describe('simulateMix (composició d\'avui comprada fa N anys)', () => {
  const a = series('A', '2021-01', Array.from({ length: 25 }, (_, i) => 100 + i * 2));   // 100 → 148
  const b = series('B', '2021-01', Array.from({ length: 25 }, () => 50));               // pla

  it('compra i mantenir: valor = suma de participacions × VL', () => {
    const h = simulateMix([{ isin: 'A', name: 'A', weight: 60 }, { isin: 'B', name: 'B', weight: 40 }], [...a, ...b], 2, 10_000)!;
    expect(h.start).toBe('2021-01-31');
    expect(h.end).toBe('2023-01-31');
    expect(h.years).toBe(2);
    // 6.000 € a A creix un 48 %, 4.000 € a B queda igual
    expect(h.points.at(-1)!.value).toBeCloseTo(6000 * 1.48 + 4000, 2);
    expect(h.portfolio.totalReturn).toBeCloseTo(28.8, 2);
    expect(h.funds.find(f => f.isin === 'A')!.totalReturn).toBeCloseTo(48, 2);
    expect(h.points.at(-1)!.funds.A).toBeCloseTo(14_800, 2);   // el fons sol amb tot l'import
  });

  it('finestra més curta que la història: comença N anys abans de l\'últim mes comú', () => {
    const h = simulateMix([{ isin: 'A', name: 'A', weight: 100 }], a, 1)!;
    expect(h.start).toBe('2022-01-31');
    expect(h.limitedBy).toBeNull();
  });

  it('si un fons té menys història, s\'escurça i es diu quin', () => {
    const c = series('C', '2022-01', Array.from({ length: 13 }, () => 10));
    const h = simulateMix([{ isin: 'A', name: 'A', weight: 50 }, { isin: 'C', name: 'Fons C', weight: 50 }], [...a, ...c], 5)!;
    expect(h.start).toBe('2022-01-31');
    expect(h.years).toBe(1);
    expect(h.limitedBy).toBe('Fons C');
  });

  it('un mes sense preu d\'un fons no es dibuixa (no s\'interpola)', () => {
    const gap = b.filter(p => p.date !== '2021-06-30');
    const h = simulateMix([{ isin: 'A', name: 'A', weight: 50 }, { isin: 'B', name: 'B', weight: 50 }], [...a, ...gap], 2)!;
    expect(h.points.some(p => p.date === '2021-06-30')).toBe(false);
  });

  it('sense preus d\'algun fons → null', () => {
    expect(simulateMix([{ isin: 'A', name: 'A', weight: 50 }, { isin: 'Z', name: 'Z', weight: 50 }], a, 5)).toBeNull();
  });
});
