// lib/fundClassification.ts — part pura (sense BD), usable també des del navegador.
// Classifica cada fons per estil de gestió (activa / passiva) i per classe
// d'actiu (renda variable / renda fixa / monetari / mixt) i calcula el
// repartiment de la cartera. Ho fan servir l'informe PDF, l'Excel de la
// proposta, l'editor de propostes i l'informe inicial del client.
//
// Criteris (decisió 2026-11-25):
// - Passiva = replica un índex (fons indexat o ETF). Activa = un gestor tria
//   els valors (inclosos els fons value espanyols i els temàtics).
// - Monetari compta dins la renda fixa als totals (és deute a molt curt
//   termini), però es mostra a part perquè el client vegi la liquiditat.
// - Mixt: es reparteix entre renda variable i fixa segons el % d'accions del
//   fons. Si el % no és oficial, es marca com a aproximat.

import { ADVISOR_FUNDS, ALTERNATE_CLASSES } from './fundUniverse';
import { FINANCIAL_PRODUCTS } from './products';

export type ManagementStyle = 'activa' | 'passiva';
export type AssetType = 'renda_variable' | 'renda_fixa' | 'monetari' | 'mixt' | 'altres';

export interface FundClassification {
  management?: ManagementStyle;  // undefined = no se sap (fons fora de la llista)
  assetType?:  AssetType;        // undefined = no se sap
  equityPct:   number;           // % en accions que compta a la cartera (0–100)
  approx?:     boolean;          // el % d'accions d'un mixt és aproximat
  source:      'llista' | 'catàleg' | 'deduït';
}

// ─── Fons de la llista de l'assessor (lib/fundUniverse.ts) ───────────────────
// Classificació revisada un per un (nom oficial de la classe i política de la
// gestora). El test __tests__/quant/fundClassification.test.ts obliga que cada
// fons nou de la llista hi sigui.
const P: ManagementStyle = 'passiva', A: ManagementStyle = 'activa';
type Entry = [ManagementStyle, AssetType, number?, boolean?];
const RV = (m: ManagementStyle): Entry => [m, 'renda_variable'];
const RF = (m: ManagementStyle): Entry => [m, 'renda_fixa'];

export const ADVISOR_CLASSIFICATION: Record<string, Entry> = {
  // Renda variable de gestió activa
  LU2305834041: RV(A), IE00B8H6X308: RV(A), IE00B3VXGD32: RV(A), IE00BM95B621: RV(A),
  IE00BF0GL436: RV(A), LU1841614867: RV(A), LU0273159177: RV(A), LU0252963896: RV(A),
  LU0329202252: RV(A), DE000DWS1U90: RV(A), LU0353647737: RV(A), LU2813189938: RV(A),
  LU3123374798: RV(A), LU1627197004: RV(A),
  // Gestores value espanyoles (totes de gestió activa)
  ES0119199000: RV(A), ES0124037005: RV(A), ES0113728002: RV(A), ES0119184002: RV(A),
  ES0146309002: RV(A), ES0146311008: RV(A), ES0112611001: RV(A), ES0112616000: RV(A),
  ES0112609005: RV(A), ES0112602000: RV(A), ES0159201013: RV(A), ES0159259011: RV(A),
  ES0159202011: RV(A), ES0114673033: RV(A), ES0114638036: RV(A), ES0114561006: RV(A),
  ES0183793001: RV(A), ES0147622031: RV(A), ES0112763000: RV(A),
  // Renda variable indexada (fons indexats i ETF)
  IE00B42W4L06: RV(P), IE0031786696: RV(P), LU0625737910: RV(P), LU0996182563: RV(P),
  IE0008248803: RV(P), LU0389811885: RV(P), LU0996177134: RV(P), IE00BQQP9G91: RV(P),
  IE00B03HD191: RV(P), IE0032126645: RV(P), IE0007987708: RV(P), IE00BK5BQT80: RV(P),
  IE00B4L5Y983: RV(P), IE00BD0NCM55: RV(P), IE00B5BMR087: RV(P), IE00B4K48X80: RV(P),
  IE00BKM4GZ66: RV(P), IE00BYWYCC39: RV(P), LU0292107991: RV(P), IE00BF4RFH31: RV(P),
  IE000F354Q61: RV(P), IE00B6R51Z18: RV(P), IE00BJ5JP105: RV(P), IE000NFR7C63: RV(P),
  // Renda fixa
  ES0119207001: RF(A), ES0114675038: RF(A), ES0183091000: RF(A), LU0034353002: RF(A),
  IE00B18GC888: RF(P), IE00BDBRDM35: RF(P), IE0007472115: RF(P), IE00B4WXJJ64: RF(P),
  IE00BH65QP47: RF(P),
  // Monetari
  LU0290358497: [P, 'monetari'],
  // Mixt: Azvalor Capital, defensiu amb més del 90 % en renda fixa → ≈10 % accions
  ES0112601002: [A, 'mixt', 10, true],
  // Altres classes del mateix fons
  IE00B03HCZ61: RV(P), IE00B42W3S00: RV(P), LU0714179727: RV(A), DE0009848119: RV(A),
  IE00B4468526: RV(A), IE00BF0GL329: RV(A), LU0326422176: RV(A), LU0408222247: RV(A),
  LU0171301533: RV(A),
};

const EQUITY_PCT: Record<AssetType, number> = { renda_variable: 100, renda_fixa: 0, monetari: 0, mixt: 50, altres: 0 };

/** % d'accions d'un mixt a partir del nom de la categoria (60/40, defensiu…). */
function mixedEquityPct(text: string): { pct: number; approx: boolean } {
  const m = text.match(/(\d{2})\s*\/\s*(\d{2})/) ?? text.match(/(\d{2})\s*%\s*(equity|accions|rv)/i);
  if (m) return { pct: Number(m[1]), approx: false };
  if (/defensiu|conservador|prudent/i.test(text)) return { pct: 25, approx: true };
  if (/agressiu|dinàmic|dinamic/i.test(text)) return { pct: 75, approx: true };
  return { pct: 50, approx: true };
}

/** Classe d'actiu deduïda del text de la categoria o del nom. */
function guessAssetType(text: string): AssetType | undefined {
  if (/monetari|money market|liquidit|overnight|\bcash\b/i.test(text)) return 'monetari';
  if (/mixt|mixed|multi.?asset|allocation|patrimoine|lifestrategy|balanced|retorn absolut|absolute return/i.test(text)) return 'mixt';
  if (/\bRF\b|renda fixa|renta fija|\bbond|obligac|govern|\bdeute|floating rate|corto plazo/i.test(text)) return 'renda_fixa';
  if (/\bor f[ií]sic|plata|mat[eè]ries primeres|commodit|\bETC\b/i.test(text)) return 'altres';
  if (/\bRV\b|renda variable|renta variable|equit|accions|acciones|stock|bolsa|small.?cap|dividend|reit|immobiliari|tecnolog|value/i.test(text)) return 'renda_variable';
  return undefined;
}

/** Estil de gestió deduït del nom (només quan és evident: indexat o ETF). */
function guessManagement(text: string): ManagementStyle | undefined {
  if (/\b(index|indexad[ao]|indexat|indexed|ETF|ETC|tracker|S&P 500 UCITS)\b/i.test(text)) return 'passiva';
  return undefined;
}

/** Classificació d'un fons per ISIN; si no és a la llista ni al catàleg, es dedueix del nom i la categoria. */
export function classifyFund(rawIsin: string, category = '', name = ''): FundClassification {
  let isin = (rawIsin ?? '').trim().toUpperCase();
  // Informes antics només guarden el nom del fons: es busca l'ISIN pel nom exacte.
  if (!isin && name.trim()) {
    const n = name.trim().toLowerCase();
    isin = ([...ADVISOR_FUNDS, ...ALTERNATE_CLASSES].find(f => f.name.toLowerCase() === n)?.isin
      ?? FINANCIAL_PRODUCTS.find(f => f.name.toLowerCase() === n)?.isin ?? '').toUpperCase();
  }
  const e = ADVISOR_CLASSIFICATION[isin];
  if (e) {
    const [management, assetType, eq, approx] = e;
    return { management, assetType, equityPct: eq ?? EQUITY_PCT[assetType], approx, source: 'llista' };
  }
  const p = FINANCIAL_PRODUCTS.find(f => f.isin?.toUpperCase() === isin);
  if (p) {
    const management: ManagementStyle = p.managementType === 'activa' ? 'activa' : 'passiva';
    const ac = String(p.assetClass);
    const assetType: AssetType =
      ac === 'monetari' ? 'monetari'
      : ac.startsWith('renda-fixa') ? 'renda_fixa'
      : ac === 'mixtos' ? 'mixt'
      : guessAssetType(`${p.category} ${p.name}`) ?? 'renda_variable';
    if (assetType === 'mixt') {
      const m = mixedEquityPct(`${p.category} ${p.name}`);
      return { management, assetType, equityPct: m.pct, approx: m.approx, source: 'catàleg' };
    }
    return { management, assetType, equityPct: EQUITY_PCT[assetType], source: 'catàleg' };
  }
  const text = `${category} ${name}`;
  const assetType = guessAssetType(text);
  const management = guessManagement(name) ?? guessManagement(category);
  if (assetType === 'mixt') {
    const m = mixedEquityPct(text);
    return { management, assetType, equityPct: m.pct, approx: m.approx, source: 'deduït' };
  }
  return { management, assetType, equityPct: assetType ? EQUITY_PCT[assetType] : 0, source: 'deduït' };
}

// ─── Etiquetes ────────────────────────────────────────────────────────────────

export const MANAGEMENT_LABEL: Record<ManagementStyle, string> = { activa: 'Gestió activa', passiva: 'Gestió passiva' };
export const ASSET_LABEL: Record<AssetType, string> = {
  renda_variable: 'Renda variable', renda_fixa: 'Renda fixa', monetari: 'Monetari', mixt: 'Mixt', altres: 'Altres',
};

/** Text curt de la classe d'actiu d'un fons, p. ex. "Mixt (aprox. 10 % RV)". */
export function assetTypeLabel(c: FundClassification): string {
  if (!c.assetType) return 'Sense classificar';
  if (c.assetType === 'mixt') return `Mixt (${c.approx ? 'aprox. ' : ''}${Math.round(c.equityPct)} % RV)`;
  return ASSET_LABEL[c.assetType];
}
export function managementLabel(c: FundClassification): string {
  return c.management ? MANAGEMENT_LABEL[c.management] : 'Sense classificar';
}

// ─── Repartiment de la cartera ────────────────────────────────────────────────

export interface AllocationBreakdown {
  active:       number;   // % de la cartera en fons de gestió activa
  passive:      number;
  unknownStyle: number;   // % en fons sense estil conegut
  equity:       number;   // % en renda variable (mixtos repartits pel seu % d'accions)
  fixedIncome:  number;   // % en renda fixa, monetari inclòs
  moneyMarket:  number;   // part monetària (ja inclosa a fixedIncome)
  other:        number;   // or, matèries primeres…
  unknownAsset: number;   // % en fons sense classe coneguda
  hasApprox:    boolean;  // algun mixt amb % d'accions aproximat
  hasMixed:     boolean;
}

/** Repartiment ponderat pel pes de cada fons (%). Els pesos es normalitzen a 100. */
export function allocationBreakdown(items: { isin: string; weight: number; category?: string; name?: string }[]): AllocationBreakdown {
  const out: AllocationBreakdown = { active: 0, passive: 0, unknownStyle: 0, equity: 0, fixedIncome: 0, moneyMarket: 0, other: 0, unknownAsset: 0, hasApprox: false, hasMixed: false };
  const total = items.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return out;
  for (const x of items) {
    const w = Math.max(0, x.weight || 0) / total * 100;
    if (!w) continue;
    const c = classifyFund(x.isin, x.category, x.name);
    if (c.management === 'activa') out.active += w;
    else if (c.management === 'passiva') out.passive += w;
    else out.unknownStyle += w;
    switch (c.assetType) {
      case 'renda_variable': out.equity += w; break;
      case 'renda_fixa':     out.fixedIncome += w; break;
      case 'monetari':       out.fixedIncome += w; out.moneyMarket += w; break;
      case 'mixt':
        out.hasMixed = true; if (c.approx) out.hasApprox = true;
        out.equity += w * c.equityPct / 100; out.fixedIncome += w * (100 - c.equityPct) / 100; break;
      case 'altres':         out.other += w; break;
      default:               out.unknownAsset += w;
    }
  }
  return out;
}

/** Nota curta que explica com s'han comptat els mixtos i el monetari (per als peus d'informe). */
export function allocationNote(b: AllocationBreakdown): string {
  const parts = ['Gestió passiva: fons indexats i ETF que repliquen un índex. Gestió activa: un gestor tria els valors.'];
  if (b.moneyMarket > 0) parts.push('El monetari es compta dins la renda fixa.');
  if (b.hasMixed) parts.push(`Els fons mixtos es reparteixen entre renda variable i fixa segons el seu % en accions${b.hasApprox ? ' (aproximat, segons la política del fons)' : ''}.`);
  if (b.unknownStyle > 0 || b.unknownAsset > 0) parts.push('«Sense classificar»: fons fora de la llista de l\'assessor sense dades per classificar-lo.');
  return parts.join(' ');
}

/** Tots els ISIN de la llista de l'assessor (per al test de cobertura). */
export const ADVISOR_ISINS = [...ADVISOR_FUNDS, ...ALTERNATE_CLASSES].map(f => f.isin);
