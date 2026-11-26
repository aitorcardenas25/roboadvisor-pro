// lib/proposalTemplates.ts
// Plantilles de partida per a l'editor de propostes, preses de les carteres que
// l'assessor va proposar a les sessions presencials (Drive FACTOR OTC, document
// APUNTS, feb-mar 2026). Són un punt de partida editable, no una recomanació:
// la proposta continua passant pel control d'adequació i necessita dades reals
// de cada fons per aprovar-se.
//
// Les carteres tipus per perfil (PROFILE_MODELS) són el punt de partida del botó
// "Suggerir segons perfil": només fons indexats que ja tenen valors liquidatius
// oficials a fund_navs, perquè la proposta es pugui aprovar.

import { fundToItem, type NavPerformanceMap, type ProposalItem, type ProposalProfile } from './proposalMath';
import { analyzeBudget, emergencyMonths, pickFinanceFields, type BudgetInput } from './budget';

export interface ProposalTemplate {
  id:          string;
  label:       string;
  profile:     ProposalProfile;
  description: string;
  weights:     { isin: string; weight: number }[];
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'model-conservador',
    label: 'Cartera tipus conservadora',
    profile: 'conservador',
    description: '20 % renda variable global, 50 % renda fixa i 30 % monetari.',
    weights: [
      { isin: 'LU0996182563', weight: 20 },   // Amundi MSCI World
      { isin: 'IE00BH65QP47', weight: 30 },   // Vanguard Global Short-Term Bond (cobert EUR)
      { isin: 'IE0007472115', weight: 20 },   // Vanguard Euro Government Bond
      { isin: 'LU0290358497', weight: 30 },   // Xtrackers EUR Overnight Rate Swap (monetari)
    ],
  },
  {
    id: 'model-moderat',
    label: 'Cartera tipus moderada',
    profile: 'moderat',
    description: '50 % renda variable (món i emergents), 40 % renda fixa i 10 % monetari.',
    weights: [
      { isin: 'LU0996182563', weight: 42 },   // Amundi MSCI World
      { isin: 'LU0996177134', weight: 8 },    // Amundi MSCI EM
      { isin: 'IE00B18GC888', weight: 25 },   // Vanguard Global Bond (cobert EUR)
      { isin: 'IE0007472115', weight: 15 },   // Vanguard Euro Government Bond
      { isin: 'LU0290358497', weight: 10 },   // Xtrackers EUR Overnight Rate Swap (monetari)
    ],
  },
  {
    id: 'model-dinamic',
    label: 'Cartera tipus dinàmica',
    profile: 'dinamic',
    description: '80 % renda variable (món, Eurozona i emergents) i 20 % renda fixa global.',
    weights: [
      { isin: 'LU0996182563', weight: 55 },   // Amundi MSCI World
      { isin: 'IE0008248803', weight: 15 },   // Vanguard Eurozone
      { isin: 'LU0996177134', weight: 10 },   // Amundi MSCI EM
      { isin: 'IE00B18GC888', weight: 20 },   // Vanguard Global Bond (cobert EUR)
    ],
  },
  {
    // Abans "RV global diversificada" com a dinàmica: amb un 100 % en renda variable
    // no passava el control d'idoneïtat del perfil dinàmic (SRRI 5,55 > 5,5).
    id: 'sessions-rv-diversificada',
    label: 'RV global diversificada (sessions 2026) · cartera tipus agressiva',
    profile: 'agressiu',
    description: '100 % renda variable: món, Eurozona, emergents i una mica d\'or.',
    weights: [
      { isin: 'LU0996182563', weight: 45 },   // Amundi MSCI World
      { isin: 'IE0008248803', weight: 30 },   // Vanguard Eurozone
      { isin: 'LU0996177134', weight: 20 },   // Amundi MSCI EM
      { isin: 'LU0273159177', weight: 5 },    // DWS Gold & Precious Metals
    ],
  },
  {
    // Abans hi havia IE00B03HCZ61 comentat com a "Vanguard US Small-Cap" (és el
    // Vanguard Global Stock, classe Investor) i el VanEck Junior Gold Miners, sense preus.
    id: 'sessions-rv-small-caps',
    label: 'RV global amb small caps (sessions 2026)',
    profile: 'agressiu',
    description: '100 % renda variable amb més pes en empreses petites i mineres d\'or.',
    weights: [
      { isin: 'LU0996182563', weight: 35 },   // Amundi MSCI World
      { isin: 'IE0008248803', weight: 25 },   // Vanguard Eurozone
      { isin: 'IE00B42W4L06', weight: 20 },   // Vanguard Global Small-Cap
      { isin: 'LU0996177134', weight: 10 },   // Amundi MSCI EM
      { isin: 'LU0273159177', weight: 10 },   // DWS Gold & Precious Metals
    ],
  },
];

// ─── Carteres d'inici ────────────────────────────────────────────────────────
// Decisió de l'Aitor (2026-11-26): per a qui comença (o per tenir una base amb
// cara i ulls amb qui ja té inversions), poques peces i indexades. Plantilles
// de l'assessor, no recomanacions públiques: sempre editables i amb el mateix
// control d'adequació que qualsevol proposta.
//  - Renda variable: iShares Developed World (MSCI World, 0,12 %) + iShares
//    Emerging Markets (MSCI EM, 0,20 %): els fons globals més barats de la llista,
//    tots dos a MyInvestor i amb preus oficials diaris. Emergents ≈ 10-13 % de la
//    part de borsa, a prop del pes que tenen al mercat mundial (MSCI ACWI ≈ 11 %).
//  - Renda fixa: Vanguard Global Short-Term Bond (1-3 anys, poca oscil·lació)
//    a la prudent; Vanguard Global Bond (bons de tot el món) a l'equilibrada.
//    Tots dos coberts a euros, 0,15 %.
// No hi ha cap regla de "redistribuir als 15.000 €": la cartera es manté amb
// els mateixos fons i el que es revisa cada any és el % de renda fixa.

export interface StarterPortfolio extends ProposalTemplate {
  /** Per a qui és, en una línia. */
  forWhom: string;
  /** Per què aquests fons i pesos, en 2-3 frases curtes. */
  why:     string;
  /** % de renda variable / renda fixa. */
  equity:  number;
  bonds:   number;
  /** Text que va a la columna "per què" de cada fons. */
  notes:   Record<string, string>;
}

const NOTE_WORLD = 'Nucli de la cartera: unes 1.300 empreses grans i mitjanes de 23 països desenvolupats (índex MSCI World). Indexat i amb despeses de 0,12 %.';
const NOTE_EM    = 'Afegeix els països emergents (Xina, Taiwan, Índia, Corea…), que el MSCI World no inclou. Pes semblant al que tenen al mercat mundial.';

export const STARTER_PORTFOLIOS: StarterPortfolio[] = [
  {
    id: 'inici-prudent',
    label: 'Prudent',
    profile: 'moderat',
    equity: 50, bonds: 50,
    description: '50 % borsa mundial (desenvolupats + emergents) i 50 % bons a curt termini.',
    forWhom: 'Primera inversió, poca experiència o li faria por veure caigudes fortes.',
    why: 'La meitat en bons a curt termini esmorteeix les caigudes: en un any dolent de borsa (−30 %), la cartera hauria baixat aproximadament la meitat. Tres fons i prou.',
    weights: [
      { isin: 'IE00BD0NCM55', weight: 45 },   // iShares Developed World Index (MSCI World)
      { isin: 'IE00BYWYCC39', weight: 5 },    // iShares Emerging Markets Index (MSCI EM)
      { isin: 'IE00BH65QP47', weight: 50 },   // Vanguard Global Short-Term Bond (cobert EUR)
    ],
    notes: {
      IE00BD0NCM55: NOTE_WORLD,
      IE00BYWYCC39: NOTE_EM,
      IE00BH65QP47: 'Part estable: bons de tot el món a 1-3 anys amb la divisa coberta a euros. Oscil·la poc i serveix per reequilibrar quan la borsa cau.',
    },
  },
  {
    id: 'inici-equilibrada',
    label: 'Equilibrada',
    profile: 'dinamic',
    equity: 75, bonds: 25,
    description: '75 % borsa mundial (desenvolupats + emergents) i 25 % bons globals.',
    forWhom: 'Horitzó de més de 7-10 anys i aguanta veure la cartera en negatiu un temps.',
    why: 'La borsa fa créixer la cartera i la quarta part en bons dona un coixí per aportar o reequilibrar en les caigudes. Tres fons indexats amb despesa mitjana d\'uns 0,13 %.',
    weights: [
      { isin: 'IE00BD0NCM55', weight: 65 },   // iShares Developed World Index (MSCI World)
      { isin: 'IE00BYWYCC39', weight: 10 },   // iShares Emerging Markets Index (MSCI EM)
      { isin: 'IE00B18GC888', weight: 25 },   // Vanguard Global Bond (cobert EUR)
    ],
    notes: {
      IE00BD0NCM55: NOTE_WORLD,
      IE00BYWYCC39: NOTE_EM,
      IE00B18GC888: 'Bons de governs i empreses de tot el món amb la divisa coberta a euros. Normalment es mou diferent de la borsa i redueix les caigudes de la cartera.',
    },
  },
  {
    id: 'inici-dinamica',
    label: 'Dinàmica',
    profile: 'agressiu',
    equity: 100, bonds: 0,
    description: '100 % borsa mundial en dos fons: 88 % desenvolupats i 12 % emergents.',
    forWhom: 'Jove, horitzó de més de 15 anys, ingressos estables i fons d\'emergència complet.',
    why: 'Dos fons cobreixen unes 2.500 empreses de tot el món. És la cartera més senzilla possible: les aportacions noves van al fons que s\'hagi quedat per sota del seu pes. Pot caure un 30-35 % en un any dolent.',
    weights: [
      { isin: 'IE00BD0NCM55', weight: 88 },   // iShares Developed World Index (MSCI World)
      { isin: 'IE00BYWYCC39', weight: 12 },   // iShares Emerging Markets Index (MSCI EM)
    ],
    notes: {
      IE00BD0NCM55: NOTE_WORLD,
      IE00BYWYCC39: NOTE_EM,
    },
  },
];

/** Cartera tipus de cada perfil (punt de partida de "Suggerir segons perfil"). */
export const PROFILE_MODELS: Record<ProposalProfile, string> = {
  conservador: 'model-conservador',
  moderat:     'model-moderat',
  dinamic:     'model-dinamic',
  agressiu:    'sessions-rv-diversificada',
};

/** Línies de proposta d'una plantilla. Null si la plantilla no existeix o té un fons desconegut. */
export function templateItems(id: string, navs: NavPerformanceMap = {}): ProposalItem[] | null {
  const starter = STARTER_PORTFOLIOS.find(x => x.id === id);
  const t = starter ?? PROPOSAL_TEMPLATES.find(x => x.id === id);
  if (!t) return null;
  const items = t.weights.map(w => fundToItem(w.isin, w.weight, navs));
  if (!items.every((x): x is ProposalItem => x !== null)) return null;
  // Les carteres d'inici porten el "per què" de cada fons (surt a l'informe).
  return starter ? items.map(x => ({ ...x, justification: starter.notes[x.isin] ?? x.justification })) : items;
}

/**
 * Coixí d'emergència del client segons el que ha posat a l'Excel (estalvi i despeses).
 * - 'none': l'estalvi cobreix menys de 3 mesos de despeses → primer el coixí.
 * - 'low':  entre 3 mesos i l'objectiu de l'app (6 o 12 mesos segons la feina).
 * - 'ok':   coixí complet.
 * - 'unknown': falten l'estalvi o les despeses.
 * No inventa dades: si l'Excel no ho diu, retorna 'unknown'.
 */
export interface EmergencyCheck { level: 'none' | 'low' | 'ok' | 'unknown'; months: number | null; targetMonths: number; message: string }
export const EMERGENCY_MIN_MONTHS = 3;

export function emergencyCheck(personal: Record<string, unknown> = {}): EmergencyCheck {
  const a = analyzeBudget(pickFinanceFields(personal) as BudgetInput);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  // Sense ingressos analyzeBudget no calcula res; el coixí només necessita estalvi i despeses.
  // Un desglossament incomplet no compta (com a analyzeBudget): cal el total o bé fixes i variables.
  const fixed = num(personal.monthlyFixedExpenses), variable = num(personal.monthlyVariableExpenses);
  const spending = a?.totalSpending ?? (
    num(personal.monthlyExpenses)
    ?? (fixed !== null && variable !== null ? fixed + variable + (num(personal.monthlyDebtPayments) ?? 0) : null)
  );
  const savings = num(personal.currentSavings);
  const targetMonths = a?.emergency.monthsTarget ?? emergencyMonths(typeof personal.employmentType === 'string' ? personal.employmentType : undefined).months;
  if (savings === null || !spending || spending <= 0) {
    return { level: 'unknown', months: null, targetMonths, message: 'L\'Excel del client no diu quant estalvi té o quant gasta: comprova que té un fons d\'emergència abans d\'invertir.' };
  }
  const months = Math.floor(savings / spending * 10) / 10;
  const m = months.toLocaleString('ca-ES');
  if (months < EMERGENCY_MIN_MONTHS) {
    return { level: 'none', months, targetMonths, message: `El client no té fons d'emergència: l'estalvi cobreix ${m} mesos de despeses (mínim ${EMERGENCY_MIN_MONTHS}, objectiu ${targetMonths}). Abans d'invertir, primer el coixí en un compte remunerat o un monetari.` };
  }
  if (months < targetMonths) {
    return { level: 'low', months, targetMonths, message: `El coixí cobreix ${m} mesos de despeses (objectiu ${targetMonths}). Inverteix només el que sobri per sobre del coixí.` };
  }
  return { level: 'ok', months, targetMonths, message: `Fons d'emergència complet: ${m} mesos de despeses.` };
}
