// lib/proposalTemplates.ts
// Plantilles de partida per a l'editor de propostes, preses de les carteres que
// l'assessor va proposar a les sessions presencials (Drive FACTOR OTC, document
// APUNTS, feb-mar 2026). Són un punt de partida editable, no una recomanació:
// la proposta continua passant pel control d'adequació i necessita dades reals
// de cada fons per aprovar-se.
//
// No hi ha plantilles conservadores ni moderades: la llista de fons de
// l'assessor encara no té fons de renda fixa ni monetaris.

import { fundToItem, type ProposalItem, type ProposalProfile } from './proposalMath';

export interface ProposalTemplate {
  id:          string;
  label:       string;
  profile:     ProposalProfile;
  description: string;
  weights:     { isin: string; weight: number }[];
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'sessions-rv-diversificada',
    label: 'RV global diversificada (sessions 2026)',
    profile: 'dinamic',
    description: '100 % renda variable: món, Eurozona, emergents i una mica d\'or.',
    weights: [
      { isin: 'LU0996182563', weight: 45 },   // Amundi MSCI World
      { isin: 'IE0008248803', weight: 30 },   // Vanguard Eurozone
      { isin: 'LU0996177134', weight: 20 },   // Amundi MSCI EM
      { isin: 'LU0273159177', weight: 5 },    // DWS Gold & Precious Metals
    ],
  },
  {
    id: 'sessions-rv-small-caps',
    label: 'RV global amb small caps (sessions 2026)',
    profile: 'dinamic',
    description: '100 % renda variable amb més pes en empreses petites i mineres d\'or.',
    weights: [
      { isin: 'LU0996182563', weight: 35 },   // Amundi MSCI World
      { isin: 'IE0008248803', weight: 25 },   // Vanguard Eurozone
      { isin: 'IE00B03HCZ61', weight: 10 },   // Vanguard US Small-Cap
      { isin: 'IE00B42W4L06', weight: 10 },   // Vanguard Global Small-Cap
      { isin: 'LU0996177134', weight: 10 },   // Amundi MSCI EM
      { isin: 'IE00BQQP9G91', weight: 10 },   // VanEck Gold Miners
    ],
  },
];

/** Línies de proposta d'una plantilla. Null si la plantilla no existeix o té un fons desconegut. */
export function templateItems(id: string): ProposalItem[] | null {
  const t = PROPOSAL_TEMPLATES.find(x => x.id === id);
  if (!t) return null;
  const items = t.weights.map(w => fundToItem(w.isin, w.weight));
  return items.every((x): x is ProposalItem => x !== null) ? items : null;
}
