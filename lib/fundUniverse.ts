// lib/fundUniverse.ts
// Fons de treball de l'assessor (llista "LLISTAT DE FONS", Drive FACTOR OTC,
// revisada 2026-11-06). Serveix per reconèixer ISIN a la importació i, a la
// fase C, per construir propostes. No conté rendiments ni preus: només
// identificació. Els fons nord-americans de la llista original s'han deixat
// fora perquè no tenen KID (PRIIPs) i no són comercialitzables a minoristes a
// Espanya.

import { FINANCIAL_PRODUCTS } from './products';

export interface UniverseFund {
  isin:     string;
  name:     string;
  category: string;
  // Dades de la fitxa del fons (Morningstar o gestora). Sense return5Y i
  // volatility el fons no té projecció i la proposta no es pot aprovar.
  return5Y?:   number;   // rendibilitat anualitzada 5 anys (%)
  volatility?: number;   // desviació estàndard anualitzada (%)
  ter?:        number;   // despeses corrents (%)
  srri?:       1 | 2 | 3 | 4 | 5 | 6 | 7;
  source?:     string;   // p. ex. "Morningstar, fitxa 30/09/2026"
}

export const ADVISOR_FUNDS: UniverseFund[] = [
  { isin: 'LU2305834041', name: 'Invesco Continental European Small Cap Equity A EUR Acc', category: 'RV Europa Small Caps' },
  { isin: 'IE00B42W4L06', name: 'Vanguard Global Small-Cap Index Fund EUR Acc',             category: 'RV Global Small Caps' },
  { isin: 'IE0031786696', name: 'Vanguard Emerging Markets Stock Index Fund EUR',           category: 'RV Emergents' },
  { isin: 'IE00B8H6X308', name: 'Federated Hermes Asia ex-Japan Equity Fund F Acc',         category: 'RV Àsia ex-Japó' },
  { isin: 'IE00B3VXGD32', name: 'Polar Capital Biotechnology R Inc',                        category: 'RV Salut / Biotecnologia' },
  { isin: 'IE00BM95B621', name: 'Polar Capital Global Technology Fund R',                   category: 'RV Tecnologia' },
  { isin: 'LU1841614867', name: 'Fidelity Funds Global Technology A-Acc-EUR (Hedged)',      category: 'RV Tecnologia' },
  { isin: 'IE00B4468526', name: 'Polar Capital Global Technology R EUR',                    category: 'RV Tecnologia' },
  { isin: 'IE00BF0GL329', name: 'Polar Capital Artificial Intelligence Fund I Acc',         category: 'RV Tecnologia / IA' },
  { isin: 'LU0273159177', name: 'DWS Invest Gold and Precious Metals Equities LC',          category: 'RV Mineres d\'or' },
  { isin: 'LU0252963896', name: 'BlackRock GF World Energy Fund D2 EUR',                    category: 'RV Energia' },
  { isin: 'LU0326422176', name: 'BlackRock GF World Energy Fund A2 EUR Hedged',             category: 'RV Energia' },
  { isin: 'LU0408222247', name: 'BlackRock GF World Energy Fund A4 EUR',                    category: 'RV Energia' },
  { isin: 'LU0171301533', name: 'BlackRock GF World Energy Fund A2',                        category: 'RV Energia' },
  { isin: 'LU0714179727', name: 'JPMorgan IF Global Dividend Fund A (div) EUR',             category: 'RV Global Dividends' },
  { isin: 'LU0625737910', name: 'Pictet China Index P EUR',                                 category: 'RV Xina' },
];

/**
 * Valida un ISIN (ISO 6166): 2 lletres de país, 9 alfanumèrics i un dígit de
 * control calculat amb l'algorisme de Luhn sobre els dígits expandits
 * (A=10 … Z=35).
 */
export function isValidIsin(raw: string): boolean {
  const isin = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digits = isin.slice(0, -1).split('').map(c => parseInt(c, 36).toString()).join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[isin.length - 1]);
}

/** Busca un ISIN als fons de l'assessor i al catàleg general de productes. */
export function lookupIsin(raw: string): { name: string; category: string; source: 'advisor' | 'catalog' } | null {
  const isin = raw.trim().toUpperCase();
  const a = ADVISOR_FUNDS.find(f => f.isin === isin);
  if (a) return { name: a.name, category: a.category, source: 'advisor' };
  const p = FINANCIAL_PRODUCTS.find(f => f.isin?.toUpperCase() === isin);
  if (p) return { name: p.name, category: String(p.assetClass), source: 'catalog' };
  return null;
}
