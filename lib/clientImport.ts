// lib/clientImport.ts
// Plantilla Excel per al client i lectura de la plantilla omplerta.
// Flux: l'admin descarrega la plantilla → el client l'omple → l'admin la puja a
// la fitxa del client → previsualització amb errors → confirmació.
//
// Regla: no s'inventa cap dada. Una fila amb errors no s'importa; una cel·la
// buida opcional es queda buida.

import ExcelJS from 'exceljs';
import { isValidIsin, lookupIsin } from './fundUniverse';
import type { OperationType } from './clientPortfolios';

export const TEMPLATE_VERSION = '2';

// ─── Definició de la plantilla ───────────────────────────────────────────────

export const PERSONAL_FIELDS = [
  { key: 'age',             label: 'Edat (anys)' },
  { key: 'annualIncome',    label: 'Ingressos bruts anuals (€)' },
  { key: 'monthlyExpenses', label: 'Despeses mensuals (€)' },
  { key: 'currentSavings',  label: 'Estalvis en efectiu (€)' },
  { key: 'netWorth',        label: 'Patrimoni net total (€)' },
  { key: 'totalDebt',       label: 'Deute total pendent (€)' },
  // v2 — pressupost mensual (fitxa del client de les sessions presencials, 2026)
  { key: 'monthlyNetIncome',        label: 'Ingressos nets mensuals (€)' },
  { key: 'monthlyFixedExpenses',    label: 'Despeses fixes al mes: lloguer, factures, menjar (€)' },
  { key: 'monthlyVariableExpenses', label: 'Despeses variables al mes: oci, roba, imprevistos (€)' },
  { key: 'monthlyDebtPayments',     label: 'Quotes de deutes al mes (€)' },
  { key: 'dependents',              label: 'Persones a càrrec (fills, familiars)' },
] as const;
export type PersonalKey = typeof PERSONAL_FIELDS[number]['key'];

/** Camps de resposta tancada (desplegable a l'Excel). Valor desat = codi intern. */
export const CHOICE_FIELDS = [
  { key: 'employmentType', label: 'Situació laboral',
    options: { 'Indefinit': 'indefinit', 'Temporal': 'temporal', 'Autònom': 'autonom', 'Sense feina': 'sense-feina' } },
  { key: 'selfRiskProfile', label: 'Com et veus invertint',
    options: { 'Conservador': 'conservador', 'Equilibrat': 'equilibrat', 'Dinàmic': 'dinamic' } },
  { key: 'selfKnowledge', label: 'Coneixement financer',
    options: { 'Bàsic': 'basic', 'Mitjà': 'mitja', 'Alt': 'alt' } },
] as const;
export type ChoiceKey = typeof CHOICE_FIELDS[number]['key'];

export type PersonalData = Partial<Record<PersonalKey, number>> & Partial<Record<ChoiceKey, string>>;

export type GoalHorizon = 'curt' | 'mitja' | 'llarg';
export interface ImportedGoal { horizon: GoalHorizon; description: string; amount?: number; targetYear?: number }

const GOAL_HORIZONS: { label: string; code: GoalHorizon }[] = [
  { label: 'Curt (0-12 mesos)', code: 'curt' },
  { label: 'Mitjà (1-5 anys)',  code: 'mitja' },
  { label: 'Llarg (+5 anys)',   code: 'llarg' },
];
const GOAL_COLS = ['Termini', 'Què vols aconseguir', 'Import aproximat (€)', 'Any objectiu'];

const HOLDING_COLS = ['ISIN', 'Nom del fons', 'Broker / entitat', 'Categoria', 'Participacions', 'Preu mitjà de compra (€)', 'Moneda', 'Notes'];
const TX_COLS      = ['Data', 'Tipus', 'ISIN', 'Nom', 'Participacions', 'Preu (€)', 'Import total (€)', 'Comissió (€)', 'Broker / entitat', 'Notes'];

const TX_TYPES: Record<string, OperationType> = {
  'compra': 'buy', 'venda': 'sell', 'aportació': 'deposit', 'aportacio': 'deposit',
  'retirada': 'withdrawal', 'rebalanceig': 'rebalance',
};

const SHEET = { info: 'Instruccions', personal: 'Dades personals', goals: 'Objectius', holdings: 'Posicions', tx: 'Moviments' };

export async function buildTemplate(clientName?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FACTOR OTC';
  wb.created = new Date();

  const gold = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9A84C' } } as const;
  const header = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: 'FF0D1F1A' } };
    r.eachCell(c => { c.fill = gold; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  // Instruccions
  const info = wb.addWorksheet(SHEET.info);
  info.columns = [{ width: 110 }];
  [
    `FACTOR OTC · Plantilla de dades del client${clientName ? ` · ${clientName}` : ''} · versió ${TEMPLATE_VERSION}`,
    '',
    '1. "Dades personals": omple la columna B. Si no saps un valor, deixa-ho en blanc.',
    '   Les preguntes amb desplegable (situació laboral, perfil, coneixement): tria una opció.',
    '   Si encara no inverteixes, n\'hi ha prou amb "Dades personals" i "Objectius": les altres pestanyes poden quedar buides.',
    '2. "Objectius": què vols aconseguir a curt, mitjà i llarg termini (p. ex. "fons d\'emergència", "entrada d\'un pis").',
    '3. "Posicions": una fila per cada fons o ETF que tens avui, a cada entitat (MyInvestor, Renta 4, banc...).',
    '   L\'ISIN és el codi de 12 caràcters que surt a l\'extracte (p. ex. IE00B42W4L06).',
    '4. "Moviments": cada compra, venda, aportació o retirada amb la seva data. Com més historial, més exacta serà la rendibilitat.',
    '   Format de data: dd/mm/aaaa. Tipus: Compra, Venda, Aportació, Retirada o Rebalanceig.',
    '5. No canviïs el nom de les pestanyes ni l\'ordre de les columnes.',
    '',
    'Aquestes dades són personals: torna el fitxer pel canal que t\'indiqui el teu assessor, no per xarxes socials.',
  ].forEach(t => info.addRow([t]));
  info.getRow(1).font = { bold: true, size: 13 };

  // Dades personals
  const per = wb.addWorksheet(SHEET.personal);
  per.columns = [{ header: 'Concepte', width: 52 }, { header: 'Valor', width: 18 }, { header: 'codi', width: 18 }];
  PERSONAL_FIELDS.forEach(f => { per.addRow([f.label, null, f.key]).getCell(2).numFmt = '#,##0'; });
  CHOICE_FIELDS.forEach(f => {
    const row = per.addRow([f.label, null, f.key]);
    row.getCell(2).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${Object.keys(f.options).join(',')}"`] };
  });
  per.getColumn(3).hidden = true;
  header(per);

  // Objectius (3 files amb el termini ja posat)
  const goals = wb.addWorksheet(SHEET.goals);
  goals.columns = GOAL_COLS.map((h, i) => ({ header: h, width: [20, 50, 20, 14][i] }));
  GOAL_HORIZONS.forEach(g => goals.addRow([g.label]));
  goals.getColumn(3).numFmt = '#,##0';
  header(goals);

  // Posicions
  const hol = wb.addWorksheet(SHEET.holdings);
  hol.columns = HOLDING_COLS.map((h, i) => ({ header: h, width: [16, 44, 20, 22, 15, 22, 10, 30][i] }));
  hol.getColumn(5).numFmt = '#,##0.0000';
  hol.getColumn(6).numFmt = '#,##0.00';
  header(hol);

  // Moviments
  const tx = wb.addWorksheet(SHEET.tx);
  tx.columns = TX_COLS.map((h, i) => ({ header: h, width: [13, 14, 16, 40, 15, 12, 16, 13, 20, 30][i] }));
  tx.getColumn(1).numFmt = 'dd/mm/yyyy';
  header(tx);
  for (let r = 2; r <= 500; r++) {
    tx.getCell(r, 2).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"Compra,Venda,Aportació,Retirada,Rebalanceig"'],
    };
    hol.getCell(r, 7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"EUR,USD,GBP,CHF"'] };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export interface ImportIssue { sheet: string; row: number; message: string }

export interface ImportedHolding {
  row: number; isin: string; name: string; broker: string; category: string;
  quantity: number; avgEntryPrice: number; currency: string; notes?: string;
  recognized: boolean;
}

export interface ImportedTransaction {
  row: number; date: string; operationType: OperationType; isin?: string; name?: string;
  quantity: number; priceEur: number; totalEur: number; commission: number;
  broker: string; notes?: string;
}

export interface ImportResult {
  personal:     PersonalData;
  goals:        ImportedGoal[];
  holdings:     ImportedHolding[];
  transactions: ImportedTransaction[];
  errors:       ImportIssue[];
  warnings:     ImportIssue[];
}

type Raw = ExcelJS.CellValue;

function plain(v: Raw): string | number | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if ('result' in v && v.result !== undefined) return plain(v.result as Raw);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return null;
}

function str(v: Raw): string {
  const p = plain(v);
  if (p === null) return '';
  if (p instanceof Date) return p.toISOString().slice(0, 10);
  return String(p).trim();
}

/** Accepta número o text amb format europeu ("1.234,56") o anglès ("1234.56"). */
export function parseNumber(v: Raw): number | null {
  const p = plain(v);
  if (p === null || p === '') return null;
  if (typeof p === 'number') return Number.isFinite(p) ? p : null;
  if (p instanceof Date) return null;
  let s = p.replace(/[€\s]/g, '');
  if (s === '') return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "2.000" = dos mil (format europeu)
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Data com a ISO yyyy-mm-dd. Accepta Date d'Excel, dd/mm/aaaa i aaaa-mm-dd. */
export function parseDate(v: Raw): string | null {
  const p = plain(v);
  if (p === null || p === '') return null;
  if (p instanceof Date) return isNaN(p.getTime()) ? null : p.toISOString().slice(0, 10);
  if (typeof p === 'number') {
    // Número de sèrie d'Excel (dies des de 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(p) * 86_400_000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = p.trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [, dd, mm, yy] = m.map(Number);
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    return d.getUTCDate() === dd && d.getUTCMonth() === mm - 1 ? d.toISOString().slice(0, 10) : null;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, yy, mm, dd] = m.map(Number);
    const d = new Date(Date.UTC(yy, mm - 1, dd));
    // JS normalitza 2024-02-31 a 2 de març: es rebutja si els components no quadren
    return d.getUTCFullYear() === yy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd ? s : null;
  }
  return null;
}

function rowEmpty(row: ExcelJS.Row, cols: number): boolean {
  for (let c = 1; c <= cols; c++) if (str(row.getCell(c).value) !== '') return false;
  return true;
}

export async function parseClientWorkbook(data: ArrayBuffer | Buffer): Promise<ImportResult> {
  const res: ImportResult = { personal: {}, goals: [], holdings: [], transactions: [], errors: [], warnings: [] };
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as ArrayBuffer);
  } catch {
    res.errors.push({ sheet: '—', row: 0, message: 'No és un fitxer Excel (.xlsx) vàlid.' });
    return res;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Dades personals
  const per = wb.getWorksheet(SHEET.personal);
  if (!per) res.warnings.push({ sheet: SHEET.personal, row: 0, message: 'Falta la pestanya; no s\'importen dades personals.' });
  else {
    per.eachRow((row, r) => {
      if (r === 1) return;
      const key = str(row.getCell(3).value);
      const label = str(row.getCell(1).value);
      const raw = row.getCell(2).value;
      const choice = CHOICE_FIELDS.find(f => f.key === key) ?? CHOICE_FIELDS.find(f => f.label === label);
      if (choice) {
        const v = str(raw);
        if (v === '') return;
        const code = Object.entries(choice.options).find(([l]) => l.toLowerCase() === v.toLowerCase())?.[1];
        if (!code) res.errors.push({ sheet: SHEET.personal, row: r, message: `"${choice.label}": tria una opció (${Object.keys(choice.options).join(', ')}).` });
        else res.personal[choice.key] = code;
        return;
      }
      const field = PERSONAL_FIELDS.find(f => f.key === key)
        ?? PERSONAL_FIELDS.find(f => f.label === label);
      if (!field) return;
      if (str(raw) === '') return;
      const n = parseNumber(raw);
      if (n === null || n < 0) res.errors.push({ sheet: SHEET.personal, row: r, message: `"${field.label}" ha de ser un número positiu.` });
      else res.personal[field.key] = n;
    });
  }

  // Objectius (opcional; les plantilles v1 no la tenen)
  const goalsWs = wb.getWorksheet(SHEET.goals);
  if (goalsWs) {
    const thisYear = new Date().getUTCFullYear();
    goalsWs.eachRow((row, r) => {
      if (r === 1) return;
      const description = str(row.getCell(2).value);
      const amountRaw = row.getCell(3).value;
      const yearRaw = row.getCell(4).value;
      if (!description && str(amountRaw) === '' && str(yearRaw) === '') return;   // només el termini pre-omplert
      const errs: string[] = [];
      const hLabel = str(row.getCell(1).value).toLowerCase();
      const horizon = GOAL_HORIZONS.find(g => g.label.toLowerCase() === hLabel || hLabel.startsWith(g.label.toLowerCase().split(' ')[0]))?.code;
      if (!horizon) errs.push('termini desconegut (Curt, Mitjà o Llarg)');
      if (!description) errs.push('falta descriure l\'objectiu');
      let amount: number | undefined;
      if (str(amountRaw) !== '') {
        const n = parseNumber(amountRaw);
        if (n === null || n <= 0) errs.push('l\'import ha de ser un número positiu'); else amount = n;
      }
      let targetYear: number | undefined;
      if (str(yearRaw) !== '') {
        const y = parseNumber(yearRaw);
        if (y === null || !Number.isInteger(y) || y < thisYear || y > thisYear + 60) errs.push('any objectiu no vàlid'); else targetYear = y;
      }
      if (errs.length) { res.errors.push({ sheet: SHEET.goals, row: r, message: errs.join('; ') }); return; }
      res.goals.push({ horizon: horizon!, description, amount, targetYear });
    });
  }

  // Posicions
  const hol = wb.getWorksheet(SHEET.holdings);
  if (!hol) res.errors.push({ sheet: SHEET.holdings, row: 0, message: 'Falta la pestanya "Posicions".' });
  else {
    hol.eachRow((row, r) => {
      if (r === 1 || rowEmpty(row, HOLDING_COLS.length)) return;
      const errs: string[] = [];
      const isin = str(row.getCell(1).value).toUpperCase().replace(/\s/g, '');
      if (!isValidIsin(isin)) errs.push(`ISIN "${isin || '(buit)'}" no vàlid`);
      const qty = parseNumber(row.getCell(5).value);
      if (qty === null || qty <= 0) errs.push('participacions han de ser > 0');
      const price = parseNumber(row.getCell(6).value);
      if (price === null || price <= 0) errs.push('preu mitjà ha de ser > 0');
      const broker = str(row.getCell(3).value);
      if (!broker) errs.push('falta el broker o entitat');
      if (errs.length) { res.errors.push({ sheet: SHEET.holdings, row: r, message: errs.join('; ') }); return; }

      const known = lookupIsin(isin);
      const name = str(row.getCell(2).value) || known?.name || isin;
      if (!known) res.warnings.push({ sheet: SHEET.holdings, row: r, message: `ISIN ${isin} no és al catàleg: s'importa, però sense fitxa de producte.` });
      res.holdings.push({
        row: r, isin, name, broker,
        category: str(row.getCell(4).value) || known?.category || 'Sense categoria',
        quantity: qty!, avgEntryPrice: price!,
        currency: (str(row.getCell(7).value) || 'EUR').toUpperCase(),
        notes: str(row.getCell(8).value) || undefined,
        recognized: !!known,
      });
    });
    const dup = new Map<string, number>();
    res.holdings.forEach(h => {
      const k = `${h.isin}|${h.broker.toLowerCase()}`;
      if (dup.has(k)) res.warnings.push({ sheet: SHEET.holdings, row: h.row, message: `${h.isin} a ${h.broker} ja surt a la fila ${dup.get(k)}.` });
      else dup.set(k, h.row);
    });
  }

  // Moviments
  const tx = wb.getWorksheet(SHEET.tx);
  if (!tx) res.warnings.push({ sheet: SHEET.tx, row: 0, message: 'Falta la pestanya; sense moviments no es pot calcular la rendibilitat real.' });
  else {
    tx.eachRow((row, r) => {
      if (r === 1 || rowEmpty(row, TX_COLS.length)) return;
      const errs: string[] = [];
      const date = parseDate(row.getCell(1).value);
      if (!date) errs.push('data no vàlida (dd/mm/aaaa)');
      else if (date > today) errs.push('data futura');
      const typeRaw = str(row.getCell(2).value).toLowerCase();
      const op = TX_TYPES[typeRaw];
      if (!op) errs.push(`tipus "${typeRaw || '(buit)'}" desconegut`);
      const isinRaw = str(row.getCell(3).value).toUpperCase().replace(/\s/g, '');
      const needsAsset = op === 'buy' || op === 'sell';
      if (needsAsset && !isValidIsin(isinRaw)) errs.push(`ISIN "${isinRaw || '(buit)'}" no vàlid`);
      if (!needsAsset && isinRaw && !isValidIsin(isinRaw)) errs.push(`ISIN "${isinRaw}" no vàlid`);

      // Cel·la buida = 0 / no informat; cel·la plena que no és un número = error
      const num = (c: number, label: string): number | null => {
        const raw = row.getCell(c).value;
        if (str(raw) === '') return null;
        const n = parseNumber(raw);
        if (n === null) errs.push(`${label} "${str(raw)}" no és un número`);
        return n;
      };
      const qty   = num(5, 'participacions') ?? 0;
      const price = num(6, 'preu') ?? 0;
      let total   = num(7, 'import total');
      const comm  = num(8, 'comissió') ?? 0;
      if (total === null && qty > 0 && price > 0) total = Math.round(qty * price * 100) / 100;
      if ((total === null || total <= 0) && !errs.some(e => e.startsWith('import total'))) errs.push('falta l\'import total (o participacions × preu)');
      if (needsAsset && qty <= 0) errs.push('participacions han de ser > 0');
      if (comm < 0) errs.push('comissió negativa');
      if (errs.length) { res.errors.push({ sheet: SHEET.tx, row: r, message: errs.join('; ') }); return; }

      res.transactions.push({
        row: r, date: date!, operationType: op!, isin: isinRaw || undefined,
        name: str(row.getCell(4).value) || (isinRaw ? lookupIsin(isinRaw)?.name : undefined),
        quantity: qty, priceEur: price, totalEur: total!, commission: comm,
        broker: str(row.getCell(9).value), notes: str(row.getCell(10).value) || undefined,
      });
    });
  }

  if (!res.holdings.length && !res.transactions.length && !res.goals.length && !Object.keys(res.personal).length && !res.errors.length)
    res.errors.push({ sheet: '—', row: 0, message: 'El fitxer no té cap dada omplerta.' });

  return res;
}
