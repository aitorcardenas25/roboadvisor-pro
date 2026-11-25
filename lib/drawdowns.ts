// lib/drawdowns.ts — caigudes històriques d'un fons (part pura, sense BD).
// Petició de l'Aitor (2026-11-25): per a clients conservadors, mostrar la
// caiguda màxima de cada fons i les 3 caigudes més grans de la seva història,
// amb dades 100 % reals.
//
// Regles:
// - Només els valors liquidatius oficials desats a fund_navs. Cap mes inventat
//   ni interpolat: si en falta algun, es diu.
// - Es fa servir l'últim preu de cada mes (la major part de l'historial és
//   mensual). Així totes les caigudes es mesuren igual, però una caiguda que
//   es recupera dins el mateix mes no es veu: les xifres poden quedar curtes.
// - Una caiguda que va començar abans del primer preu desat no es pot veure.
//
// Mètode: caiguda des d'un màxim previ (drawdown; Magdon-Ismail & Atiya, 2004).
// Un episodi comença quan el preu baixa d'un màxim, té el seu mínim, i acaba
// quan el preu torna a arribar (o superar) aquell màxim. Els episodis no es
// solapen: cada un és una caiguda diferent.

import { monthEndSeries, fmtDate, suspectMoves, MAX_MOVE_PCT, type NavPoint } from './navMath';

/** Caigudes més petites que aquesta (en %) no es compten com a episodi. */
export const MIN_EPISODE_PCT = 0.5;
/** Quants episodis es mostren. */
export const TOP_EPISODES = 3;
/** Amb menys anys d'historial es fa un avís explícit. */
export const SHORT_HISTORY_YEARS = 3;
/** Si l'historial comença després d'aquesta data, no inclou la caiguda del 2022. */
export const Y2022_START = '2022-01';

export const DRAWDOWN_DISCLAIMER =
  'Caigudes calculades amb els valors liquidatius oficials del fons desats a Factor OTC, amb el preu de final de cada mes: ' +
  'la caiguda real dins un mes pot haver estat més gran. Només inclouen el període amb dades indicat per a cada fons; ' +
  'crisis anteriors (per exemple 2008 o març de 2020) no hi són si el període comença després. ' +
  'Rendibilitats i caigudes passades no garanteixen resultats futurs: un fons pot caure més del que ha caigut fins ara.';

export interface DrawdownEpisode {
  peakDate:        string;          // últim preu de mes al màxim
  peakNav:         number;
  troughDate:      string;
  troughNav:       number;
  depthPct:        number;          // negatiu, %
  monthsToTrough:  number;          // mesos del màxim al mínim
  recoveryDate:    string | null;   // primer mes que torna al màxim (null = encara no)
  monthsToRecover: number | null;   // mesos del mínim a la recuperació
  currentPct:      number | null;   // si no s'ha recuperat: on és ara respecte del màxim, %
}

export interface FundDrawdowns {
  isin:          string;
  name:          string;
  currency:      string | null;
  windowStart:   string | null;   // primer preu fet servir
  windowEnd:     string | null;   // últim preu fet servir
  years:         number;
  monthlyPoints: number;
  missingMonths: string[];        // aaaa-mm sense preu dins el període
  maxDrawdown:   number | null;   // = episodes[0].depthPct, o 0 si no ha caigut mai
  episodes:      DrawdownEpisode[];
  warnings:      string[];        // avisos en llenguatge planer
}

const r2 = (x: number) => Math.round(x * 100) / 100;
function monthIndex(iso: string): number { const [y, m] = iso.slice(0, 7).split('-').map(Number); return y * 12 + (m - 1); }
function ymOf(t: number): string { return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }

/**
 * Tots els episodis de caiguda d'una sèrie (de més a menys profund).
 * `series` ha d'estar ordenada per data; s'hi fa servir tal qual.
 */
export function drawdownEpisodes(series: { date: string; nav: number }[], minPct = MIN_EPISODE_PCT): DrawdownEpisode[] {
  const out: DrawdownEpisode[] = [];
  if (series.length < 2) return out;
  let peak = series[0];
  let cur: { trough: { date: string; nav: number } } | null = null;
  const close = (recovery: { date: string } | null, last: { nav: number }) => {
    if (!cur) return;
    const depth = (cur.trough.nav / peak.nav - 1) * 100;
    if (-depth >= minPct) {
      out.push({
        peakDate: peak.date, peakNav: peak.nav, troughDate: cur.trough.date, troughNav: cur.trough.nav,
        depthPct: r2(depth),
        monthsToTrough: monthIndex(cur.trough.date) - monthIndex(peak.date),
        recoveryDate: recovery?.date ?? null,
        monthsToRecover: recovery ? monthIndex(recovery.date) - monthIndex(cur.trough.date) : null,
        currentPct: recovery ? null : r2((last.nav / peak.nav - 1) * 100),
      });
    }
    cur = null;
  };
  for (const p of series.slice(1)) {
    if (p.nav >= peak.nav) { close(p, p); peak = p; continue; }
    if (!cur || p.nav < cur.trough.nav) cur = { trough: p };
  }
  close(null, series.at(-1)!);
  return out.sort((a, b) => a.depthPct - b.depthPct);
}

/** Classes de distribució pel nom (Dist, Inc, LD, "(div)"). */
export function looksLikeDistributionClass(name: string): boolean {
  return /\b(dist|distributing|inc|income dist)\b|\(div\)|\bLD\b/i.test(name) && !/\bacc\b/i.test(name);
}

/**
 * Caiguda màxima i les 3 caigudes més grans d'un fons, amb l'últim preu de cada mes.
 * `opts.distribution`: classe que reparteix dividends i el preu desat no els inclou.
 */
export function computeFundDrawdowns(
  meta: { isin: string; name: string; currency?: string | null },
  points: Pick<NavPoint, 'date' | 'nav'>[],
  opts: { distribution?: boolean } = {},
): FundDrawdowns {
  const monthly = monthEndSeries(points.filter(p => p.nav > 0));
  const base: FundDrawdowns = {
    isin: meta.isin, name: meta.name, currency: meta.currency ?? null,
    windowStart: monthly[0]?.date ?? null, windowEnd: monthly.at(-1)?.date ?? null,
    years: 0, monthlyPoints: monthly.length, missingMonths: [], maxDrawdown: null, episodes: [], warnings: [],
  };
  if (monthly.length < 2) {
    base.warnings.push(monthly.length ? 'Només hi ha un preu desat: no es pot calcular cap caiguda.' : 'No hi ha preus oficials desats d\'aquest fons.');
    return base;
  }
  // Validació (AGENTS.md: cap sèrie arriba als càlculs sense validar). Un salt de
  // més del MAX_MOVE_PCT % entre dos preus seguits gairebé sempre és un error
  // d'entrada: no es publica cap caiguda fins que es corregeix.
  const suspect = suspectMoves(points);
  if (suspect.length) {
    const j = suspect[0];
    base.warnings.push(`Preu sospitós el ${fmtDate(j.date)} (${j.change > 0 ? '+' : ''}${j.change.toLocaleString('ca-ES')} % d'un preu al següent, més del ${MAX_MOVE_PCT} %). No es mostren caigudes fins que es revisi.`);
    return base;
  }
  const first = monthIndex(monthly[0].date), last = monthIndex(monthly.at(-1)!.date);
  const have = new Set(monthly.map(p => monthIndex(p.date)));
  for (let t = first + 1; t < last; t++) if (!have.has(t)) base.missingMonths.push(ymOf(t));
  const years = r2((last - first) / 12);

  const all = drawdownEpisodes(monthly);
  const warnings: string[] = [];
  if (years < SHORT_HISTORY_YEARS) {
    warnings.push(`Historial curt: només ${years.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} anys de preus. Aquestes caigudes diuen poc del risc real del fons.`);
  }
  if (monthly[0].date.slice(0, 7) > Y2022_START) {
    warnings.push(`Les dades comencen el ${fmtDate(monthly[0].date)}: no inclouen la caiguda general de borsa i bons del 2022.`);
  }
  if (base.missingMonths.length) {
    warnings.push(`Falten preus de ${base.missingMonths.length} ${base.missingMonths.length === 1 ? 'mes' : 'mesos'} dins el període: no s'han omplert i alguna caiguda pot quedar curta.`);
  }
  if (opts.distribution) {
    warnings.push('Classe de distribució: el preu baixa quan paga dividend, i aquí no es compta el dividend. Les caigudes poden semblar una mica més grans que les reals.');
  }
  return {
    ...base, years, warnings,
    maxDrawdown: all.length ? all[0].depthPct : 0,
    episodes: all.slice(0, TOP_EPISODES),
  };
}

// ─── Text per mostrar ─────────────────────────────────────────────────────────

const MONTHS = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
/** "març 2020" a partir d'una data aaaa-mm-dd. */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function durationLabel(months: number): string {
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'mesos'}`;
  const y = Math.floor(months / 12), m = months % 12;
  const ys = `${y} ${y === 1 ? 'any' : 'anys'}`;
  return m ? `${ys} i ${m} ${m === 1 ? 'mes' : 'mesos'}` : ys;
}

/** "Va tardar 7 mesos" / "Encara no (ara està un -3,2 % per sota)". */
export function recoveryLabel(e: DrawdownEpisode): string {
  if (e.recoveryDate && e.monthsToRecover !== null) return `${durationLabel(e.monthsToRecover)} (${monthLabel(e.recoveryDate)})`;
  const now = e.currentPct === null ? '' : ` (ara un ${e.currentPct.toLocaleString('ca-ES', { maximumFractionDigits: 1 })} % per sota del màxim)`;
  return `Encara no s'ha recuperat${now}`;
}

/** Perfils per als quals l'informe inicial porta la pàgina de caigudes. */
export const DRAWDOWN_PROFILES = ['conservador', 'moderat'] as const;
export const showDrawdownsByDefault = (profile?: string | null) =>
  !!profile && (DRAWDOWN_PROFILES as readonly string[]).includes(profile);
