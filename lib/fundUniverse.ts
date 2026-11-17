// lib/fundUniverse.ts
// Fons de treball de l'assessor (llista "LLISTAT DE FONS", Drive FACTOR OTC,
// revisada 2026-11-06) + fons indexats de les carteres de les sessions (2026-11-09). Serveix per reconèixer ISIN a la importació i, a la
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
  { isin: 'IE00B3VXGD32', name: 'Polar Capital Biotechnology R EUR Dist',                  category: 'RV Salut / Biotecnologia' },
  { isin: 'IE00BM95B621', name: 'Polar Capital Global Technology Fund R EUR Acc',           category: 'RV Tecnologia' },
  { isin: 'IE00BF0GL436', name: 'Polar Capital Artificial Intelligence Fund I EUR Acc',     category: 'RV Tecnologia / IA' },
  { isin: 'LU1841614867', name: 'Fidelity Funds Global Technology A-Acc-EUR (Hedged)',      category: 'RV Tecnologia' },
  { isin: 'LU0273159177', name: 'DWS Invest Gold and Precious Metals Equities LC',          category: 'RV Mineres d\'or' },
  { isin: 'LU0252963896', name: 'BlackRock GF World Energy Fund D2 EUR Acc',                category: 'RV Energia' },
  { isin: 'LU0329202252', name: 'JPMorgan Investment Funds - Global Dividend Fund A (acc) EUR', category: 'RV Global Dividends' },
  { isin: 'LU0625737910', name: 'Pictet China Index P EUR',                                 category: 'RV Xina' },
  // Fons indexats nucli de les carteres proposades a les sessions presencials
  // (Drive FACTOR OTC, document APUNTS, feb-mar 2026). Afegits 2026-11-09.
  // Noms tal com consten al document; cal confirmar classe i dades amb la fitxa.
  { isin: 'LU0996182563', name: 'Amundi Index MSCI World AE Acc',                           category: 'RV Global' },
  { isin: 'IE0008248803', name: 'Vanguard Eurozone Stock Index Fund EUR Acc',               category: 'RV Eurozona' },
  { isin: 'LU0389811885', name: 'Amundi Index MSCI Europe AE Acc',                          category: 'RV Europa' },
  { isin: 'LU0996177134', name: 'Amundi Index MSCI Emerging Markets AE Acc',                category: 'RV Emergents' },
  { isin: 'IE00B03HCZ61', name: 'Vanguard U.S. Small-Cap Index Fund',                       category: 'RV EUA Small Caps' },
  { isin: 'IE00B42W3S00', name: 'Vanguard Global Small-Cap Index Fund (classe IE00B42W3S00)', category: 'RV Global Small Caps' },
  { isin: 'IE00BQQP9G91', name: 'VanEck Gold Miners UCITS ETF',                             category: 'RV Mineres d\'or' },
  // Fons i ETF amb històric oficial de la gestora carregat a fund_navs
  // (2026-11-17, /mnt/project-files/fons/cobertura-historics.md). Nom oficial
  // de la classe segons la web de la gestora.
  { isin: 'IE00B03HD191', name: 'Vanguard Global Stock Index Fund EUR Acc',                 category: 'RV Global' },
  { isin: 'IE0032126645', name: 'Vanguard U.S. 500 Stock Index Fund EUR Acc',               category: 'RV EUA' },
  { isin: 'IE0007987708', name: 'Vanguard European Stock Index Fund EUR Acc',               category: 'RV Europa' },
  { isin: 'IE00BK5BQT80', name: 'Vanguard FTSE All-World UCITS ETF USD Acc',                category: 'RV Global' },
  { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World UCITS ETF USD Acc',                category: 'RV Global' },
  { isin: 'IE00BD0NCM55', name: 'iShares Developed World Index Fund D Acc EUR',             category: 'RV Global' },
  { isin: 'IE00B5BMR087', name: 'iShares Core S&P 500 UCITS ETF USD Acc',                   category: 'RV EUA' },
  { isin: 'IE00B4K48X80', name: 'iShares Core MSCI Europe UCITS ETF EUR Acc',               category: 'RV Europa' },
  { isin: 'IE00BKM4GZ66', name: 'iShares Core MSCI EM IMI UCITS ETF USD Acc',               category: 'RV Emergents' },
  { isin: 'IE00BYWYCC39', name: 'iShares Emerging Markets Index Fund D Acc EUR',            category: 'RV Emergents' },
  { isin: 'LU0292107991', name: 'Xtrackers MSCI EM Asia Screened Swap UCITS ETF 1C',        category: 'RV Àsia emergent' },
  { isin: 'IE00BF4RFH31', name: 'iShares MSCI World Small Cap UCITS ETF USD Acc',           category: 'RV Global Small Caps' },
  { isin: 'IE000F354Q61', name: 'Xtrackers MSCI World Small Cap UCITS ETF 1C',              category: 'RV Global Small Caps' },
  { isin: 'IE00B6R51Z18', name: 'iShares Oil & Gas Exploration & Production UCITS ETF USD Acc', category: 'RV Energia' },
  { isin: 'IE00BJ5JP105', name: 'iShares MSCI World Energy Sector UCITS ETF USD Dist',      category: 'RV Energia' },
  { isin: 'IE000NFR7C63', name: 'iShares MSCI China Tech UCITS ETF USD Acc',                category: 'RV Xina' },
  { isin: 'DE000DWS1U90', name: 'DWS Top Dividende LC',                                     category: 'RV Global Dividends' },
  { isin: 'LU0353647737', name: 'Fidelity Funds European Dividend Fund A-Acc-EUR',          category: 'RV Europa Dividends' },
  { isin: 'LU2813189938', name: 'Fidelity Funds Global Defensive Equity Fund A-Acc-EUR',    category: 'RV Global Dividends' },
  { isin: 'LU3123374798', name: 'Fidelity Funds Global Defensive Equity Fund A-Acc-EUR (Euro/USD hedged)', category: 'RV Global Dividends' },
  { isin: 'LU1627197004', name: 'Fidelity Funds Global Equity Income ESG Fund A-Acc-EUR',  category: 'RV Global Dividends' },
  { isin: 'IE00B18GC888', name: 'Vanguard Global Bond Index Fund EUR Hedged Acc',           category: 'RF Global (cobert EUR)' },
  { isin: 'IE00BDBRDM35', name: 'iShares Core Global Aggregate Bond UCITS ETF EUR Hedged Acc', category: 'RF Global (cobert EUR)' },
  { isin: 'IE0007472115', name: 'Vanguard Euro Government Bond Index Fund EUR Acc',         category: 'RF Govern Euro' },
  { isin: 'IE00B4WXJJ64', name: 'iShares Core Euro Government Bond UCITS ETF EUR Dist',     category: 'RF Govern Euro' },
  { isin: 'IE00BH65QP47', name: 'Vanguard Global Short-Term Bond Index Fund EUR Hedged Acc', category: 'RF Curt termini (cobert EUR)' },
  { isin: 'LU0034353002', name: 'DWS Floating Rate Notes LC',                               category: 'RF Tipus variable' },
  { isin: 'LU0290358497', name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF 1C',        category: 'Monetari EUR' },
];

// Altres classes del mateix fons que ja és a la llista (2026-11-17, decisió de
// l'Aitor: una sola classe per fons). No surten per triar a les propostes, però
// la importació de clients les continua reconeixent. Les classes de
// distribució s'hi deixen quan hi ha classe d'acumulació: el preu baixa en
// pagar dividends i la rendibilitat calculada sortiria més baixa que la real.
export const ALTERNATE_CLASSES: UniverseFund[] = [
  { isin: 'LU0714179727', name: 'JPMorgan IF Global Dividend Fund A (div) EUR',             category: 'RV Global Dividends' },
  { isin: 'DE0009848119', name: 'DWS Top Dividende LD',                                     category: 'RV Global Dividends' },
  { isin: 'IE00B4468526', name: 'Polar Capital Global Technology R EUR Dist',               category: 'RV Tecnologia' },
  { isin: 'IE00BF0GL329', name: 'Polar Capital Artificial Intelligence Fund I USD Acc',     category: 'RV Tecnologia / IA' },
  { isin: 'LU0326422176', name: 'BlackRock GF World Energy Fund A2 EUR Hedged',             category: 'RV Energia' },
  { isin: 'LU0408222247', name: 'BlackRock GF World Energy Fund A4 EUR',                    category: 'RV Energia' },
  { isin: 'LU0171301533', name: 'BlackRock GF World Energy Fund A2',                        category: 'RV Energia' },
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
  const a = ADVISOR_FUNDS.find(f => f.isin === isin) ?? ALTERNATE_CLASSES.find(f => f.isin === isin);
  if (a) return { name: a.name, category: a.category, source: 'advisor' };
  const p = FINANCIAL_PRODUCTS.find(f => f.isin?.toUpperCase() === isin);
  if (p) return { name: p.name, category: String(p.assetClass), source: 'catalog' };
  return null;
}
