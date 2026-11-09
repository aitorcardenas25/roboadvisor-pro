import { describe, it, expect } from 'vitest';
import { FinanceUpdateSchema, applyFinanceUpdate, buildDataExport } from '@/lib/clientData';

describe('FinanceUpdateSchema', () => {
  it('accepta un pressupost complet amb objectius', () => {
    const r = FinanceUpdateSchema.safeParse({
      monthlyNetIncome: 1800, monthlyFixedExpenses: 700, monthlyVariableExpenses: 400,
      monthlyDebtPayments: 0, currentSavings: 3000, employmentType: 'temporal',
      goals: [{ horizon: 'mitja', description: 'Entrada pis', amount: 20000, targetYear: 2030 }],
    });
    expect(r.success).toBe(true);
  });

  it('rebutja imports negatius, camps desconeguts i situacions laborals inventades', () => {
    expect(FinanceUpdateSchema.safeParse({ monthlyNetIncome: -1 }).success).toBe(false);
    expect(FinanceUpdateSchema.safeParse({ riskProfile: 'agressiu' }).success).toBe(false);
    expect(FinanceUpdateSchema.safeParse({ employmentType: 'funcionari' }).success).toBe(false);
  });

  it('rebutja objectius sense descripció, amb any absurd o més de 10', () => {
    expect(FinanceUpdateSchema.safeParse({ goals: [{ horizon: 'curt', description: '  ' }] }).success).toBe(false);
    expect(FinanceUpdateSchema.safeParse({ goals: [{ horizon: 'curt', description: 'x', targetYear: 1990 }] }).success).toBe(false);
    const many = Array.from({ length: 11 }, () => ({ horizon: 'curt', description: 'x' }));
    expect(FinanceUpdateSchema.safeParse({ goals: many }).success).toBe(false);
  });

  it('accepta null per esborrar un camp', () => {
    expect(FinanceUpdateSchema.safeParse({ currentSavings: null, employmentType: null }).success).toBe(true);
  });
});

describe('applyFinanceUpdate', () => {
  const existing = { riskTolerance: 4, monthlyNetIncome: 1500, currentSavings: 2000, goals: [{ horizon: 'llarg', description: 'Jubilació' }] };

  it('manté els camps del qüestionari que el client no toca', () => {
    const out = applyFinanceUpdate(existing, { monthlyNetIncome: 1700 });
    expect(out).toMatchObject({ riskTolerance: 4, monthlyNetIncome: 1700, currentSavings: 2000 });
    expect(out.goals).toEqual(existing.goals);
  });

  it('null esborra el camp ("no ho sé") en lloc de posar 0', () => {
    const out = applyFinanceUpdate(existing, { currentSavings: null });
    expect('currentSavings' in out).toBe(false);
  });

  it('substitueix la llista d\'objectius sencera', () => {
    const out = applyFinanceUpdate(existing, { goals: [] });
    expect(out.goals).toEqual([]);
  });

  it('elimina el total antic quan hi ha desglossament fixes + variables', () => {
    const out = applyFinanceUpdate({ monthlyExpenses: 1200 }, { monthlyFixedExpenses: 800, monthlyVariableExpenses: 300 });
    expect('monthlyExpenses' in out).toBe(false);
  });

  it('conserva el total antic si el desglossament és incomplet', () => {
    const out = applyFinanceUpdate({ monthlyExpenses: 1200 }, { monthlyFixedExpenses: 800 });
    expect(out.monthlyExpenses).toBe(1200);
  });

  it('no modifica l\'objecte original', () => {
    const copy = structuredClone(existing);
    applyFinanceUpdate(existing, { monthlyNetIncome: 9 });
    expect(existing).toEqual(copy);
  });

  it('funciona sense qüestionari previ', () => {
    expect(applyFinanceUpdate(undefined, { monthlyNetIncome: 1000 })).toEqual({ monthlyNetIncome: 1000 });
  });
});

describe('buildDataExport', () => {
  it('inclou data, compte, fitxa, cartera i propostes', () => {
    const now = new Date('2026-11-09T10:00:00Z');
    const out = buildDataExport({ account: { id: 'u1' }, profile: { id: 'l1' }, portfolio: undefined, proposals: [], now });
    expect(out.exportedAt).toBe('2026-11-09T10:00:00.000Z');
    expect(out.account).toEqual({ id: 'u1' });
    expect(out.profile).toEqual({ id: 'l1' });
    expect(out.portfolio).toBeNull();
    expect(out.proposals).toEqual([]);
  });
});
