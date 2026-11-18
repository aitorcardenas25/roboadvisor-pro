// lib/wealth.ts
// Patrimoni consolidat del client: tot el que té (fons seguits amb preus
// oficials, comptes, dipòsits, plans de pensions, immobles...) menys el que deu,
// en una sola vista, amb la rendibilitat real de les inversions.
//
// Lògica pura: les rutes d'API fan l'autenticació i la persistència.
// Regla: no s'inventa cap dada. Els actius que no són fons seguits són valors
// declarats (pel client o per l'assessor) i sempre porten la data del valor.
import { z } from 'zod';
import { aggregatePeriods, type Valuation } from './portfolioValuation';

// ─── Tipus d'actius i deutes ─────────────────────────────────────────────────

export type WealthGroup = 'inversions' | 'liquiditat' | 'immobles' | 'altres';

export const ASSET_KINDS = {
  compte:   { label: 'Compte corrent o d\'estalvi',          group: 'liquiditat' },
  diposit:  { label: 'Dipòsit a termini',                     group: 'liquiditat' },
  fons:     { label: 'Fons, ETF o accions en una altra entitat', group: 'inversions' },
  pensions: { label: 'Pla de pensions o EPSV',                group: 'inversions' },
  cripto:   { label: 'Criptomonedes',                         group: 'inversions' },
  immoble:  { label: 'Habitatge o immoble',                   group: 'immobles' },
  altres:   { label: 'Altres (cotxe, or, préstec a un familiar...)', group: 'altres' },
} as const satisfies Record<string, { label: string; group: WealthGroup }>;
export type AssetKind = keyof typeof ASSET_KINDS;

export const DEBT_KINDS = {
  hipoteca: 'Hipoteca',
  prestec:  'Préstec personal o del cotxe',
  targeta:  'Targeta de crèdit',
  deute:    'Altres deutes',
} as const;
export type DebtKind = keyof typeof DEBT_KINDS;

export const GROUP_LABEL: Record<WealthGroup, string> = {
  inversions: 'Inversions',
  liquiditat: 'Liquiditat',
  immobles:   'Immobles',
  altres:     'Altres béns',
};

export interface WealthItem {
  id:        string;
  kind:      AssetKind | DebtKind;
  name:      string;
  entity:    string;          // banc, broker... ('' si no n'hi ha)
  value:     number;          // € (positiu; els deutes també, en positiu)
  asOf:      string;          // AAAA-MM-DD: data del valor
  addedBy:   'client' | 'admin';
  updatedAt: string;
}

const ALL_KINDS = [...Object.keys(ASSET_KINDS), ...Object.keys(DEBT_KINDS)] as [string, ...string[]];
const MAX_EUR = 100_000_000;
const MAX_ITEMS = 100;

export const WealthItemInputSchema = z.object({
  kind:   z.enum(ALL_KINDS),
  name:   z.string().trim().min(1, 'Posa-hi un nom').max(80),
  entity: z.string().trim().max(60).default(''),
  value:  z.number().finite().min(0, 'Ha de ser 0 o més').max(MAX_EUR, 'Import massa gran'),
  asOf:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no vàlida'),
}).strict();
export type WealthItemInput = z.infer<typeof WealthItemInputSchema>;

export const isDebtKind = (k: string): k is DebtKind => k in DEBT_KINDS;
export const kindLabel = (k: string) =>
  isDebtKind(k) ? DEBT_KINDS[k] : (ASSET_KINDS[k as AssetKind]?.label ?? 'Altres');

export function listItems(q: Record<string, unknown> | null | undefined): WealthItem[] {
  const raw = q?.wealthItems;
  return Array.isArray(raw) ? (raw as WealthItem[]).filter(x => x && typeof x.id === 'string') : [];
}

// ─── Altes, canvis i baixes (sobre lead.questionnaireData) ───────────────────

export function addItem(q: Record<string, unknown> | null | undefined, input: WealthItemInput, by: 'client' | 'admin', now = new Date()):
  { next: Record<string, unknown>; item: WealthItem } | { error: string } {
  const items = listItems(q);
  if (items.length >= MAX_ITEMS) return { error: `Màxim ${MAX_ITEMS} elements` };
  const item: WealthItem = {
    id: globalThis.crypto.randomUUID(), kind: input.kind as AssetKind | DebtKind,
    name: input.name, entity: input.entity ?? '', value: round2(input.value),
    asOf: input.asOf, addedBy: by, updatedAt: now.toISOString(),
  };
  return { next: { ...(q ?? {}), wealthItems: [...items, item] }, item };
}

export function updateItem(q: Record<string, unknown> | null | undefined, id: string, input: WealthItemInput, now = new Date()):
  Record<string, unknown> | null {
  const items = listItems(q);
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return null;
  const next = [...items];
  next[i] = { ...items[i], kind: input.kind as AssetKind | DebtKind, name: input.name, entity: input.entity ?? '',
    value: round2(input.value), asOf: input.asOf, updatedAt: now.toISOString() };
  return { ...(q ?? {}), wealthItems: next };
}

export function removeItem(q: Record<string, unknown> | null | undefined, id: string): Record<string, unknown> | null {
  const items = listItems(q);
  if (!items.some(x => x.id === id)) return null;
  return { ...(q ?? {}), wealthItems: items.filter(x => x.id !== id) };
}

// ─── Vista consolidada ───────────────────────────────────────────────────────

/** Posició d'un fons seguit (la cartera activa de la plataforma). */
export interface TrackedHolding {
  assetName:        string;
  assetIsin:        string;
  broker:           string;
  quantity:         number;
  currentPrice:     number;
  priceLastUpdated: string;
  priceSource?:     string;
}

export type LineSource = 'preus-oficials' | 'declarat-client' | 'declarat-assessor' | 'questionari';

export interface WealthLine {
  id?:     string;          // només els elements editables
  kind:    string;
  label:   string;          // què és (tipus)
  name:    string;
  entity:  string;
  value:   number;
  asOf:    string | null;
  source:  LineSource;
  stale:   boolean;         // valor de fa més de STALE_DAYS
}

export interface WealthGroupSummary { group: WealthGroup; label: string; value: number; pct: number; lines: WealthLine[] }
export interface EntitySummary { entity: string; value: number; pct: number }

export interface InvestmentReturn {
  /** Valor actual dels fons seguits */
  value:            number;
  /** Diners posats nets (aportacions − retirades) */
  netContributed:   number;
  /** Guany en € = valor − diners posats */
  /** null si la cartera no es pot valorar sencera (posicions pendents sense sèrie oficial) */
  gainEur:          number | null;
  /** Rendibilitat real: Modified Dietz encadenat mes a mes (time-weighted), % */
  twrPct:           number | null;
  /** La mateixa, anualitzada (només si fa més d'un any), % */
  annualPct:        number | null;
  /** Rendibilitat d'aquest any natural, % */
  ytdPct:           number | null;
  since:            string | null;
  priceDate:        string | null;
  /** 'navs' = sèrie de valors liquidatius oficials; 'simple' = només guany / aportat */
  method:           'navs' | 'simple';
  missing:          string[];
}

export interface ConsolidatedWealth {
  asOf:           string;
  grossAssets:    number;
  totalDebt:      number;
  netWorth:       number;
  groups:         WealthGroupSummary[];
  byEntity:       EntitySummary[];
  debts:          WealthLine[];
  investments:    InvestmentReturn | null;
  pendingHoldings: number;
  warnings:       string[];
  /** Patrimoni net que el client va declarar a l'Excel (per comparar), si n'hi ha */
  declaredNetWorth: number | null;
}

export const STALE_DAYS = 120;

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const days = (a: string, b: string) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86_400_000;

/**
 * Rendibilitat real de les inversions a partir de la sèrie mensual amb valors
 * liquidatius oficials. Cada mes es calcula amb Modified Dietz (Dietz, 1968),
 * que descompta les aportacions, i els mesos s'encadenen (time-weighted return,
 * GIPS): r = Π(1 + r_mes) − 1. Anualitzada: (1 + r)^(365/dies) − 1.
 */
export function investmentReturn(valuation: Valuation | null | undefined, simple: { value: number; netContributed: number }, today: string): InvestmentReturn {
  const base = {
    value: round2(simple.value), netContributed: round2(simple.netContributed),
    gainEur: round2(simple.value - simple.netContributed),
    missing: valuation?.missing ?? [],
  };
  const pts = valuation?.points ?? [];
  if (pts.length < 2) {
    return { ...base, twrPct: simple.netContributed > 0 ? round2((simple.value / simple.netContributed - 1) * 100) : null,
      annualPct: null, ytdPct: null, since: pts[0]?.date ?? null, priceDate: pts.at(-1)?.date ?? null, method: 'simple' };
  }
  const rows = aggregatePeriods(pts, 'month');
  let twr = 1, ytd = 1, anyYtd = false;
  const year = today.slice(0, 4);
  for (const r of rows) {
    if (r.periodReturn === null) continue;
    twr *= 1 + r.periodReturn / 100;
    if (r.date.slice(0, 4) === year) { ytd *= 1 + r.periodReturn / 100; anyYtd = true; }
  }
  const since = pts[0].date, last = pts.at(-1)!;
  const span = days(since, last.date);
  const annual = span > 365 && twr > 0 ? Math.pow(twr, 365 / span) - 1 : null;
  return {
    ...base,
    // Amb la sèrie oficial, el valor i les aportacions surten de l'últim punt amb preu
    value: round2(last.value), netContributed: round2(last.invested), gainEur: round2(last.value - last.invested),
    twrPct: round2((twr - 1) * 100), annualPct: annual === null ? null : round2(annual * 100),
    ytdPct: anyYtd ? round2((ytd - 1) * 100) : null,
    since, priceDate: last.date, method: 'navs',
  };
}

/**
 * Suma tot el patrimoni del client.
 *  - Fons seguits: participacions × últim valor liquidatiu (font: preus oficials).
 *  - Elements declarats (wealthItems): el valor entrat, amb la seva data.
 *  - Si no hi ha cap compte declarat, l'"estalvi en efectiu" de Les meves finances
 *    compta com a liquiditat (no se sumen tots dos, per no comptar-lo dues vegades).
 *  - Igual amb els deutes: si no n'hi ha cap de declarat, es fa servir el "deute
 *    total" de l'Excel.
 */
export function consolidateWealth(input: {
  holdings:      TrackedHolding[];
  netContributed: number;
  valuation?:    Valuation | null;
  questionnaire?: Record<string, unknown> | null;
  today?:        string;
}): ConsolidatedWealth {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const q = input.questionnaire ?? {};
  const items = listItems(q);
  const warnings: string[] = [];

  const isPending = (h: TrackedHolding) => h.priceSource === 'pending' || (h.currentPrice === 0 && h.quantity === 0);
  const tracked = input.holdings.filter(h => !isPending(h) && h.quantity > 0);
  const pendingHoldings = input.holdings.filter(isPending).length;

  const lines: (WealthLine & { group: WealthGroup })[] = tracked.map(h => ({
    kind: 'fons-seguit', label: 'Fons a la plataforma', name: h.assetName, entity: h.broker || 'Sense entitat',
    value: round2(h.quantity * h.currentPrice), asOf: h.priceLastUpdated ? h.priceLastUpdated.slice(0, 10) : null,
    source: 'preus-oficials', stale: false, group: 'inversions',
  }));

  const assetItems = items.filter(x => !isDebtKind(x.kind));
  const debtItems  = items.filter(x => isDebtKind(x.kind));
  const toLine = (x: WealthItem): WealthLine => ({
    id: x.id, kind: x.kind, label: kindLabel(x.kind), name: x.name, entity: x.entity || '',
    value: round2(x.value), asOf: x.asOf, source: x.addedBy === 'admin' ? 'declarat-assessor' : 'declarat-client',
    stale: days(x.asOf, today) > STALE_DAYS,
  });
  for (const x of assetItems) lines.push({ ...toLine(x), group: ASSET_KINDS[x.kind as AssetKind]?.group ?? 'altres' });

  const savings = num(q.currentSavings);
  if (!assetItems.some(x => x.kind === 'compte') && savings !== undefined && savings > 0) {
    lines.push({ kind: 'estalvi', label: 'Estalvi en efectiu', name: 'Estalvi declarat a Les meves finances', entity: '',
      value: round2(savings), asOf: null, source: 'questionari', stale: false, group: 'liquiditat' });
  }

  const debts: WealthLine[] = debtItems.map(toLine);
  const declaredDebt = num(q.totalDebt);
  if (!debts.length && declaredDebt !== undefined && declaredDebt > 0) {
    debts.push({ kind: 'deute', label: 'Deute total', name: 'Deute total declarat a l\'Excel', entity: '',
      value: round2(declaredDebt), asOf: null, source: 'questionari', stale: false });
  }

  const grossAssets = round2(lines.reduce((s, l) => s + l.value, 0));
  const totalDebt   = round2(debts.reduce((s, l) => s + l.value, 0));
  const pct = (v: number) => (grossAssets > 0 ? round2(v / grossAssets * 100) : 0);

  const groups: WealthGroupSummary[] = (Object.keys(GROUP_LABEL) as WealthGroup[])
    .map(g => {
      const ls = lines.filter(l => l.group === g).map(({ group: _g, ...l }) => l).sort((a, b) => b.value - a.value);
      const value = round2(ls.reduce((s, l) => s + l.value, 0));
      return { group: g, label: GROUP_LABEL[g], value, pct: pct(value), lines: ls };
    })
    .filter(g => g.lines.length > 0);

  const ent = new Map<string, number>();
  for (const l of lines) {
    const k = l.entity.trim() || (l.group === 'immobles' ? 'Immobles' : 'Sense entitat');
    ent.set(k, (ent.get(k) ?? 0) + l.value);
  }
  const byEntity = [...ent.entries()].map(([entity, value]) => ({ entity, value: round2(value), pct: pct(value) }))
    .sort((a, b) => b.value - a.value);

  const trackedValue = lines.filter(l => l.source === 'preus-oficials').reduce((s, l) => s + l.value, 0);
  let investments = tracked.length || input.valuation?.points.length
    ? investmentReturn(input.valuation, { value: trackedValue, netContributed: input.netContributed }, today)
    : null;
  // Sense sèrie oficial, les aportacions inclouen els diners de les posicions
  // pendents però el valor no: el guany sortiria com una pèrdua falsa. No es mostra.
  if (investments && investments.method === 'simple' && pendingHoldings > 0) {
    investments = { ...investments, gainEur: null, twrPct: null };
  }

  const stale = [...lines, ...debts].filter(l => l.stale);
  if (stale.length) warnings.push(`${stale.length} valor${stale.length > 1 ? 's' : ''} de fa més de ${Math.round(STALE_DAYS / 30)} mesos: convé actualitzar-${stale.length > 1 ? 'los' : 'lo'}.`);
  if (pendingHoldings) warnings.push(`${pendingHoldings} posició${pendingHoldings > 1 ? 'ns' : ''} pendent${pendingHoldings > 1 ? 's' : ''} de confirmar: encara no compta${pendingHoldings > 1 ? 'en' : ''} al total.`);
  if (investments?.missing.length) warnings.push(`Sense historial de preus oficials per a: ${investments.missing.join(', ')}. La rendibilitat es calcula de manera simplificada (guany sobre els diners posats).`);

  return {
    asOf: today, grossAssets, totalDebt, netWorth: round2(grossAssets - totalDebt),
    groups, byEntity, debts, investments, pendingHoldings, warnings,
    declaredNetWorth: num(q.netWorth) ?? null,
  };
}
