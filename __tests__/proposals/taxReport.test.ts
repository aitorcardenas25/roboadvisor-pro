import { describe, it, expect } from 'vitest';
import { buildTaxReport, savingsTax, type TaxTx } from '@/lib/taxReport';

const tx = (p: Partial<TaxTx> & Pick<TaxTx, 'isin' | 'type' | 'date' | 'quantity' | 'amount'>): TaxTx =>
  ({ name: p.isin, commission: 0, transfer: false, ...p });

describe('informe fiscal (IRPF)', () => {
  it('FIFO: es venen primer les participacions comprades primer (art. 37.2 LIRPF), amb comissions', () => {
    const r = buildTaxReport([
      tx({ isin: 'A', type: 'buy', date: '2024-01-10', quantity: 10, amount: 100 }),
      tx({ isin: 'A', type: 'buy', date: '2024-06-10', quantity: 10, amount: 200, commission: 2 }),
      tx({ isin: 'A', type: 'sell', date: '2025-03-01', quantity: 15, amount: 450, commission: 5 }),
    ]);
    expect(r.years).toHaveLength(1);
    expect(r.years[0].sales[0]).toMatchObject({ quantity: 15, transmissionValue: 445, acquisitionValue: 201, gain: 244, acquiredFrom: '2024-01-10', acquiredTo: '2024-06-10' });
    expect(r.years[0]).toMatchObject({ year: 2025, gains: 244, losses: 0, net: 244, estimatedTax: 46.36 });
    expect(r.open).toEqual([{ isin: 'A', name: 'A', quantity: 5, cost: 101, date: '2024-06-10' }]);
  });

  it('traspàs: no tributa i el fons nou hereta cost i data (art. 94 LIRPF)', () => {
    const r = buildTaxReport([
      tx({ isin: 'A', type: 'buy', date: '2024-01-01', quantity: 10, amount: 100 }),
      tx({ isin: 'A', type: 'sell', date: '2025-05-05', quantity: 10, amount: 150, transfer: true }),
      tx({ isin: 'B', type: 'buy', date: '2025-05-05', quantity: 5, amount: 150, transfer: true }),
      tx({ isin: 'B', type: 'sell', date: '2026-02-02', quantity: 5, amount: 200 }),
    ]);
    const y25 = r.years.find(y => y.year === 2025)!, y26 = r.years.find(y => y.year === 2026)!;
    expect(y25.sales).toEqual([]);
    expect(y25.transfers[0]).toMatchObject({ deferredGain: 50, from: [{ isin: 'A', value: 150, cost: 100 }], to: [{ isin: 'B', value: 150, inheritedCost: 100 }] });
    expect(y26.sales[0]).toMatchObject({ isin: 'B', acquisitionValue: 100, gain: 100, acquiredFrom: '2024-01-01' });
  });

  it('traspàs amb diners nous: una part hereta i la resta és compra nova', () => {
    const r = buildTaxReport([
      tx({ isin: 'A', type: 'buy', date: '2024-01-01', quantity: 10, amount: 100 }),
      tx({ isin: 'A', type: 'sell', date: '2025-05-05', quantity: 10, amount: 150, transfer: true }),
      tx({ isin: 'B', type: 'buy', date: '2025-05-05', quantity: 25, amount: 250, transfer: true }),
    ]);
    expect(r.years[0].sales).toEqual([]);
    expect(r.open).toEqual([
      { isin: 'B', name: 'B', quantity: 15, cost: 100, date: '2024-01-01' },
      { isin: 'B', name: 'B', quantity: 10, cost: 100, date: '2025-05-05' },
    ]);
  });

  it('traspàs amb retirada de diners: la part no reinvertida tributa', () => {
    const r = buildTaxReport([
      tx({ isin: 'A', type: 'buy', date: '2024-01-01', quantity: 30, amount: 300 }),
      tx({ isin: 'A', type: 'sell', date: '2025-05-05', quantity: 30, amount: 450, transfer: true }),
      tx({ isin: 'B', type: 'buy', date: '2025-05-05', quantity: 30, amount: 300, transfer: true }),
    ]);
    expect(r.years[0].sales).toEqual([expect.objectContaining({ isin: 'A', quantity: 10, transmissionValue: 150, acquisitionValue: 100, gain: 50, partialTransfer: true })]);
    expect(r.years[0].transfers[0].deferredGain).toBe(100);
    expect(r.open[0]).toMatchObject({ isin: 'B', quantity: 30, cost: 200, date: '2024-01-01' });
  });

  it('un ETF no es pot traspassar: tributa i avisa', () => {
    const r = buildTaxReport([
      tx({ isin: 'E', name: 'iShares Core MSCI World UCITS ETF', type: 'buy', date: '2024-01-01', quantity: 1, amount: 100 }),
      tx({ isin: 'E', name: 'iShares Core MSCI World UCITS ETF', type: 'sell', date: '2025-01-01', quantity: 1, amount: 130, transfer: true }),
      tx({ isin: 'B', type: 'buy', date: '2025-01-01', quantity: 13, amount: 130, transfer: true }),
    ]);
    expect(r.years[0].sales[0]).toMatchObject({ isin: 'E', gain: 30 });
    expect(r.warnings).toEqual([expect.stringMatching(/ETF/)]);
  });

  it('avisa d\'una pèrdua amb recompra del mateix fons en menys d\'un any (art. 33.5 LIRPF)', () => {
    const r = buildTaxReport([
      tx({ isin: 'A', type: 'buy', date: '2024-01-01', quantity: 10, amount: 1000 }),
      tx({ isin: 'A', type: 'sell', date: '2025-03-01', quantity: 10, amount: 800 }),
      tx({ isin: 'A', type: 'buy', date: '2025-05-01', quantity: 10, amount: 790 }),
    ]);
    expect(r.years[0].sales[0]).toMatchObject({ gain: -200, washSale: true });
    expect(r.years[0]).toMatchObject({ net: -200, estimatedTax: 0 });
  });

  it('escala de l\'estalvi 2025+', () => {
    expect(savingsTax(10_000)).toBe(1_980);                         // 6.000×19 % + 4.000×21 %
    expect(savingsTax(350_000)).toBe(1_140 + 9_240 + 34_500 + 27_000 + 15_000);
  });
});
