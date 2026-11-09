import { describe, it, expect } from 'vitest';
import { diagnose } from '@/lib/diagnosis';

const now = new Date('2026-11-09T12:00:00Z');

describe('diagnose', () => {
  it('sense ingressos o despeses: incomplet i diu què falta', () => {
    const d = diagnose({ currentSavings: 1000 }, now);
    expect(d.status).toBe('incomplet');
    expect(d.findings).toEqual([]);
    expect(d.actions[0].detail).toContain('ingressos nets mensuals');
    expect(d.missing).toContain('despeses mensuals');
  });

  it('gasta més del que ingressa: vermell i primer retallar', () => {
    const d = diagnose({ monthlyNetIncome: 1500, monthlyFixedExpenses: 1100, monthlyVariableExpenses: 500, currentSavings: 0, employmentType: 'indefinit' }, now);
    expect(d.status).toBe('vermell');
    expect(d.headline).toContain('100 €');
    expect(d.actions[0].title).toBe('Retallar 100 € al mes');
    // per estalviar el 10 %: 100 de dèficit + 150 = 250
    expect(d.actions[0].detail).toContain('250 €');
  });

  it('marge positiu i coixí incomplet: ambre, apartar el marge i data aproximada', () => {
    const d = diagnose({
      monthlyNetIncome: 2000, monthlyFixedExpenses: 900, monthlyVariableExpenses: 500, monthlyDebtPayments: 0,
      currentSavings: 2800, employmentType: 'indefinit',
    }, now);
    // despesa 1.400 → objectiu 6 mesos = 8.400; falta 5.600; marge 600 → 10 mesos
    expect(d.status).toBe('ambre');
    expect(d.findings[0]).toMatchObject({ value: '600 €', tone: 'bo' }); // 30 % d'estalvi
    expect(d.findings[1].value).toBe('2 mesos');
    const act = d.actions.find(a => a.title.startsWith('Apartar'))!;
    expect(act.title).toBe('Apartar 600 € al mes per al coixí');
    expect(act.detail).toContain('setembre de 2027');
    expect(act.detail).toContain('10 mesos');
  });

  it('variables per sobre del 30 %: proposa la retallada concreta', () => {
    const d = diagnose({ monthlyNetIncome: 2000, monthlyFixedExpenses: 800, monthlyVariableExpenses: 800, currentSavings: 20000, employmentType: 'indefinit' }, now);
    const cut = d.actions.find(a => a.title.startsWith('Baixar'))!;
    expect(cut.title).toBe('Baixar les despeses variables 200 € al mes');
    expect(cut.detail).toContain('600 €'); // 400 + 200
    expect(d.findings[2].label).toBe('Despeses variables');
  });

  it('coixí complet i bon estalvi: verd i pas següent', () => {
    const d = diagnose({ monthlyNetIncome: 2500, monthlyFixedExpenses: 900, monthlyVariableExpenses: 500, currentSavings: 15000, employmentType: 'indefinit' }, now);
    expect(d.status).toBe('verd');
    expect(d.actions.some(a => a.title.includes('pas següent'))).toBe(true);
  });

  it('objectiu calculat només amb estalvi, sense rendiment', () => {
    const d = diagnose({
      monthlyNetIncome: 2500, monthlyFixedExpenses: 900, monthlyVariableExpenses: 500, currentSavings: 15000, employmentType: 'indefinit',
      goals: [{ description: 'Entrada pis', amount: 24000, targetYear: 2030 }, { description: 'Viatge', amount: 3000, targetYear: 2025 }],
    }, now);
    const g = d.actions.find(a => a.title.startsWith('Entrada pis'))!;
    expect(g.title).toBe('Entrada pis: 500 € al mes'); // 24.000 / 48 mesos
    expect(g.detail).toContain('hi arribes');
    expect(d.actions.some(a => a.title.startsWith('Viatge'))).toBe(false); // ja passat
  });

  it('si falta menys que el marge d\'un mes, demana només el que falta', () => {
    const d = diagnose({ monthlyNetIncome: 2000, monthlyFixedExpenses: 900, monthlyVariableExpenses: 500, currentSavings: 8000, employmentType: 'indefinit' }, now);
    expect(d.actions[0].title).toBe('Apartar 400 € i el coixí queda complet');
  });

  it('autònom: objectiu de 12 mesos', () => {
    const d = diagnose({ monthlyNetIncome: 2000, monthlyExpenses: 1000, currentSavings: 6000, employmentType: 'autonom' }, now);
    expect(d.findings[1].detail).toContain('12 mesos');
    expect(d.missing).toContain('despeses separades en fixes i variables');
  });

  it('mai més de 3 punts clau ni 3 accions', () => {
    const d = diagnose({
      monthlyNetIncome: 2000, monthlyFixedExpenses: 800, monthlyVariableExpenses: 900, monthlyDebtPayments: 100,
      currentSavings: 100, employmentType: 'temporal', goals: [{ description: 'Cotxe', amount: 12000, targetYear: 2028 }],
    }, now);
    expect(d.findings.length).toBeLessThanOrEqual(3);
    expect(d.actions.length).toBeLessThanOrEqual(3);
  });
});
