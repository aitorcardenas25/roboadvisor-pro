import { describe, it, expect } from 'vitest';
import { ADVISOR_CLASSIFICATION, ADVISOR_ISINS, allocationBreakdown, assetTypeLabel, classifyFund } from '@/lib/fundClassification';

describe('Classificació dels fons (gestió activa/passiva, renda fixa/variable)', () => {
  it('cada fons de la llista de l\'assessor té classificació explícita', () => {
    for (const isin of ADVISOR_ISINS) expect(ADVISOR_CLASSIFICATION[isin], isin).toBeDefined();
  });

  it('fons indexats i ETF són de gestió passiva; els value espanyols, d\'activa', () => {
    expect(classifyFund('IE00B03HD191').management).toBe('passiva');   // Vanguard Global Stock Index
    expect(classifyFund('IE00B4L5Y983').management).toBe('passiva');   // iShares Core MSCI World ETF
    expect(classifyFund('ES0119199000').management).toBe('activa');    // Cobas Internacional
    expect(classifyFund('IE0007472115').assetType).toBe('renda_fixa'); // Vanguard Euro Govt Bond
    expect(classifyFund('LU0290358497').assetType).toBe('monetari');
  });

  it('dedueix fons fora de la llista pel nom i la categoria, i no s\'inventa l\'estil', () => {
    const etf = classifyFund('XX0000000000', 'RV Global', 'Some MSCI World UCITS ETF');
    expect(etf).toMatchObject({ management: 'passiva', assetType: 'renda_variable', source: 'deduït' });
    const unknown = classifyFund('XX0000000001', '', 'Fons Desconegut FI');
    expect(unknown.management).toBeUndefined();
    expect(unknown.assetType).toBeUndefined();
    expect(assetTypeLabel(unknown)).toBe('Sense classificar');
  });

  it('reparteix la cartera i compta el monetari dins la renda fixa', () => {
    const b = allocationBreakdown([
      { isin: 'IE00B03HD191', weight: 60 },  // RV passiva
      { isin: 'ES0119199000', weight: 20 },  // RV activa
      { isin: 'IE0007472115', weight: 10 },  // RF passiva
      { isin: 'LU0290358497', weight: 10 },  // monetari passiu
    ]);
    expect(b.passive).toBeCloseTo(80);
    expect(b.active).toBeCloseTo(20);
    expect(b.equity).toBeCloseTo(80);
    expect(b.fixedIncome).toBeCloseTo(20);
    expect(b.moneyMarket).toBeCloseTo(10);
    expect(b.unknownAsset + b.unknownStyle).toBe(0);
  });

  it('reparteix un mixt segons el seu % en accions', () => {
    const b = allocationBreakdown([{ isin: 'ES0112601002', weight: 50 }, { isin: 'IE00B03HD191', weight: 50 }]);
    expect(b.equity).toBeCloseTo(55);      // 50 + 50 × 10 %
    expect(b.fixedIncome).toBeCloseTo(45);
    expect(b.hasMixed && b.hasApprox).toBe(true);
  });

  it('normalitza si els pesos no sumen 100', () => {
    const b = allocationBreakdown([{ isin: 'IE00B03HD191', weight: 30 }, { isin: 'IE0007472115', weight: 10 }]);
    expect(b.equity).toBeCloseTo(75);
    expect(b.fixedIncome).toBeCloseTo(25);
  });
});
