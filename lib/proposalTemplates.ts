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

/** Cartera tipus de cada perfil (punt de partida de "Suggerir segons perfil"). */
export const PROFILE_MODELS: Record<ProposalProfile, string> = {
  conservador: 'model-conservador',
  moderat:     'model-moderat',
  dinamic:     'model-dinamic',
  agressiu:    'sessions-rv-diversificada',
};

/** Línies de proposta d'una plantilla. Null si la plantilla no existeix o té un fons desconegut. */
export function templateItems(id: string, navs: NavPerformanceMap = {}): ProposalItem[] | null {
  const t = PROPOSAL_TEMPLATES.find(x => x.id === id);
  if (!t) return null;
  const items = t.weights.map(w => fundToItem(w.isin, w.weight, navs));
  return items.every((x): x is ProposalItem => x !== null) ? items : null;
}
