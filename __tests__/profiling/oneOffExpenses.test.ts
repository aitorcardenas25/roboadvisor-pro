import { describe, it, expect } from 'vitest';
import { addOneOff, removeOneOff, monthTotal, parseSpokenExpense, OneOffInputSchema } from '@/lib/oneOffExpenses';
import { diagnose } from '@/lib/diagnosis';

const now = new Date('2026-11-09T12:00:00Z');
const base = { monthlyNetIncome: 2000, monthlyFixedExpenses: 900, monthlyVariableExpenses: 500, currentSavings: 9000, employmentType: 'indefinit', riskTolerance: 3 };
const input = (o: Record<string, unknown>) => OneOffInputSchema.parse(o);

describe('addOneOff', () => {
  it('resta de l\'estalvi i ho recalcula tot', () => {
    const { next, entry, impact } = addOneOff(base, input({ description: 'Mòbil', amount: 1000, category: 'tecnologia' }), 'admin', now);
    expect(next.currentSavings).toBe(8000);
    expect(next.riskTolerance).toBe(3);
    expect(entry).toMatchObject({ date: '2026-11-09', deducted: 1000, addedBy: 'admin' });
    // despesa mensual 1.400 → abans 6,4 mesos, després 5,7; marge 600 → 2 mesos per recuperar
    expect(impact.cushionAfter!).toBeCloseTo(8000 / 1400);
    expect(impact.monthsToRecover).toBe(2);
    expect(impact.summary).toContain('de 9.000 € a 8.000 €');
    // el diagnòstic canvia sol: el coixí ja no és complet
    expect(diagnose(base as never, now).status).toBe('verd');
    expect(diagnose(next as never, now).status).toBe('ambre');
  });

  it('no deixa l\'estalvi en negatiu', () => {
    const { next, entry } = addOneOff({ ...base, currentSavings: 300 }, input({ description: 'Cotxe', amount: 5000 }), 'client', now);
    expect(next.currentSavings).toBe(0);
    expect(entry.deducted).toBe(300);
  });

  it('es pot registrar sense tocar l\'estalvi', () => {
    const { next, entry } = addOneOff(base, input({ description: 'Sopar', amount: 80, affectsSavings: false }), 'client', now);
    expect(next.currentSavings).toBe(9000);
    expect(entry.deducted).toBe(0);
  });

  it('sense estalvi conegut, només registra', () => {
    const { next } = addOneOff({ monthlyNetIncome: 2000 }, input({ description: 'Viatge', amount: 300 }), 'client', now);
    expect('currentSavings' in next).toBe(false);
    expect((next.oneOffExpenses as unknown[]).length).toBe(1);
  });

  it('valida l\'entrada', () => {
    expect(OneOffInputSchema.safeParse({ description: '', amount: 10 }).success).toBe(false);
    expect(OneOffInputSchema.safeParse({ description: 'x', amount: 0 }).success).toBe(false);
    expect(OneOffInputSchema.safeParse({ description: 'x', amount: 10, category: 'luxe' }).success).toBe(false);
  });
});

describe('removeOneOff', () => {
  it('torna a sumar el que s\'havia restat', () => {
    const { next, entry } = addOneOff(base, input({ description: 'Mòbil', amount: 1000 }), 'admin', now);
    const back = removeOneOff(next, entry.id)!;
    expect(back.currentSavings).toBe(9000);
    expect(back.oneOffExpenses).toEqual([]);
  });
  it('id desconegut → null', () => {
    expect(removeOneOff(base, 'x')).toBeNull();
  });
});

describe('monthTotal', () => {
  it('suma només el mes actual', () => {
    let q: Record<string, unknown> = base;
    q = addOneOff(q, input({ description: 'A', amount: 100, date: '2026-11-02' }), 'client', now).next;
    q = addOneOff(q, input({ description: 'B', amount: 50, date: '2026-10-30' }), 'client', now).next;
    expect(monthTotal(q, now)).toBe(100);
  });
});

describe('parseSpokenExpense', () => {
  it.each([
    ["s'ha gastat 1.000 euros en un mòbil", 1000, 'Mòbil', 'tecnologia'],
    ['300 € del viatge a Roma', 300, 'Del viatge a Roma', 'viatge'],
    ['cotxe 5 mil euros', 5000, 'Cotxe', 'cotxe'],
    ['ha pagat cinc mil de cotxe', 5000, 'Cotxe', 'cotxe'],
    ['dentista 120,50', 120.5, 'Dentista', 'salut'],
  ])('"%s"', (text, amount, description, category) => {
    expect(parseSpokenExpense(text)).toEqual({ amount, description, category });
  });
  it('sense import → null', () => {
    expect(parseSpokenExpense('un viatge a Roma')).toBeNull();
  });
});
