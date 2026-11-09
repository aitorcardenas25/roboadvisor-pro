import { describe, it, expect } from 'vitest';
import { analyzeBudget, emergencyMonths } from '@/lib/budget';

describe('analyzeBudget (regla 50/30/20, Warren i Tyagi 2005)', () => {
  it('sense ingressos nets no inventa res', () => {
    expect(analyzeBudget({})).toBeNull();
    expect(analyzeBudget({ monthlyNetIncome: 0, monthlyExpenses: 500 })).toBeNull();
    expect(analyzeBudget({ monthlyNetIncome: 1500 })).toBeNull();
  });

  it('calcula marge, percentatges i semàfors', () => {
    const a = analyzeBudget({ monthlyNetIncome: 2000, monthlyFixedExpenses: 800, monthlyVariableExpenses: 500, monthlyDebtPayments: 100, currentSavings: 1500, employmentType: 'indefinit' })!;
    expect(a.totalSpending).toBe(1400);
    expect(a.freeMargin).toBe(600);
    expect(a.savingsRate).toBe(30);
    expect(a.checks.find(c => c.key === 'needs')).toMatchObject({ value: '45%', status: 'verd' });
    expect(a.checks.find(c => c.key === 'wants')).toMatchObject({ value: '25%', status: 'verd' });
    // 6 mesos × 1.400 € = 8.400 €; falten 6.900 € → 12 mesos amb 600 €/mes
    expect(a.emergency).toMatchObject({ monthsTarget: 6, targetAmount: 8400, gap: 6900, monthsToTarget: 12, progressPct: 18 });
    expect(a.nextStep).toBe('fons-emergencia');
  });

  it('dèficit → primer pas és equilibrar el pressupost', () => {
    const a = analyzeBudget({ monthlyNetIncome: 1000, monthlyFixedExpenses: 700, monthlyVariableExpenses: 400, currentSavings: 50000 })!;
    expect(a.freeMargin).toBe(-100);
    expect(a.nextStep).toBe('reduir-despeses');
    expect(a.checks.find(c => c.key === 'savings')?.status).toBe('vermell');
  });

  it('fons complet → llest per invertir', () => {
    const a = analyzeBudget({ monthlyNetIncome: 2500, monthlyExpenses: 1000, currentSavings: 20000, employmentType: 'autonom' })!;
    expect(a.hasBreakdown).toBe(false);
    expect(a.emergency).toMatchObject({ monthsTarget: 12, targetAmount: 12000, gap: 0, monthsToTarget: 0, progressPct: 100 });
    expect(a.nextStep).toBe('llest-per-invertir');
  });

  it('sense estalvis informats no calcula progrés', () => {
    const a = analyzeBudget({ monthlyNetIncome: 1500, monthlyFixedExpenses: 900 })!;
    expect(a.emergency.current).toBeNull();
    expect(a.emergency.progressPct).toBeNull();
    expect(a.nextStep).toBe('fons-emergencia');
  });

  it('mesos de fons d\'emergència segons estabilitat d\'ingressos', () => {
    expect(emergencyMonths('indefinit').months).toBe(6);
    expect(emergencyMonths('autonom').months).toBe(12);
    expect(emergencyMonths('temporal').months).toBe(12);
    expect(emergencyMonths(undefined).months).toBe(6);
  });
});
