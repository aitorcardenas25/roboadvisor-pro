// lib/fundPlatforms.ts
// On es pot comprar cada fons de la llista de l'assessor (ADVISOR_FUNDS).
//
// Només hi ha el que s'ha comprovat al cercador PÚBLIC de cada plataforma, per
// ISIN, el 25/11/2026. Tres estats per fons i plataforma:
//   'si'  → el fons surt al cercador públic de la plataforma.
//   'no'  → s'ha buscat l'ISIN i no surt (pot ser que hi hagi una altra classe
//           del mateix fons, però no aquesta).
//   (absent) → no comprovat: la plataforma no té cercador públic o no s'hi ha
//           buscat. NO vol dir que no hi sigui.
//
// Fonts:
//   MyInvestor → myinvestor.es/inversion/fondos-inversion (Buscador de fondos).
//                Només fons; els ETF van pel bròquer i el seu cercador públic
//                no tornava resultats, per això no es marquen.
//   Openbank   → openbank.es/inversiones/buscador-fondos-inversion. Només fons.
//   Gestora    → Cobas, azValor, Magallanes, Horos i Bestinver venen els seus
//                fons directament des de la seva web ("Abrir cuenta",
//                "Invertir", "Hazte cliente"), comprovat el 25/11/2026.
//   Trade Republic, DEGIRO i Renta 4 → sense cercador públic per ISIN (cal
//                compte). Queden com a "per confirmar".
//
// Revisar cada trimestre: les plataformes donen d'alta i de baixa fons.

export type PlatformId = 'myinvestor' | 'openbank' | 'trade-republic' | 'degiro' | 'renta4' | 'gestora';
export type Availability = 'si' | 'no';

export interface Platform {
  id:    PlatformId;
  name:  string;
  /** Què s'hi pot comprar en general (per orientar quan no està comprovat). */
  sells: 'fons' | 'etf' | 'fons i etf';
}

export const PLATFORMS: Platform[] = [
  { id: 'myinvestor',     name: 'MyInvestor',               sells: 'fons i etf' },
  { id: 'openbank',       name: 'Openbank',                 sells: 'fons i etf' },
  { id: 'trade-republic', name: 'Trade Republic',           sells: 'etf' },
  { id: 'degiro',         name: 'DEGIRO',                   sells: 'etf' },
  { id: 'renta4',         name: 'Renta 4',                  sells: 'fons i etf' },
  { id: 'gestora',        name: 'Directament a la gestora', sells: 'fons' },
];

export const PLATFORMS_CHECKED_AT = '2026-11-25';

type Row = Partial<Record<PlatformId, Availability>>;
const S: Availability = 'si';
const N: Availability = 'no';

export const FUND_PLATFORMS: Record<string, Row> = {
  // ISIN            MyInvestor  Openbank   (gestora)
  LU2305834041: { myinvestor: N, openbank: N },   // Invesco Continental European Small Cap A
  IE00B42W4L06: { myinvestor: S, openbank: N },   // Vanguard Global Small-Cap
  IE0031786696: { myinvestor: S, openbank: N },   // Vanguard Emerging Markets
  IE00B8H6X308: { myinvestor: S, openbank: N },   // Federated Hermes Asia ex-Japan
  IE00B3VXGD32: { myinvestor: S, openbank: S },   // Polar Capital Biotechnology
  IE00BM95B621: { myinvestor: S, openbank: S },   // Polar Capital Global Technology
  IE00BF0GL436: { myinvestor: N, openbank: N },   // Polar Capital AI I EUR
  LU1841614867: { myinvestor: S, openbank: S },   // Fidelity Global Technology (Hedged)
  LU0273159177: { myinvestor: S, openbank: S },   // DWS Gold and Precious Metals
  LU0252963896: { myinvestor: N, openbank: N },   // BlackRock World Energy D2
  LU0329202252: { myinvestor: S, openbank: S },   // JPM Global Dividend A acc
  LU0625737910: { myinvestor: S, openbank: N },   // Pictet China Index P
  LU0996182563: { myinvestor: S, openbank: S },   // Amundi Index MSCI World
  IE0008248803: { myinvestor: S, openbank: N },   // Vanguard Eurozone Stock
  LU0389811885: { myinvestor: S, openbank: S },   // Amundi Core MSCI Europe
  LU0996177134: { myinvestor: S, openbank: S },   // Amundi Core MSCI EM
  IE00B03HD191: { myinvestor: S, openbank: N },   // Vanguard Global Stock
  IE0032126645: { myinvestor: S, openbank: N },   // Vanguard U.S. 500
  IE0007987708: { myinvestor: S, openbank: N },   // Vanguard European Stock
  IE00BD0NCM55: { myinvestor: S, openbank: S },   // iShares Developed World Index
  IE00BYWYCC39: { myinvestor: S, openbank: N },   // iShares Emerging Markets Index
  DE000DWS1U90: { myinvestor: S, openbank: S },   // DWS Top Dividende LC
  LU0353647737: { myinvestor: N, openbank: S },   // Fidelity European Dividend
  LU2813189938: { myinvestor: S, openbank: N },   // Fidelity Global Defensive Equity
  LU3123374798: { myinvestor: N, openbank: N },   // Fidelity Global Defensive Equity (hedged)
  LU1627197004: { myinvestor: N, openbank: S },   // Fidelity Global Equity Income ESG
  // Fons espanyols de gestores value: es poden comprar directament a la gestora.
  ES0119199000: { myinvestor: N, openbank: N, gestora: S },   // Cobas Internacional C
  ES0124037005: { myinvestor: N, openbank: N, gestora: S },   // Cobas Selección C
  ES0113728002: { myinvestor: N, openbank: N, gestora: S },   // Cobas Grandes Compañías C
  ES0119184002: { myinvestor: N, openbank: N, gestora: S },   // Cobas Iberia C
  ES0119207001: { myinvestor: S, openbank: N, gestora: S },   // Cobas Renta
  ES0146309002: { myinvestor: S, openbank: N, gestora: S },   // Horos Value Internacional
  ES0146311008: { myinvestor: S, openbank: N, gestora: S },   // Horos Value Iberia
  ES0112611001: { myinvestor: S, openbank: N, gestora: S },   // Azvalor Internacional
  ES0112616000: { myinvestor: S, openbank: N, gestora: S },   // Azvalor Iberia
  ES0112609005: { myinvestor: S, openbank: N, gestora: S },   // Azvalor Blue Chips
  ES0112602000: { myinvestor: S, openbank: N, gestora: S },   // Azvalor Managers
  ES0112601002: { myinvestor: N, openbank: N, gestora: S },   // Azvalor Capital
  ES0159201013: { myinvestor: S, openbank: N, gestora: S },   // Magallanes Iberian Equity M
  ES0159259011: { myinvestor: S, openbank: N, gestora: S },   // Magallanes European Equity M
  ES0159202011: { myinvestor: S, openbank: N, gestora: S },   // Magallanes Microcaps Europe B
  ES0114673033: { myinvestor: N, openbank: N, gestora: S },   // Bestinfond
  ES0114638036: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Internacional
  ES0114561006: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Grandes Compañías
  ES0183793001: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Megatendencias
  ES0147622031: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Bolsa
  ES0112763000: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Norteamérica
  ES0114675038: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Renta
  ES0183091000: { myinvestor: N, openbank: N, gestora: S },   // Bestinver Corto Plazo
  // Renda fixa i monetari (fons)
  IE00B18GC888: { myinvestor: S, openbank: N },   // Vanguard Global Bond (EUR hedged)
  IE0007472115: { myinvestor: S, openbank: N },   // Vanguard Euro Government Bond
  IE00BH65QP47: { myinvestor: S, openbank: N },   // Vanguard Global Short-Term Bond
  LU0034353002: { myinvestor: S, openbank: S },   // DWS Floating Rate Notes
};

/** Si un ISIN és un ETF borsari (es compra al bròquer, no al cercador de fons). */
export function isExchangeTraded(name: string): boolean {
  return /\b(UCITS ETF|ETF)\b/i.test(name);
}

export interface PlatformInfo {
  /** Plataformes on surt al cercador públic. */
  available: Platform[];
  /** Plataformes on s'ha buscat i no surt. */
  notFound:  Platform[];
  /** Plataformes que podrien tenir-lo però no s'han pogut comprovar. */
  unchecked: Platform[];
}

/**
 * Disponibilitat d'un fons per plataforma. Els ETF no surten als cercadors de
 * fons: totes les plataformes que venen ETF queden "per confirmar".
 */
export function platformsFor(isin: string, name = ''): PlatformInfo {
  const row = FUND_PLATFORMS[isin.trim().toUpperCase()] ?? {};
  const etf = isExchangeTraded(name);
  const available: Platform[] = [], notFound: Platform[] = [], unchecked: Platform[] = [];
  for (const p of PLATFORMS) {
    const v = row[p.id];
    if (v === 'si') available.push(p);
    else if (v === 'no') notFound.push(p);
    else if (etf ? p.sells !== 'fons' : p.sells !== 'etf' && p.id !== 'gestora') unchecked.push(p);
  }
  return { available, notFound, unchecked };
}

/** Text curt per a la fitxa: "MyInvestor, Openbank" o "" si no n'hi ha cap de comprovada. */
export function availableLabel(isin: string, name = ''): string {
  return platformsFor(isin, name).available.map(p => p.name).join(', ');
}
