import { describe, it, expect } from 'vitest';
import { goalsProgress, availableForGoals } from '@/lib/goalProgress';

const now = new Date('2026-11-20T10:00:00Z');
// Ingressos 2.000, despeses 1.500 → marge 500/mes; coixí 6 mesos = 9.000 €
const budget = { monthlyNetIncome: 2000, monthlyFixedExpenses: 1000, monthlyVariableExpenses: 500, employmentType: 'indefinit' };

describe('goalsProgress', () => {
  it('reserva primer el coixí i després assigna els diners al pis', () => {
    const r = goalsProgress({ goals: [{ description: 'Pis', amount: 30000, targetYear: 2031 }], budget, available: 21000, now });
    expect(r.cushionTarget).toBe(9000);
    expect(r.cushionReserved).toBe(9000);
    const g = r.goals[0];
    expect(g.saved).toBe(12000);
    expect(g.progressPct).toBe(40);
    expect(g.missing).toBe(18000);
    expect(g.monthsLeft).toBe(60);
    expect(g.monthlyNeeded).toBeCloseTo(300, 6);   // 18.000 / 60
    expect(g.status).toBe('va-be');
  });

  it('marca cal-ajustar quan el que cal al mes supera el marge', () => {
    const r = goalsProgress({ goals: [{ description: 'Pis', amount: 30000, targetYear: 2028 }], budget, available: 9000, now });
    const g = r.goals[0];
    expect(g.saved).toBe(0);
    expect(g.monthlyNeeded).toBeCloseTo(30000 / 24, 6);
    expect(g.status).toBe('cal-ajustar');
  });

  it('reparteix per data: el marge que es menja el primer no serveix per al segon', () => {
    const r = goalsProgress({
      goals: [
        { description: 'Cotxe', amount: 12000, targetYear: 2030 },   // 48 mesos → 250/mes
        { description: 'Viatge', amount: 4800, targetYear: 2028 },   // 24 mesos → 200/mes
      ],
      budget, available: 9000, now,
    });
    expect(r.goals.map(g => g.description)).toEqual(['Viatge', 'Cotxe']);
    expect(r.goals[0].status).toBe('va-be');                         // 200 ≤ 500
    expect(r.goals[1].status).toBe('va-be');                         // 250 ≤ 300
    const tight = goalsProgress({
      goals: [{ description: 'Viatge', amount: 9600, targetYear: 2028 }, { description: 'Cotxe', amount: 12000, targetYear: 2030 }],
      budget, available: 9000, now,
    });
    expect(tight.goals[0].status).toBe('va-be');                     // 400 ≤ 500
    expect(tight.goals[1].status).toBe('cal-ajustar');               // 250 > 100
  });

  it('mentre el coixí no és complet, el marge hi va primer', () => {
    // Coixí 9.000, en té 3.000 → falten 6.000 = 12 mesos de marge
    const r = goalsProgress({ goals: [{ description: 'Pis', amount: 6000, targetYear: 2028 }], budget, available: 3000, now });
    const g = r.goals[0];
    expect(r.cushionReserved).toBe(3000);
    expect(g.monthlyNeeded).toBeCloseTo(6000 / 12, 6);              // 24 − 12 mesos útils
    expect(g.status).toBe('va-be');
    expect(g.message).toContain('coixí');
  });

  it('objectiu ja cobert', () => {
    const r = goalsProgress({ goals: [{ description: 'Viatge', amount: 2000, targetYear: 2027 }], budget, available: 15000, now });
    expect(r.goals[0]).toMatchObject({ status: 'assolit', progressPct: 100, missing: 0 });
  });

  it('sense import, sense any, data passada o sense pressupost', () => {
    const r = goalsProgress({
      goals: [
        { description: 'Jubilació' },
        { description: 'Moto', amount: 3000 },
        { description: 'Vell', amount: 1000, targetYear: 2025 },
      ],
      budget, available: 9000, now,
    });
    const by = Object.fromEntries(r.goals.map(g => [g.description, g.status]));
    expect(by).toEqual({ 'Jubilació': 'sense-dades', Moto: 'sense-dades', Vell: 'vencut' });

    const noBudget = goalsProgress({ goals: [{ description: 'Pis', amount: 30000, targetYear: 2031 }], budget: {}, available: 12000, now });
    expect(noBudget.cushionTarget).toBeNull();
    expect(noBudget.goals[0]).toMatchObject({ saved: 12000, status: 'sense-dades' });
    expect(noBudget.goals[0].monthlyNeeded).toBeCloseTo(300, 6);
  });

  it('marge negatiu: cap objectiu pendent va bé', () => {
    const r = goalsProgress({ goals: [{ description: 'Pis', amount: 10000, targetYear: 2030 }],
      budget: { monthlyNetIncome: 1500, monthlyFixedExpenses: 1200, monthlyVariableExpenses: 500 }, available: 50000, now });
    expect(r.goals[0].status).toBe('assolit');   // els diners ja hi són (coixí 10.200 reservat)
    const r2 = goalsProgress({ goals: [{ description: 'Pis', amount: 10000, targetYear: 2030 }],
      budget: { monthlyNetIncome: 1500, monthlyFixedExpenses: 1200, monthlyVariableExpenses: 500 }, available: 0, now });
    expect(r2.goals[0].status).toBe('cal-ajustar');
  });

  it('ignora objectius buits i no compta immobles', () => {
    expect(goalsProgress({ goals: [{ description: '  ' }], budget, available: 0, now }).goals).toHaveLength(0);
    expect(availableForGoals([
      { group: 'liquiditat', value: 5000 }, { group: 'inversions', value: 7000 }, { group: 'immobles', value: 200000 }, { group: 'altres', value: 300 },
    ])).toBe(12000);
  });
});
