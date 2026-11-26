// lib/fundExposure.ts — part pura (sense BD), usable també des del navegador.
// Diversificació d'una cartera per regió, sector i mida d'empresa, i
// concentració (pes de les 10 primeres posicions de cada fons).
//
// Les dades de cada fons són a lib/fundExposureData.ts i surten de la fitxa
// oficial de la gestora (amb la data de la fitxa). No hi ha cap proveïdor de
// pagament: si un fons no té fitxa carregada surt com a «Sense dades», mai
// com una estimació inventada. No es calcula cap «puntuació de diversificació».
//
// Criteris (decisió 2026-11-26):
// - Regió, sector i mida es calculen sobre la PART EN RENDA VARIABLE de la
//   cartera (la renda fixa no té sector ni mida d'empresa). La classe d'actiu
//   ja surt a lib/fundClassification.ts.
// - Països agrupats en 7 regions. Corea del Sud, Taiwan, Xina, Índia… compten
//   com a emergents (classificació MSCI) encara que FTSE en tracti algun com a
//   desenvolupat. El que la fitxa no detalla (moltes només donen 10 països)
//   va a «Altres països (no detallat)».
// - Sectors: els 11 sectors GICS. Les fitxes amb ICB (FTSE) s'hi tradueixen.
// - Mida: «Grans i mitjanes» / «Petites». Per als fons indexats surt de la
//   definició de l'índex (MSCI World = grans i mitjanes; MSCI World Small Cap =
//   petites). Per als de gestió activa, només si la fitxa o el mandat del fons
//   ho diuen; si no, «Sense dades».
// - Empreses amb més pes: suma, per empresa, del pes que té al top-10 de cada
//   fons × pes del fons. És un MÍNIM (fora del top-10 no es veu).

import { FUND_EXPOSURE, EXPOSURE_ALIASES, type FundExposure } from './fundExposureData';
import { classifyFund } from './fundClassification';

export type Region = 'america_nord' | 'europa' | 'iberia' | 'japo' | 'pacific' | 'emergents' | 'altres';
export type Sector =
  | 'tecnologia' | 'financer' | 'salut' | 'industria' | 'consum_discrecional' | 'comunicacions'
  | 'consum_basic' | 'energia' | 'materials' | 'utilities' | 'immobiliari' | 'altres';
export type SizeBucket = 'gran' | 'petita';

export const REGION_LABEL: Record<Region, string> = {
  america_nord: 'EUA i Canadà', europa: 'Europa', iberia: 'Espanya i Portugal', japo: 'Japó',
  pacific: 'Austràlia, Hong Kong i Singapur', emergents: 'Emergents', altres: 'Altres països (no detallat)',
};
export const SECTOR_LABEL: Record<Sector, string> = {
  tecnologia: 'Tecnologia', financer: 'Financer', salut: 'Salut', industria: 'Indústria',
  consum_discrecional: 'Consum discrecional', comunicacions: 'Comunicacions', consum_basic: 'Consum bàsic',
  energia: 'Energia', materials: 'Materials', utilities: 'Electricitat, gas i aigua', immobiliari: 'Immobiliari',
  altres: 'Altres / no detallat',
};
export const SIZE_LABEL: Record<SizeBucket, string> = { gran: 'Grans i mitjanes', petita: 'Petites' };
export const REGIONS = Object.keys(REGION_LABEL) as Region[];
export const SECTORS = Object.keys(SECTOR_LABEL) as Sector[];
export const SIZES = Object.keys(SIZE_LABEL) as SizeBucket[];

// ─── Països → regió ───────────────────────────────────────────────────────────

const COUNTRY_REGION: Record<string, Region> = {};
const add = (r: Region, names: string) => names.split(',').forEach(n => { COUNTRY_REGION[norm(n)] = r; });
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
add('america_nord', 'United States,USA,US,Estados Unidos,EEUU,EE UU,Canada,North America,Norteamerica,America del Norte');
add('iberia', 'Spain,España,Espana,Portugal,Iberia');
add('europa', 'United Kingdom,UK,Reino Unido,France,Francia,Germany,Alemania,Switzerland,Suiza,Netherlands,Países Bajos,Holanda,Sweden,Suecia,Italy,Italia,Denmark,Dinamarca,Finland,Finlandia,Belgium,Bélgica,Norway,Noruega,Ireland,Irlanda,Austria,Luxembourg,Luxemburgo,Europe,Europa,Eurozone,Eurozona,Europe ex UK,Europa ex Reino Unido,Rest of Europe,Resto de Europa,Europe ex Euro,Zona Euro,Gran Bretaña,Faroe Islands,Jersey,Guernsey,Isle of Man');
add('japo', 'Japan,Japón,Japon');
add('pacific', 'Australia,Hong Kong,Singapore,Singapur,New Zealand,Nueva Zelanda,Pacific,Pacífico,Pacific ex Japan');
add('emergents', 'China,Taiwan,Korea,South Korea,Korea South,Korea (South),Corea,Corea del Sur,India,Brazil,Brasil,South Africa,Sudáfrica,Saudi Arabia,Arabia Saudí,Mexico,México,United Arab Emirates,UAE,Emiratos Árabes Unidos,Poland,Polonia,Indonesia,Thailand,Tailandia,Malaysia,Malasia,Chile,Turkey,Turquía,Qatar,Kuwait,Philippines,Filipinas,Greece,Grecia,Peru,Perú,Hungary,Hungría,Czech Republic,República Checa,Colombia,Egypt,Egipto,Argentina,Kazakhstan,Kazajistán,Vietnam,Emerging Markets,Emergentes,Mercados emergentes,Asia Emergente,Latin America,Latinoamérica,LATAM,Macau,Macao');
add('altres', 'Israel,Other,Others,Otros,Resto del mundo,Misceláneas,Miscelaneas,Misc,Resto,Rest,Cash,Liquidez,Bermuda,Cayman Islands');

/** Regió d'un país tal com surt a la fitxa (anglès o castellà). */
export function countryRegion(country: string): Region | undefined {
  return COUNTRY_REGION[norm(country)];
}

// ─── Sectors (GICS i ICB) ─────────────────────────────────────────────────────

const SECTOR_MAP: [RegExp, Sector][] = [
  // Categories pròpies de gestores que no són un sector (holdings, «TMT», «serveis»)
  // Categories pròpies de gestores que barregen sectors («Consumo», «Com. y Tec.»): no es poden repartir
  [/^(holding|holdings|tmt|tech\W*media\W*telecom|servicios|consumo|com\W*y\W*tec\W*)$/i, 'altres'],
  // Subsectors (Cobas): abans de «tecnolog» perquè «biotecnología» és salut
  [/farmac|biotec|pharma/i, 'salut'],
  [/information technology|^technology|tecnolog/i, 'tecnologia'],
  [/financ|finanz/i, 'financer'],
  [/health|salud|sanidad|salut/i, 'salut'],
  [/industr/i, 'industria'],
  [/consumer discretionary|consumo discrecional|consumo c[ií]clico|consumer cyclical|cyclical consumer/i, 'consum_discrecional'],
  [/communication|telecom|comunicaci/i, 'comunicacions'],
  [/consumer staples|consumo b[aá]sico|consumo no c[ií]clico|consumo estable|consumer defensive|defensive consumer/i, 'consum_basic'],
  [/energ|oil|petr[oó]le/i, 'energia'],
  [/materials|materiales|basic materials/i, 'materials'],
  [/utilit|servicios p[uú]blicos|suministros/i, 'utilities'],
  [/real estate|inmobiliari|immobiliari/i, 'immobiliari'],
  [/venta al por menor|retail|autom[oó]vil/i, 'consum_discrecional'],
  [/miner[ií]a|metales|papel/i, 'materials'],
  [/ingenier[ií]a|construcci[oó]n|transporte/i, 'industria'],
  [/^(other|others|otros|resto)$/i, 'altres'],
];
export function sectorKey(label: string): Sector | undefined {
  return SECTOR_MAP.find(([re]) => re.test(label))?.[1];
}

// ─── Fitxa d'un fons ──────────────────────────────────────────────────────────

/** Fitxa de diversificació d'un fons (o d'una altra classe del mateix fons). */
export function fundExposure(rawIsin: string): FundExposure | undefined {
  const isin = (rawIsin ?? '').trim().toUpperCase();
  return FUND_EXPOSURE[isin] ?? FUND_EXPOSURE[EXPOSURE_ALIASES[isin] ?? ''];
}

type Dist<K extends string> = Partial<Record<K, number>>;

/** Regions d'un fons en % de la seva part en accions (suma 100). */
export function fundRegions(e: FundExposure): Dist<Region> | undefined {
  if (!e.countries) return undefined;
  const out: Dist<Region> = {};
  let sum = 0;
  for (const [c, v] of Object.entries(e.countries)) {
    const r = countryRegion(c) ?? 'altres';
    out[r] = (out[r] ?? 0) + v; sum += v;
  }
  const base = e.basis ?? 100;   // 100 = % del fons; o la part en accions si la fitxa la dona
  if (sum < base) out.altres = (out.altres ?? 0) + (base - sum);
  return scale(out, 100 / Math.max(base, sum));
}

/** Sectors d'un fons en % de la seva part en accions (suma 100). El que la fitxa no detalla va a «altres». */
export function fundSectors(e: FundExposure): Dist<Sector> | undefined {
  if (!e.sectors) return undefined;
  const out: Dist<Sector> = {};
  let sum = 0;
  for (const [s, v] of Object.entries(e.sectors)) {
    const k = sectorKey(s);
    if (!k) continue;           // liquiditat, derivats… no són sector
    out[k] = (out[k] ?? 0) + v; sum += v;
  }
  if (sum <= 0) return undefined;
  // Fitxes completes (índexs) sumen ≈100 i es normalitzen; si en falta més
  // d'un 3 % respecte de la base, la resta es mostra com a no detallada.
  const base = e.basis ?? 100;
  if (base - sum > 3) out.altres = (out.altres ?? 0) + (base - sum);
  return scale(out, 100 / Math.max(base - sum > 3 ? base : sum, sum));
}

function scale<K extends string>(d: Dist<K>, f: number): Dist<K> {
  const o: Dist<K> = {};
  for (const k of Object.keys(d) as K[]) o[k] = (d[k] ?? 0) * f;
  return o;
}

// ─── Repartiment de la cartera ────────────────────────────────────────────────

export interface ExposureBreakdown {
  equity:        number;                      // % de la cartera en renda variable
  region:        Record<Region, number>;      // % de la part en renda variable
  regionMissing: number;                      // % de la RV sense dades de regió
  sector:        Record<Sector, number>;
  sectorMissing: number;
  size:          Record<SizeBucket, number>;
  sizeMissing:   number;
  top10:         number | null;               // pes mitjà del top-10 dels fons (ponderat), %
  top10Covered:  number;                      // % de la RV amb top-10 conegut
  companies:     { name: string; pct: number }[];   // % del TOTAL de la cartera (mínim)
  oldestAsOf?:   string;                      // fitxa més antiga que s'ha fet servir
  newestAsOf?:   string;
  missingFunds:  string[];                    // fons de RV sense cap fitxa carregada
}

const zero = <K extends string>(keys: K[]) => Object.fromEntries(keys.map(k => [k, 0])) as Record<K, number>;

/** Normalitza un nom d'empresa per sumar-la entre fons ("Apple Inc." = "Apple"). */
export function companyKey(name: string): string {
  const n = norm(name)
    .replace(/\b(inc|corp|corporation|co|company|ltd|limited|plc|sa|nv|ag|se|spa|ab|asa|as|oyj|holdings?|group|class [a-c]|cl [a-c]|ord|adr|reg|the)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return COMPANY_ALIAS[n] ?? n;
}
const COMPANY_ALIAS: Record<string, string> = {
  'tsmc': 'taiwan semiconductor manufacturing',
  'alphabet a': 'alphabet', 'alphabet c': 'alphabet', 'meta platforms a': 'meta platforms',
  'berkshire hathaway b': 'berkshire hathaway', 'samsung electronics pref': 'samsung electronics',
  'roche': 'roche', 'roche genussschein': 'roche', 'nestle': 'nestle',
  'banco santander': 'banco santander', 'santander': 'banco santander',
  'banco bilbao vizcaya argentaria': 'bbva', 'bbva': 'bbva',
};

export interface WeightedItem { isin: string; weight: number; category?: string; name?: string }

/** Diversificació ponderada pel pes de cada fons (pesos normalitzats a 100). */
export function exposureBreakdown(items: WeightedItem[]): ExposureBreakdown {
  const out: ExposureBreakdown = {
    equity: 0, region: zero(REGIONS), regionMissing: 0, sector: zero(SECTORS), sectorMissing: 0,
    size: zero(SIZES), sizeMissing: 0, top10: null, top10Covered: 0, companies: [], missingFunds: [],
  };
  const total = items.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return out;

  const companies = new Map<string, { name: string; pct: number }>();
  let eqTotal = 0, top10Sum = 0, top10W = 0;
  const rows: { eqW: number; e?: FundExposure; name: string }[] = [];
  for (const x of items) {
    const w = Math.max(0, x.weight || 0) / total * 100;
    if (!w) continue;
    const c = classifyFund(x.isin, x.category, x.name);
    const eqW = w * (c.assetType === 'renda_variable' ? 1 : c.assetType === 'mixt' ? c.equityPct / 100 : 0);
    if (eqW <= 0) continue;
    eqTotal += eqW;
    rows.push({ eqW, e: fundExposure(x.isin), name: x.name || x.isin });
  }
  out.equity = eqTotal;
  if (eqTotal <= 0) return out;

  const dates: string[] = [];
  for (const { eqW, e, name } of rows) {
    const share = eqW / eqTotal * 100;   // % de la part en RV
    if (!e) { out.missingFunds.push(name); out.regionMissing += share; out.sectorMissing += share; out.sizeMissing += share; continue; }
    dates.push(e.asOf);
    const reg = fundRegions(e);
    if (reg) for (const r of REGIONS) out.region[r] += share * (reg[r] ?? 0) / 100; else out.regionMissing += share;
    const sec = fundSectors(e);
    if (sec) for (const s of SECTORS) out.sector[s] += share * (sec[s] ?? 0) / 100; else out.sectorMissing += share;
    if (e.size) {
      const g = e.size.gran ?? 0, p = e.size.petita ?? 0, t = g + p;
      if (t > 0) { out.size.gran += share * g / t; out.size.petita += share * p / t; } else out.sizeMissing += share;
    } else out.sizeMissing += share;
    if (e.top10Total != null) { top10Sum += share * e.top10Total; top10W += share; }
    for (const h of e.top10 ?? []) {
      const k = companyKey(h.name);
      const prev = companies.get(k);
      const pct = eqW * h.pct / 100;   // % del total de la cartera
      if (prev) prev.pct += pct; else companies.set(k, { name: h.name, pct });
    }
  }
  out.top10 = top10W > 0 ? top10Sum / top10W : null;
  out.top10Covered = top10W;
  out.companies = [...companies.values()].sort((a, b) => b.pct - a.pct).slice(0, 10);
  dates.sort();
  out.oldestAsOf = dates[0];
  out.newestAsOf = dates[dates.length - 1];
  return out;
}

/** "a 31/10/2026" o "entre 30/06/2026 i 31/10/2026". */
export function asOfLabel(b: Pick<ExposureBreakdown, 'oldestAsOf' | 'newestAsOf'>): string {
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  if (!b.oldestAsOf || !b.newestAsOf) return '';
  return b.oldestAsOf === b.newestAsOf ? `a ${f(b.oldestAsOf)}` : `entre ${f(b.oldestAsOf)} i ${f(b.newestAsOf)}`;
}

/** Nota curta per als peus (com s'ha calculat i què falta). */
export function exposureNote(b: ExposureBreakdown): string {
  const parts = [
    `Regió, sector i mida sobre la part en renda variable (${Math.round(b.equity)} % de la cartera), segons la fitxa oficial de cada fons ${asOfLabel(b)}.`,
    'Les empreses amb més pes només compten el top-10 de cada fons: el pes real pot ser més alt.',
  ];
  if (b.missingFunds.length) parts.push(`Sense fitxa carregada: ${b.missingFunds.join(', ')}.`);
  return parts.join(' ');
}

// ─── Actualització trimestral ─────────────────────────────────────────────────

/** Dies a partir dels quals una fitxa es considera antiga (un trimestre + marge de publicació). */
export const EXPOSURE_STALE_DAYS = 120;

/** Fons amb fitxa de diversificació més antiga que EXPOSURE_STALE_DAYS. */
export function staleExposures(today = new Date()): { isin: string; name: string; asOf: string; days: number }[] {
  const out: { isin: string; name: string; asOf: string; days: number }[] = [];
  for (const [isin, e] of Object.entries(FUND_EXPOSURE)) {
    const days = Math.floor((today.getTime() - new Date(e.asOf + 'T00:00:00Z').getTime()) / 86_400_000);
    if (days > EXPOSURE_STALE_DAYS) out.push({ isin, name: e.fund, asOf: e.asOf, days });
  }
  return out.sort((a, b) => b.days - a.days);
}
