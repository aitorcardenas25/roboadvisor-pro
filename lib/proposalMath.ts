// lib/proposalMath.ts — part pura (sense BD), usable també des del navegador.
// La persistència és a lib/proposals.ts.
// Cartera PROPOSADA d'un client (fase C). És el que l'assessor recomana
// comprar, separat de la cartera REAL (lib/clientPortfolios.ts), que és el que
// el client té. Cada proposta té versions: l'última pot ser un esborrany
// editable; quan s'aprova queda congelada i serveix per generar l'informe.
// Editar després d'aprovar crea una versió nova (reestructuració).

import { FINANCIAL_PRODUCTS } from './products';
import { ADVISOR_FUNDS } from './fundUniverse';
import type { ManualPortfolioInput } from './manualReport';

export type ProposalStatus = 'draft' | 'approved';
export const PROFILES = ['conservador', 'moderat', 'dinamic', 'agressiu'] as const;
export type ProposalProfile = typeof PROFILES[number];

export interface ProposalItem {
  isin:                  string;
  name:                  string;
  category:              string;
  weight:                number;   // 0–100
  risk:                  number;   // SRRI 1–7
  ter:                   number;   // % anual
  platform:              string;
  justification:         string;
  historicalReturn5Y?:   number;   // % anual, de la fitxa del fons
  historicalVolatility?: number;   // % anual, de la fitxa del fons
  performanceSource?:    string;   // d'on surten (p. ex. "Morningstar, 30/09/2026")
}

export interface ProposalParams {
  profile:       ProposalProfile;
  objective:     string;
  horizon:       number;   // anys
  initialAmount: number;   // €
  monthlyAmount: number;   // €
  adminNote:     string;
}

export interface ClientProposal extends ProposalParams {
  id:          string;
  clientId:    string;
  version:     number;
  status:      ProposalStatus;
  items:       ProposalItem[];
  createdAt:   string;
  updatedAt:   string;
  approvedAt?: string;
  approvedBy?: string;
  suitability?:         ProposalSuitability;  // resultat en el moment d'aprovar
  suitabilityOverride?: string;               // motiu si s'aprova tot i no ser idònia
}

// ─── Dades de rendiment ───────────────────────────────────────────────────────
// Decisió de l'assessor (2026-11-06): CAP rendiment estimat a partir del SRRI.
// Un fons sense rendibilitat i volatilitat reals (catàleg o fitxa Morningstar a
// lib/fundUniverse.ts) deixa la proposta sense projecció i no es pot aprovar.
// Les xifres de lib/products.ts són estimacions acadèmiques, no observacions:
// NO compten. Només compten les dades amb font (fitxa) de lib/fundUniverse.ts.
export const hasPerformanceData = (x: ProposalItem) =>
  Number.isFinite(x.historicalReturn5Y) && Number.isFinite(x.historicalVolatility) && !!x.performanceSource?.trim();

/** Dades de rendiment verificades per a un ISIN (només fitxes amb font). */
export function verifiedPerformance(rawIsin: string): Pick<ProposalItem, 'historicalReturn5Y' | 'historicalVolatility' | 'performanceSource'> {
  const a = ADVISOR_FUNDS.find(f => f.isin === rawIsin.trim().toUpperCase());
  if (a && Number.isFinite(a.return5Y) && Number.isFinite(a.volatility) && a.source?.trim()) {
    return { historicalReturn5Y: a.return5Y, historicalVolatility: a.volatility, performanceSource: a.source };
  }
  return { historicalReturn5Y: undefined, historicalVolatility: undefined, performanceSource: undefined };
}

function guessSrri(category: string): number {
  if (/monetari|money/i.test(category)) return 1;
  if (/fixa|bond|\bRF\b/i.test(category)) return 3;
  if (/mixt/i.test(category)) return 4;
  return 6; // renda variable per defecte (tots els fons de la llista de l'assessor)
}

/** Converteix un ISIN conegut en una línia de proposta amb les dades del catàleg. */
export function fundToItem(rawIsin: string, weight = 0): ProposalItem | null {
  const isin = rawIsin.trim().toUpperCase();
  const p = FINANCIAL_PRODUCTS.find(f => f.isin?.toUpperCase() === isin);
  if (p) {
    return {
      isin, name: p.name, category: p.category, weight,
      risk: p.mifidRiskIndicator ?? Math.min(7, Math.round(p.risk * 1.2)),
      ter: p.ter, platform: '', justification: p.justification,
      ...verifiedPerformance(isin), // les estimacions del catàleg no es fan servir
    };
  }
  const a = ADVISOR_FUNDS.find(f => f.isin === isin);
  if (a) {
    return {
      isin, name: a.name, category: a.category, weight,
      risk: a.srri ?? guessSrri(a.category), ter: a.ter ?? 0, platform: '', justification: '',
      ...verifiedPerformance(isin),
    };
  }
  return null;
}

/** Llista de fons que l'assessor pot triar: primer els seus, després el catàleg. */
export function fundOptions(): { isin: string; name: string; category: string; source: 'advisor' | 'catalog' }[] {
  const seen = new Set<string>();
  const out: { isin: string; name: string; category: string; source: 'advisor' | 'catalog' }[] = [];
  for (const f of ADVISOR_FUNDS) { seen.add(f.isin); out.push({ ...f, source: 'advisor' }); }
  for (const p of FINANCIAL_PRODUCTS) {
    const isin = p.isin?.toUpperCase();
    if (!isin || seen.has(isin)) continue;
    seen.add(isin);
    out.push({ isin, name: p.name, category: p.category, source: 'catalog' });
  }
  return out;
}

// ─── Mètriques de la proposta ─────────────────────────────────────────────────

export interface ProposalStats {
  totalWeight:      number;
  weightOk:         boolean;   // suma 100 % (±0,01)
  grossReturn:      number;   // % anual ponderat
  ter:              number;   // % anual ponderat
  netReturn:        number;   // brut − TER, mínim 0
  volatility:       number;   // % anual ponderat (sense diversificació: conservador)
  risk:             number;   // SRRI ponderat
  complete:         boolean;  // tots els fons tenen rendiment i volatilitat reals
  missing:          { isin: string; name: string }[];  // fons sense aquestes dades
  totalInvested:    number;   // aportat al final de l'horitzó
  p10: number; p50: number; p90: number;
  yearly: { year: number; invested: number; p10: number; p50: number; p90: number }[];
}

/** Valor futur d'una aportació inicial + mensual a interès compost mensual. */
export function projection(initial: number, monthly: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const fi = initial * Math.pow(1 + r, n);
  const fm = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return fi + fm;
}

/**
 * Mètriques ponderades de la proposta. Escenaris P10/P50/P90 amb la mateixa
 * regla que l'informe PDF (rendiment net ∓ 0,35 × volatilitat), perquè els
 * números de pantalla i d'informe coincideixin.
 */
export function proposalStats(p: Pick<ClientProposal, 'items' | 'horizon' | 'initialAmount' | 'monthlyAmount'>): ProposalStats {
  const w = (x: ProposalItem) => (x.weight || 0) / 100;
  // Rendiment i volatilitat només dels fons amb dades: si en falta algun,
  // complete = false i la UI / l'aprovació no fan servir aquestes xifres.
  const ret = (x: ProposalItem) => x.historicalReturn5Y ?? 0;
  const vol = (x: ProposalItem) => x.historicalVolatility ?? 0;
  const missing = p.items.filter(x => !hasPerformanceData(x)).map(x => ({ isin: x.isin, name: x.name || x.isin }));

  const totalWeight = p.items.reduce((s, x) => s + (x.weight || 0), 0);
  const grossReturn = p.items.reduce((s, x) => s + w(x) * ret(x), 0);
  const ter         = p.items.reduce((s, x) => s + w(x) * (x.ter || 0), 0);
  const volatility  = p.items.reduce((s, x) => s + w(x) * vol(x), 0);
  const risk        = p.items.reduce((s, x) => s + w(x) * x.risk, 0);
  const netReturn   = Math.max(0, grossReturn - ter);
  const r10 = Math.max(0.5, netReturn - volatility * 0.35);
  const r90 = netReturn + volatility * 0.35;

  const years = Math.max(0, Math.round(p.horizon));
  const yearly = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    invested: p.initialAmount + p.monthlyAmount * 12 * y,
    p10: projection(p.initialAmount, p.monthlyAmount, r10, y),
    p50: projection(p.initialAmount, p.monthlyAmount, netReturn, y),
    p90: projection(p.initialAmount, p.monthlyAmount, r90, y),
  }));
  const last = yearly[yearly.length - 1];

  return {
    totalWeight, weightOk: Math.abs(totalWeight - 100) < 0.01,
    grossReturn, ter, netReturn, volatility, risk,
    complete: missing.length === 0, missing,
    totalInvested: last.invested, p10: last.p10, p50: last.p50, p90: last.p90, yearly,
  };
}

/** Pesos actuals de la cartera real (per valor de mercat), per partir-ne. */
export function itemsFromHoldings(holdings: { assetIsin: string; assetName: string; assetCategory: string; broker: string; quantity: number; currentPrice: number }[]): ProposalItem[] {
  const total = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  if (total <= 0) return [];
  const byIsin = new Map<string, ProposalItem>();
  for (const h of holdings) {
    const value = h.quantity * h.currentPrice;
    const prev = byIsin.get(h.assetIsin);
    if (prev) { prev.weight += value / total * 100; continue; }
    const base = fundToItem(h.assetIsin) ?? {
      isin: h.assetIsin, name: h.assetName, category: h.assetCategory, weight: 0,
      risk: guessSrri(h.assetCategory), ter: 0, platform: '', justification: '',
    };
    byIsin.set(h.assetIsin, { ...base, name: h.assetName || base.name, platform: h.broker, weight: value / total * 100 });
  }
  return roundWeights([...byIsin.values()]);
}

/** Arrodoneix a enters mantenint la suma exactament a 100 (mètode del residu més gran). */
export function roundWeights(items: ProposalItem[]): ProposalItem[] {
  const total = items.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return items;
  const scaled = items.map(x => x.weight / total * 100);
  const floors = scaled.map(Math.floor);
  let rest = 100 - floors.reduce((s, x) => s + x, 0);
  const order = scaled.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) { if (rest <= 0) break; floors[i]++; rest--; }
  return items.map((x, i) => ({ ...x, weight: floors[i] }));
}

/** Dades per a l'informe PDF existent (ManualReportPDF). */
export function proposalToReportInput(
  p: ClientProposal,
  client: { name: string; email: string },
  personal: Record<string, unknown> = {},
): ManualPortfolioInput {
  const num = (k: string) => (typeof personal[k] === 'number' ? personal[k] as number : undefined);
  const annualIncome = num('annualIncome');
  return {
    clientName: client.name, clientEmail: client.email,
    investorProfile: p.profile, objective: p.objective, horizon: p.horizon,
    initialAmount: p.initialAmount, monthlyAmount: p.monthlyAmount,
    adminNote: p.adminNote,
    assets: p.items.map(x => ({
      name: x.name, isin: x.isin, ticker: x.isin, weight: x.weight, category: x.category,
      risk: x.risk, ter: x.ter, platform: x.platform, justification: x.justification,
      historicalReturn5Y: x.historicalReturn5Y, historicalVolatility: x.historicalVolatility,
    })),
    monthlyIncome:   annualIncome != null ? Math.round(annualIncome / 12) : undefined,
    monthlyExpenses: num('monthlyExpenses'),
    deutes:          num('totalDebt'),
    patrimoni:       num('netWorth'),
    fondEmergencia:  num('currentSavings'),
  };
}

export function validateForApproval(p: Pick<ClientProposal, 'items' | 'initialAmount' | 'monthlyAmount' | 'horizon'>): string | null {
  if (!p.items.length) return 'La proposta no té cap fons';
  const s = proposalStats(p);
  if (!s.complete) return `Falten rendibilitat i volatilitat reals de: ${s.missing.map(m => m.name).join(', ')}. Cal la fitxa (p. ex. Morningstar).`;
  if (!s.weightOk) return `Els pesos sumen ${s.totalWeight.toFixed(2)} %, han de sumar 100 %`;
  if (p.items.some(x => x.weight <= 0)) return 'Hi ha fons amb pes 0: treu-los o dona\'ls pes';
  if (new Set(p.items.map(x => x.isin)).size !== p.items.length) return 'Hi ha fons repetits';
  if (p.initialAmount <= 0 && p.monthlyAmount <= 0) return 'Cal un import inicial o una aportació mensual';
  if (p.horizon < 1) return 'L\'horitzó ha de ser d\'almenys 1 any';
  return null;
}


// ─── Idoneïtat (MiFID II, simplificada per a propostes en escala SRRI 1–7) ────
// Equivalent a lib/suitability.ts (que treballa amb productes del catàleg en
// escala 1–5) però aplicat a les línies de la proposta, que poden ser fons de
// fora del catàleg. Es comprova al servidor abans d'aprovar.

export type SuitabilityLevel = 'adequate' | 'borderline' | 'inadequate';
export interface ProposalSuitability {
  status: SuitabilityLevel;
  issues: { level: Exclude<SuitabilityLevel, 'adequate'>; message: string }[];
}

/** SRRI mitjà ponderat màxim per perfil. */
export const MAX_AVG_SRRI: Record<ProposalProfile, number> = { conservador: 3, moderat: 4.5, dinamic: 5.5, agressiu: 7 };
/** SRRI màxim d'un sol fons per perfil. */
export const MAX_FUND_SRRI: Record<ProposalProfile, number> = { conservador: 5, moderat: 6, dinamic: 7, agressiu: 7 };
const KNOWLEDGE: Record<string, number> = { cap: 0, basic: 1, intermedi: 2, 'avançat': 3, expert: 4 };
const PROFILE_LABEL: Record<string, string> = { conservador: 'conservador', moderat: 'moderat', dinamic: 'dinàmic', agressiu: 'agressiu' };

export function checkProposalSuitability(
  p: Pick<ClientProposal, 'items' | 'profile' | 'horizon'>,
  questionnaire: Record<string, unknown> = {},
  leadProfile?: string,
): ProposalSuitability {
  const issues: ProposalSuitability['issues'] = [];
  const weighted = p.items.reduce((s, x) => s + (x.weight || 0) / 100 * x.risk, 0);
  const label = PROFILE_LABEL[p.profile] ?? p.profile;

  if (weighted > MAX_AVG_SRRI[p.profile] + 1e-9) {
    issues.push({ level: 'inadequate', message: `Risc mitjà SRRI ${weighted.toFixed(1)} supera el màxim ${MAX_AVG_SRRI[p.profile]} per a perfil ${label}` });
  }
  for (const x of p.items) {
    if (x.weight > 0 && x.risk > MAX_FUND_SRRI[p.profile]) {
      issues.push({ level: 'inadequate', message: `${x.name || x.isin}: SRRI ${x.risk} massa alt per a perfil ${label} (màx. ${MAX_FUND_SRRI[p.profile]})` });
    }
  }
  const equityWeight = p.items.filter(x => x.risk >= 5).reduce((s, x) => s + (x.weight || 0), 0);
  if (p.horizon < 3 && equityWeight > 30) {
    issues.push({ level: 'inadequate', message: `Horitzó de ${p.horizon} anys massa curt per a un ${equityWeight.toFixed(0)} % en fons de risc alt (SRRI ≥ 5)` });
  }

  const hasQ = Object.keys(questionnaire).some(k => ['financialKnowledge', 'liquidityNeed', 'investmentHorizon'].includes(k));
  if (!hasQ) {
    issues.push({ level: 'borderline', message: 'El client no té qüestionari: no es pot comprovar coneixement ni necessitat de liquiditat' });
  } else {
    const k = KNOWLEDGE[String(questionnaire.financialKnowledge)] ?? 0;
    if (k < 2 && p.items.some(x => x.weight > 0 && x.risk >= 5)) {
      issues.push({ level: 'borderline', message: `Coneixement financer "${questionnaire.financialKnowledge ?? 'desconegut'}": cal explicar bé els fons de risc alt (SRRI ≥ 5)` });
    }
    const liq = String(questionnaire.liquidityNeed ?? '');
    if ((liq === 'necessito-ja' || liq === 'potser-6-mesos') && weighted >= 4) {
      issues.push({ level: 'inadequate', message: 'El client necessita liquiditat a curt termini i la cartera té risc mitjà o alt' });
    }
  }
  if (leadProfile && (PROFILES as readonly string[]).includes(leadProfile) && leadProfile !== p.profile) {
    issues.push({ level: 'borderline', message: `El perfil del qüestionari és ${PROFILE_LABEL[leadProfile]}, però la proposta és per a ${label}` });
  }

  const status: SuitabilityLevel = issues.some(i => i.level === 'inadequate') ? 'inadequate' : issues.length ? 'borderline' : 'adequate';
  return { status, issues };
}
