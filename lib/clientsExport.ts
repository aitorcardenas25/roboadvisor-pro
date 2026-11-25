// lib/clientsExport.ts
// Exportació de la base de dades de clients a Excel (només admin).
// Una fila per client amb les dades de l'Excel inicial, el pressupost calculat,
// el patrimoni, la proposta, els objectius i l'ús de la beta.
//
// Regles:
// - No s'inventa cap dada: si el client no l'ha donada, la cel·la queda buida.
// - Els càlculs (marge, taxa d'estalvi, fons d'emergència, diagnòstic) surten de
//   lib/budget.ts i lib/diagnosis.ts, els mateixos que veu el client a l'app.
// - Mode anonimitzat (per al TFG): sense nom, usuari, correu ni telèfon; edat en
//   franges; data d'alta només amb el mes. Amb pocs clients que es coneixen entre
//   ells, una fila encara pot identificar algú: al TFG s'han de publicar agregats.
// - Notes internes de l'assessor: no s'exporten.
import ExcelJS from 'exceljs';
import { analyzeBudget, pickFinanceFields, type BudgetInput } from './budget';
import { diagnose, type DiagnosisInput } from './diagnosis';
import { ADVISOR_STAGE_LABEL, type AdvisorStage } from './onboarding';
import type { ConsolidatedWealth } from './wealth';

export interface ExportGoal { horizon?: string; description?: string; amount?: number; targetYear?: number }

export interface ExportHolding {
  isin: string; name: string; broker: string; category: string;
  quantity: number; price: number; priceDate?: string; priceSource?: string;
}

export interface ExportClientInput {
  id:          string;
  name:        string;
  username:    string;
  email:       string;
  active:      boolean;
  createdAt:   string;
  phone?:      string | null;
  questionnaire?: Record<string, unknown> | null;
  stage?:      AdvisorStage;
  consentAt?:  string | null;
  surveyOptIn?: boolean | null;
  usage?:      { lastSeen: string | null; daysActive30: number; minutes30: number; logins30: number } | null;
  wealth?:     ConsolidatedWealth | null;
  /** Totes les versions de proposta (qualsevol ordre) */
  proposals:   { version: number; status: 'draft' | 'approved'; profile: string; horizon: number }[];
  holdings:    ExportHolding[];
}

export interface ExportOptions { anonymize?: boolean; now?: Date }

type Cell = string | number | null;
interface Col { key: string; header: string; width: number; fmt?: string; group: string; help: string }

const EUR = '#,##0 €';
const PCT = '0.0" %"';
const DATE = 'dd/mm/yyyy';

// Ordre = ordre de les columnes a l'Excel. `group` agrupa les columnes a la pestanya "Llegeix-me".
export const CLIENT_COLUMNS: Col[] = [
  { key: 'client',     header: 'Client',                    width: 26, group: 'Identificació', help: 'Nom (o "Client 01" a la versió anonimitzada).' },
  { key: 'username',   header: 'Usuari',                    width: 18, group: 'Identificació', help: 'Usuari per entrar al portal.' },
  { key: 'email',      header: 'Correu',                    width: 28, group: 'Identificació', help: 'Correu electrònic.' },
  { key: 'phone',      header: 'Telèfon',                   width: 14, group: 'Identificació', help: 'Només si el va deixar al formulari d\'accés.' },
  { key: 'createdAt',  header: 'Data d\'alta',              width: 12, fmt: DATE, group: 'Identificació', help: 'Quan es va crear el compte.' },
  { key: 'active',     header: 'Actiu',                     width: 7,  group: 'Identificació', help: 'Sí = pot entrar al portal.' },

  { key: 'alertsN',    header: 'Nombre d\'alertes',         width: 10, group: 'Alertes', help: 'Quants senyals d\'alerta té el client. Ordena per aquesta columna per veure primer els més delicats.' },
  { key: 'alerts',     header: 'Senyals d\'alerta',          width: 60, group: 'Alertes', help: 'Regles fixes i explicades (no és cap model): marge negatiu, estalvi < 10 %, fons d\'emergència < 50 %, deute de consum, quotes > 35 % dels ingressos, persones a càrrec sense coixí complet, ingressos que baixaran, perfil incoherent amb la reacció a una caiguda.' },

  { key: 'stage',      header: 'Pas de l\'alta',            width: 34, group: 'Seguiment', help: 'Dades → proposta → informe enviat → cartera activa. Serveix per saber qui s\'ha encallat.' },
  { key: 'lastSeen',   header: 'Darrer accés',              width: 12, fmt: DATE, group: 'Seguiment', help: 'Darrer dia que va entrar a l\'app.' },
  { key: 'days30',     header: 'Dies actius (30 d)',        width: 11, group: 'Seguiment', help: 'Dies diferents que ha entrat els darrers 30 dies. La mètrica clau de la beta.' },
  { key: 'minutes30',  header: 'Minuts connectat (30 d)',   width: 12, group: 'Seguiment', help: 'Minuts amb l\'app oberta i visible els darrers 30 dies.' },
  { key: 'logins30',   header: 'Entrades (30 d)',           width: 10, group: 'Seguiment', help: 'Inicis de sessió els darrers 30 dies.' },

  { key: 'consentAt',  header: 'Consentiment beta',         width: 12, fmt: DATE, group: 'Consentiment', help: 'Data en què va acceptar el text de protecció de dades de la beta. Buit = no l\'ha acceptat.' },
  { key: 'survey',     header: 'Accepta l\'enquesta',       width: 10, group: 'Consentiment', help: 'Sí = va marcar la casella opcional de l\'enquesta mensual.' },
  { key: 'newsletter', header: 'Pot rebre newsletter',      width: 22, group: 'Consentiment', help: 'Sempre NO: el consentiment actual no cobreix una newsletter. Cal una casella separada.' },

  { key: 'age',        header: 'Edat',                      width: 8,  group: 'Perfil', help: 'De l\'Excel inicial. A la versió anonimitzada, en franges.' },
  { key: 'employment', header: 'Situació laboral',          width: 14, group: 'Perfil', help: 'Indefinit, temporal, autònom o sense feina.' },
  { key: 'dependents', header: 'Persones a càrrec',         width: 10, group: 'Perfil', help: 'Fills o familiars que en depenen.' },
  { key: 'selfRisk',   header: 'Perfil que diu tenir',      width: 13, group: 'Perfil', help: 'Com es veu ell mateix invertint (autodeclarat).' },
  { key: 'knowledge',  header: 'Coneixement financer',      width: 12, group: 'Perfil', help: 'Autodeclarat: bàsic, mitjà o alt.' },
  { key: 'experience', header: 'Experiència invertint',     width: 14, group: 'Perfil', help: 'Quant temps fa que inverteix (Excel v3).' },
  { key: 'drawdown',   header: 'Si baixa un 20 %',          width: 14, group: 'Perfil', help: 'Què faria si les inversions baixessin un 20 % en un any (Excel v3). Diu més del risc real que "Perfil que diu tenir".' },
  { key: 'housing',    header: 'Habitatge',                 width: 16, group: 'Perfil', help: 'Lloguer, hipoteca, pagat o amb la família (Excel v3).' },
  { key: 'outlook',    header: 'Ingressos pròxims 2 anys',  width: 12, group: 'Perfil', help: 'Si creu que pujaran, igual o baixaran (Excel v3).' },
  { key: 'advisor',    header: 'Qui li porta els estalvis', width: 13, group: 'Perfil', help: 'Ningú, ell mateix, el banc o un assessor (Excel v3). Útil comercialment.' },

  { key: 'income',     header: 'Ingressos nets/mes',        width: 13, fmt: EUR, group: 'Pressupost', help: 'Ingressos nets mensuals.' },
  { key: 'fixed',      header: 'Despeses fixes/mes',        width: 13, fmt: EUR, group: 'Pressupost', help: 'Lloguer, factures, menjar.' },
  { key: 'variable',   header: 'Despeses variables/mes',    width: 13, fmt: EUR, group: 'Pressupost', help: 'Oci, roba, imprevistos.' },
  { key: 'debtPay',    header: 'Quotes de deutes/mes',      width: 13, fmt: EUR, group: 'Pressupost', help: 'Hipoteca, préstecs, targetes.' },
  { key: 'margin',     header: 'Marge lliure/mes',          width: 13, fmt: EUR, group: 'Pressupost', help: 'Calculat: ingressos − despeses − quotes. Negatiu = gasta més del que ingressa.' },
  { key: 'savingsRate',header: 'Taxa d\'estalvi',           width: 10, fmt: PCT, group: 'Pressupost', help: 'Calculat: marge lliure / ingressos nets. Referència ≥ 20 %.' },
  { key: 'consumerDebt', header: 'Deute de consum',         width: 13, fmt: EUR, group: 'Pressupost', help: 'Préstecs personals, cotxe i targetes, sense hipoteca (Excel v3). El deute més car.' },
  { key: 'investable', header: 'Podria invertir/mes',       width: 13, fmt: EUR, group: 'Pressupost', help: 'El que diu que podria invertir cada mes (Excel v3). Compara-ho amb el marge lliure calculat.' },
  { key: 'savings',    header: 'Estalvi en efectiu',        width: 13, fmt: EUR, group: 'Pressupost', help: 'Diners que ja té estalviats.' },
  { key: 'emTarget',   header: 'Fons d\'emergència objectiu', width: 14, fmt: EUR, group: 'Pressupost', help: 'Calculat: 6 mesos de despeses (12 si és temporal, autònom o sense feina).' },
  { key: 'emPct',      header: 'Fons d\'emergència cobert', width: 12, fmt: PCT, group: 'Pressupost', help: 'Calculat: estalvi / objectiu.' },
  { key: 'diagStatus', header: 'Diagnòstic',                width: 12, group: 'Pressupost', help: 'Semàfor de l\'app: Cal actuar / En camí / Bé / Falten dades.' },
  { key: 'diagText',   header: 'Diagnòstic (frase)',        width: 46, group: 'Pressupost', help: 'La frase que veu el client a l\'app.' },
  { key: 'missing',    header: 'Dades que falten',          width: 30, group: 'Pressupost', help: 'El que caldria demanar-li per completar la fitxa.' },

  { key: 'gross',      header: 'Patrimoni brut',            width: 13, fmt: EUR, group: 'Patrimoni', help: 'Calculat per l\'app: fons a preu oficial + comptes, immobles i altres declarats.' },
  { key: 'debt',       header: 'Deute total',               width: 12, fmt: EUR, group: 'Patrimoni', help: 'Deutes declarats.' },
  { key: 'netWorth',   header: 'Patrimoni net',             width: 13, fmt: EUR, group: 'Patrimoni', help: 'Patrimoni brut − deute.' },
  { key: 'invested',   header: 'Valor invertit (fons)',     width: 13, fmt: EUR, group: 'Patrimoni', help: 'Valor dels fons seguits a la plataforma, a preu oficial.' },
  { key: 'contributed',header: 'Diners aportats (fons)',    width: 13, fmt: EUR, group: 'Patrimoni', help: 'Aportacions − retirades als fons seguits.' },
  { key: 'twr',        header: 'Rendibilitat acumulada',    width: 11, fmt: PCT, group: 'Patrimoni', help: 'Rendibilitat real (time-weighted, Modified Dietz) des de la primera posició.' },
  { key: 'annual',     header: 'Rendibilitat anual',        width: 10, fmt: PCT, group: 'Patrimoni', help: 'La mateixa, anualitzada (només si fa més d\'un any).' },

  { key: 'propProfile',header: 'Perfil de la proposta',     width: 12, group: 'Proposta', help: 'Perfil de la darrera proposta. Compara\'l amb "Perfil que diu tenir".' },
  { key: 'propHorizon',header: 'Horitzó proposta (anys)',   width: 10, group: 'Proposta', help: 'Anys de la darrera proposta.' },
  { key: 'propStatus', header: 'Estat de la proposta',      width: 12, group: 'Proposta', help: 'Esborrany o aprovada (darrera versió).' },
  { key: 'propVersions',header: 'Versions de proposta',     width: 10, group: 'Proposta', help: 'Quantes versions n\'hi ha hagut (reestructuracions).' },

  { key: 'goalsN',     header: 'Nombre d\'objectius',       width: 10, group: 'Objectius', help: 'Detall a la pestanya "Objectius".' },
  { key: 'goalNext',   header: 'Objectiu més proper',       width: 30, group: 'Objectius', help: 'L\'objectiu amb import i any més proper.' },
  { key: 'goalNextAmt',header: 'Import objectiu proper',    width: 13, fmt: EUR, group: 'Objectius', help: 'Import d\'aquest objectiu.' },
  { key: 'goalNextYr', header: 'Any objectiu proper',       width: 9,  group: 'Objectius', help: 'Any d\'aquest objectiu.' },

  { key: 'oldIncome',  header: 'Ingressos bruts anuals (Excel antic)', width: 14, fmt: EUR, group: 'Poc útil', help: 'Repeteix els ingressos nets, menys precís. Serveix poc.' },
  { key: 'oldExpenses',header: 'Despeses mensuals totals (Excel antic)', width: 14, fmt: EUR, group: 'Poc útil', help: 'Substituït per fixes + variables. Serveix poc.' },
  { key: 'declaredNW', header: 'Patrimoni net declarat',    width: 14, fmt: EUR, group: 'Poc útil', help: 'Estimació a ull del client. El calculat per l\'app és més fiable.' },
];

/** Columnes que s'eliminen a la versió anonimitzada */
const PERSONAL_KEYS = new Set(['username', 'email', 'phone']);

const EMPLOYMENT: Record<string, string> = { indefinit: 'Indefinit', temporal: 'Temporal', autonom: 'Autònom', 'sense-feina': 'Sense feina' };
const SELF_RISK: Record<string, string>  = { conservador: 'Conservador', equilibrat: 'Equilibrat', dinamic: 'Dinàmic' };
const KNOWLEDGE: Record<string, string>  = { basic: 'Bàsic', mitja: 'Mitjà', alt: 'Alt' };
const PROFILE: Record<string, string>    = { conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu' };
const DIAG: Record<string, string>       = { vermell: 'Cal actuar', ambre: 'En camí', verd: 'Bé', incomplet: 'Falten dades' };
const EXPERIENCE: Record<string, string> = { mai: 'Mai', 'menys-2': 'Menys de 2 anys', '2-5': 'De 2 a 5 anys', 'mes-5': 'Més de 5 anys' };
const DRAWDOWN: Record<string, string>   = { 'vendre-tot': 'Vendria tot', 'vendre-part': 'Vendria una part', mantenir: 'No faria res', 'comprar-mes': 'Compraria més' };
const HOUSING: Record<string, string>    = { lloguer: 'Lloguer', hipoteca: 'Hipoteca', propietat: 'Propi pagat', familia: 'Amb la família' };
const OUTLOOK: Record<string, string>    = { pujaran: 'Pujaran', igual: 'Igual', baixaran: 'Baixaran', 'no-ho-se': 'No ho sé' };
const ADVISOR: Record<string, string>    = { ningu: 'Ningú', jo: 'Ell mateix', banc: 'El banc', assessor: 'Un assessor' };
const HORIZON: Record<string, string>    = { curt: 'Curt (0-12 mesos)', mitja: 'Mitjà (1-5 anys)', llarg: 'Llarg (+5 anys)' };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const r2 = (n: number) => Math.round(n * 100) / 100;

export function ageBand(age: number): string {
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  return '65+';
}

/** Data ISO → Date a les 00:00 UTC (Excel la mostra com a data), o null. */
function toDate(iso: string | null | undefined, monthOnly = false): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), monthOnly ? 1 : d.getUTCDate()));
}

export function goalsOf(q: Record<string, unknown> | null | undefined): ExportGoal[] {
  const g = q?.goals;
  if (!Array.isArray(g)) return [];
  return g.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object').map(x => ({
    horizon: str(x.horizon) ?? undefined, description: str(x.description) ?? undefined,
    amount: num(x.amount) ?? undefined, targetYear: num(x.targetYear) ?? undefined,
  }));
}

/**
 * Senyals d'alerta d'un client, amb regles fixes i explicables (no és un model
 * de risc ni una recomanació). Referències: 50/30/20 i fons d'emergència de
 * lib/budget.ts; ràtio de deute 35 % (criteri habitual de solvència bancària).
 */
export function clientAlerts(q: Record<string, unknown> | null | undefined, proposalProfile?: string | null): string[] {
  const out: string[] = [];
  const qq = q ?? {};
  const b = analyzeBudget(pickFinanceFields(qq) as BudgetInput);
  const income = num(qq.monthlyNetIncome);
  if (b) {
    if (b.freeMargin <= 0) out.push('Gasta igual o més del que ingressa');
    else if (b.savingsRate < 10) out.push(`Estalvia menys del 10 % (${b.savingsRate} %)`);
    if (b.emergency.progressPct !== null && b.emergency.progressPct < 50) out.push(`Fons d'emergència per sota del 50 % (${b.emergency.progressPct} %)`);
  }
  const debtPay = num(qq.monthlyDebtPayments);
  if (income && debtPay !== null && debtPay / income > 0.35) out.push(`Quotes de deutes > 35 % dels ingressos (${Math.round(debtPay / income * 100)} %)`);
  const consumer = num(qq.consumerDebt);
  if (consumer !== null && consumer > 0) out.push(`Té deute de consum (${Math.round(consumer).toLocaleString('ca-ES')} €)`);
  const dependents = num(qq.dependents);
  if (dependents && dependents > 0 && b && b.emergency.progressPct !== null && b.emergency.progressPct < 100) out.push('Té persones a càrrec i el fons d\'emergència no és complet');
  if (qq.incomeOutlook === 'baixaran') out.push('Creu que els seus ingressos baixaran');
  const reaction = str(qq.drawdownReaction);
  const wantsRisk = qq.selfRiskProfile === 'dinamic' || proposalProfile === 'dinamic' || proposalProfile === 'agressiu';
  if (reaction === 'vendre-tot' && wantsRisk) out.push('Perfil dinàmic però vendria tot si baixa un 20 %');
  const exp = str(qq.investingExperience);
  if (exp === 'mai' && (proposalProfile === 'dinamic' || proposalProfile === 'agressiu')) out.push('Mai ha invertit i la proposta és dinàmica o agressiva');
  return out;
}

export interface ExportTables {
  columns:  Col[];
  clients:  Record<string, Cell | Date>[];
  goals:    Record<string, Cell>[];
  holdings: Record<string, Cell | Date>[];
}

/** Construeix les files (pur, sense BD): és el que es prova als tests. */
export function buildExportTables(inputs: ExportClientInput[], opts: ExportOptions = {}): ExportTables {
  const anon = !!opts.anonymize;
  const now = opts.now ?? new Date();
  // Ordre estable per data d'alta: "Client 01" és el primer que es va donar d'alta.
  const sorted = [...inputs].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const pad = String(sorted.length).length < 2 ? 2 : String(sorted.length).length;
  const label = (i: number, c: ExportClientInput) => (anon ? `Client ${String(i + 1).padStart(pad, '0')}` : c.name);
  const columns = anon ? CLIENT_COLUMNS.filter(c => !PERSONAL_KEYS.has(c.key)) : CLIENT_COLUMNS;

  const clients: ExportTables['clients'] = [];
  const goals: ExportTables['goals'] = [];
  const holdings: ExportTables['holdings'] = [];

  sorted.forEach((c, i) => {
    const q = c.questionnaire ?? {};
    const fin = pickFinanceFields(q);
    const budget = analyzeBudget(fin as BudgetInput);
    const diag = diagnose(fin as DiagnosisInput, now);
    const age = num(q.age);
    const latest = [...c.proposals].sort((a, b) => b.version - a.version)[0];
    const gs = goalsOf(q);
    const year = now.getUTCFullYear();
    const nextGoal = gs.filter(g => g.amount && g.targetYear && g.targetYear >= year)
      .sort((a, b) => a.targetYear! - b.targetYear!)[0];
    const w = c.wealth;
    const hasWealth = !!w && (w.groups.length > 0 || w.debts.length > 0);
    const inv = w?.investments ?? null;

    const alerts = clientAlerts(q, latest?.profile ?? null);
    const row: Record<string, Cell | Date> = {
      client: label(i, c),
      username: c.username, email: c.email, phone: c.phone ?? null,
      createdAt: toDate(c.createdAt, anon),
      active: c.active ? 'Sí' : 'No',

      alertsN: alerts.length,
      alerts: alerts.length ? alerts.join('; ') : null,
      stage: c.stage ? ADVISOR_STAGE_LABEL[c.stage] : null,
      lastSeen: toDate(c.usage?.lastSeen),
      days30: c.usage?.daysActive30 ?? 0,
      minutes30: c.usage?.minutes30 ?? 0,
      logins30: c.usage?.logins30 ?? 0,

      consentAt: toDate(c.consentAt),
      survey: c.consentAt ? (c.surveyOptIn ? 'Sí' : 'No') : null,
      newsletter: 'NO (falta consentiment)',

      age: age === null ? null : anon ? ageBand(age) : age,
      employment: EMPLOYMENT[str(q.employmentType) ?? ''] ?? str(q.employmentType),
      dependents: num(q.dependents),
      selfRisk: SELF_RISK[str(q.selfRiskProfile) ?? ''] ?? str(q.selfRiskProfile),
      knowledge: KNOWLEDGE[str(q.selfKnowledge) ?? ''] ?? str(q.selfKnowledge),
      experience: EXPERIENCE[str(q.investingExperience) ?? ''] ?? str(q.investingExperience),
      drawdown: DRAWDOWN[str(q.drawdownReaction) ?? ''] ?? str(q.drawdownReaction),
      housing: HOUSING[str(q.housing) ?? ''] ?? str(q.housing),
      outlook: OUTLOOK[str(q.incomeOutlook) ?? ''] ?? str(q.incomeOutlook),
      advisor: ADVISOR[str(q.currentAdvisor) ?? ''] ?? str(q.currentAdvisor),

      income: num(q.monthlyNetIncome),
      fixed: num(q.monthlyFixedExpenses),
      variable: num(q.monthlyVariableExpenses),
      debtPay: num(q.monthlyDebtPayments),
      margin: budget ? r2(budget.freeMargin) : null,
      savingsRate: budget ? budget.savingsRate : null,
      consumerDebt: num(q.consumerDebt),
      investable: num(q.monthlyInvestable),
      savings: num(q.currentSavings),
      emTarget: budget ? budget.emergency.targetAmount : null,
      emPct: budget?.emergency.progressPct ?? null,
      diagStatus: DIAG[diag.status],
      diagText: diag.headline,
      missing: diag.missing.length ? diag.missing.join(', ') : null,

      gross: hasWealth ? w!.grossAssets : null,
      debt: hasWealth ? w!.totalDebt : null,
      netWorth: hasWealth ? w!.netWorth : null,
      invested: inv ? inv.value : null,
      contributed: inv ? inv.netContributed : null,
      twr: inv?.twrPct ?? null,
      annual: inv?.annualPct ?? null,

      propProfile: latest ? PROFILE[latest.profile] ?? latest.profile : null,
      propHorizon: latest ? latest.horizon : null,
      propStatus: latest ? (latest.status === 'approved' ? 'Aprovada' : 'Esborrany') : null,
      propVersions: c.proposals.length,

      goalsN: gs.length,
      goalNext: nextGoal?.description ?? null,
      goalNextAmt: nextGoal?.amount ?? null,
      goalNextYr: nextGoal?.targetYear ?? null,

      oldIncome: num(q.annualIncome),
      oldExpenses: num(q.monthlyExpenses),
      declaredNW: num(q.netWorth),
    };
    if (anon) for (const k of PERSONAL_KEYS) delete row[k];
    clients.push(row);

    for (const g of gs) {
      goals.push({
        client: label(i, c),
        horizon: g.horizon ? HORIZON[g.horizon] ?? g.horizon : null,
        description: g.description ?? null,
        amount: g.amount ?? null,
        targetYear: g.targetYear ?? null,
        yearsLeft: g.targetYear ? g.targetYear - year : null,
      });
    }

    for (const h of c.holdings) {
      if (!(h.quantity > 0)) continue;
      const pending = h.priceSource === 'pending' || h.price === 0;
      holdings.push({
        client: label(i, c),
        isin: h.isin || null, name: h.name || null, broker: h.broker || null, category: h.category || null,
        quantity: h.quantity,
        price: pending ? null : h.price,
        value: pending ? null : r2(h.quantity * h.price),
        priceDate: pending ? null : toDate(h.priceDate),
        status: pending ? 'Pendent de preu' : 'Amb preu',
      });
    }
  });

  return { columns, clients, goals, holdings };
}

const GOAL_COLS: Col[] = [
  { key: 'client',      header: 'Client',              width: 26, group: '', help: '' },
  { key: 'horizon',     header: 'Termini',             width: 18, group: '', help: '' },
  { key: 'description', header: 'Què vol aconseguir',  width: 46, group: '', help: '' },
  { key: 'amount',      header: 'Import (€)',          width: 13, fmt: EUR, group: '', help: '' },
  { key: 'targetYear',  header: 'Any objectiu',        width: 10, group: '', help: '' },
  { key: 'yearsLeft',   header: 'Anys que falten',     width: 10, group: '', help: '' },
];

const HOLDING_COLS: Col[] = [
  { key: 'client',    header: 'Client',          width: 26, group: '', help: '' },
  { key: 'isin',      header: 'ISIN',            width: 15, group: '', help: '' },
  { key: 'name',      header: 'Fons',            width: 42, group: '', help: '' },
  { key: 'broker',    header: 'Entitat',         width: 18, group: '', help: '' },
  { key: 'category',  header: 'Categoria',       width: 20, group: '', help: '' },
  { key: 'quantity',  header: 'Participacions',  width: 13, fmt: '#,##0.0000', group: '', help: '' },
  { key: 'price',     header: 'Preu (€)',        width: 11, fmt: '#,##0.00', group: '', help: '' },
  { key: 'value',     header: 'Valor (€)',       width: 12, fmt: EUR, group: '', help: '' },
  { key: 'priceDate', header: 'Data del preu',   width: 12, fmt: DATE, group: '', help: '' },
  { key: 'status',    header: 'Estat',           width: 15, group: '', help: '' },
];

function addTable(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map(c => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  for (const r of rows) ws.addRow(r);
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.alignment = { vertical: 'middle', wrapText: true };
  h.height = 32;
  h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A33' } }; });
  ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

/** Excel complet: Llegeix-me · Clients · Objectius · Posicions. */
export async function buildClientsWorkbook(inputs: ExportClientInput[], opts: ExportOptions = {}): Promise<Buffer> {
  const now = opts.now ?? new Date();
  const anon = !!opts.anonymize;
  const t = buildExportTables(inputs, { ...opts, now });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FACTOR OTC';
  wb.created = now;

  const info = wb.addWorksheet('Llegeix-me');
  info.columns = [{ width: 30 }, { width: 100 }];
  const stamp = now.toLocaleString('ca-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' });
  const lines: [string, string][] = [
    [`FACTOR OTC · Base de dades de clients${anon ? ' (ANONIMITZADA)' : ''}`, ''],
    ['Generat', `${stamp} (hora de Madrid)`],
    ['Clients', String(t.clients.length)],
    ['', ''],
    ['DADES PERSONALS', 'Aquest fitxer conté dades financeres personals. No el comparteixis, no el pengis a carpetes compartides ni l\'enviïs per WhatsApp. Esborra\'l quan acabis.'],
    ['Newsletter', 'Cap client ha donat consentiment per rebre una newsletter. No facis servir aquests correus per a màrqueting fins que hi hagi una casella separada i l\'hagin marcada.'],
    ...(anon
      ? [['TFG', 'Versió sense nom, usuari, correu ni telèfon; edat en franges i alta només amb el mes. Amb pocs clients que es coneixen, una fila encara pot identificar algú: al TFG publica només mitjanes i percentatges, i revisa els textos lliures dels objectius.'] as [string, string]]
      : [['TFG', 'Per al TFG fes servir la versió anonimitzada (botó "Excel anonimitzat").'] as [string, string]]),
    ['No inclou', 'Notes internes de l\'assessor, contrasenyes, moviments un a un.'],
    ['Dades buides', 'Una cel·la buida vol dir que el client no ho ha indicat. No s\'ha estimat res.'],
    ['', ''],
    ['QUÈ VOL DIR CADA COLUMNA (pestanya Clients)', ''],
  ];
  for (const [a, b] of lines) info.addRow([a, b]);
  let group = '';
  for (const c of t.columns) {
    if (c.group !== group) { group = c.group; info.addRow([group]).font = { bold: true }; }
    info.addRow([c.header, c.help]);
  }
  info.getRow(1).font = { bold: true, size: 13 };
  for (const r of [5, 6]) info.getRow(r).font = { bold: true, color: { argb: 'FFB42318' } };
  info.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  addTable(wb, 'Clients', t.columns, t.clients);
  addTable(wb, 'Objectius', GOAL_COLS, t.goals);
  addTable(wb, 'Posicions', HOLDING_COLS, t.holdings);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function clientsExportFilename(now: Date, anonymize: boolean): string {
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
  return `FACTOR_OTC_clients_${day}${anonymize ? '_anonimitzat' : ''}.xlsx`;
}
