import { describe, it, expect } from 'vitest';
import { PROPOSAL_TEMPLATES, PROFILE_MODELS, templateItems } from '@/lib/proposalTemplates';
import { checkProposalSuitability, PROFILES } from '@/lib/proposalMath';
import { lookupIsin } from '@/lib/fundUniverse';

describe('plantilles de proposta', () => {
  it('cada plantilla suma 100 % i només fa servir fons coneguts de l\'assessor', () => {
    for (const t of PROPOSAL_TEMPLATES) {
      expect(t.weights.reduce((s, w) => s + w.weight, 0)).toBe(100);
      for (const w of t.weights) expect(lookupIsin(w.isin)).not.toBeNull();
      const items = templateItems(t.id)!;
      expect(items).toHaveLength(t.weights.length);
      expect(items.map(i => i.weight)).toEqual(t.weights.map(w => w.weight));
    }
  });
  it('no inventa rendiments: sense fitxa, les línies no porten dades de rendiment', () => {
    const items = templateItems('sessions-rv-diversificada')!;
    expect(items.find(i => i.isin === 'IE0008248803')?.historicalReturn5Y).toBeUndefined();
  });
  it('plantilla desconeguda → null', () => {
    expect(templateItems('no-existeix')).toBeNull();
  });

  it('cada perfil té una cartera tipus que passa el seu propi control d\'idoneïtat', () => {
    // Regressió (prova amb client fictici, 2026-11-18): la plantilla dinàmica superava el
    // SRRI màxim del perfil i "Suggerir segons perfil" triava fons sense preus.
    for (const profile of PROFILES) {
      const t = PROPOSAL_TEMPLATES.find(x => x.id === PROFILE_MODELS[profile])!;
      expect(t.profile).toBe(profile);
      const items = templateItems(t.id)!;
      const s = checkProposalSuitability({ items, profile, horizon: 10 });
      expect(s.issues.filter(i => i.level === 'inadequate')).toEqual([]);
    }
  });
  it('les plantilles fan servir només fons amb preus oficials carregats', () => {
    // ISIN sense valors liquidatius a fund_navs el 18/11/2026
    const senseDades = ['IE00BQQP9G91', 'IE00B03HCZ61'];
    for (const t of PROPOSAL_TEMPLATES) for (const w of t.weights) expect(senseDades).not.toContain(w.isin);
  });
});

import { STARTER_PORTFOLIOS, emergencyCheck } from '@/lib/proposalTemplates';
import { ADVISOR_FUNDS } from '@/lib/fundUniverse';
import { classifyFund } from '@/lib/fundClassification';
import { platformsFor } from '@/lib/fundPlatforms';

describe('carteres d\'inici', () => {
  it('són 3 (Prudent, Equilibrada, Dinàmica), de 2 o 3 fons, que sumen 100 %', () => {
    expect(STARTER_PORTFOLIOS.map(t => t.label)).toEqual(['Prudent', 'Equilibrada', 'Dinàmica']);
    for (const t of STARTER_PORTFOLIOS) {
      expect(t.weights.length).toBeGreaterThanOrEqual(2);
      expect(t.weights.length).toBeLessThanOrEqual(3);
      expect(t.weights.reduce((s, w) => s + w.weight, 0)).toBe(100);
      expect(t.equity + t.bonds).toBe(100);
    }
  });
  it('el % de renda variable declarat quadra amb els fons, i emergents fan 10-15 % de la borsa', () => {
    for (const t of STARTER_PORTFOLIOS) {
      const rv = t.weights.filter(w => /^RV/.test(lookupIsin(w.isin)!.category)).reduce((s, w) => s + w.weight, 0);
      expect(rv, t.id).toBe(t.equity);
      const em = t.weights.filter(w => /Emergents/.test(lookupIsin(w.isin)!.category)).reduce((s, w) => s + w.weight, 0);
      expect(em / rv, t.id).toBeGreaterThanOrEqual(0.1);
      expect(em / rv, t.id).toBeLessThanOrEqual(0.15);
    }
  });
  it('només fons indexats, amb TER oficial i que es poden comprar a MyInvestor', () => {
    const byIsin = new Map(ADVISOR_FUNDS.map(f => [f.isin, f]));
    for (const t of STARTER_PORTFOLIOS) for (const w of t.weights) {
      const f = byIsin.get(w.isin)!;
      expect(f, w.isin).toBeDefined();
      expect(f.ter, w.isin).toBeGreaterThan(0);
      expect(f.terSource, w.isin).toBeTruthy();
      expect(classifyFund(w.isin, f.category, f.name).management, w.isin).toBe('passiva');
      expect(platformsFor(w.isin, f.name).available.map(p => p.id), w.isin).toContain('myinvestor');
    }
  });
  it('cada cartera passa el control d\'idoneïtat del seu perfil i porta el "per què" de cada fons', () => {
    for (const t of STARTER_PORTFOLIOS) {
      const items = templateItems(t.id)!;
      expect(items, t.id).toHaveLength(t.weights.length);
      expect(items.every(i => i.justification.length > 20), t.id).toBe(true);
      const s = checkProposalSuitability({ items, profile: t.profile, horizon: 10 });
      expect(s.issues.filter(i => i.level === 'inadequate'), t.id).toEqual([]);
    }
  });
});

describe('fons d\'emergència a la proposta', () => {
  it('menys de 3 mesos de despeses → sense fons d\'emergència', () => {
    const e = emergencyCheck({ monthlyNetIncome: 1500, monthlyExpenses: 1000, currentSavings: 2000, employmentType: 'indefinit' });
    expect(e.level).toBe('none');
    expect(e.months).toBe(2);
    expect(e.message).toMatch(/no té fons d'emergència/);
  });
  it('entre 3 mesos i l\'objectiu → coixí baix; objectiu complet → ok', () => {
    expect(emergencyCheck({ monthlyNetIncome: 1500, monthlyExpenses: 1000, currentSavings: 4000, employmentType: 'indefinit' }).level).toBe('low');
    expect(emergencyCheck({ monthlyNetIncome: 1500, monthlyExpenses: 1000, currentSavings: 6000, employmentType: 'indefinit' }).level).toBe('ok');
    // autònom: objectiu 12 mesos
    expect(emergencyCheck({ monthlyNetIncome: 1500, monthlyExpenses: 1000, currentSavings: 6000, employmentType: 'autonom' }).level).toBe('low');
  });
  it('sense ingressos també funciona si hi ha despeses i estalvi', () => {
    expect(emergencyCheck({ monthlyFixedExpenses: 600, monthlyVariableExpenses: 400, currentSavings: 1000 }).level).toBe('none');
  });
  it('si falten dades no s\'inventa res', () => {
    expect(emergencyCheck({}).level).toBe('unknown');
    expect(emergencyCheck({ monthlyExpenses: 1000 }).level).toBe('unknown');
    // Regressió (revisió PR #67): només despeses variables → no es pot dir que el coixí és complet
    expect(emergencyCheck({ monthlyNetIncome: 2000, monthlyVariableExpenses: 200, currentSavings: 1200 }).level).toBe('unknown');
  });
});
