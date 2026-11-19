// lib/portfolioAlerts.ts — part pura (sense BD), usable també des del navegador.
// Avisos de revisió de la cartera REAL d'un client:
//  1) Desviació: el pes actual de cada fons respecte del pes objectiu de la
//     proposta aprovada (la que es va passar a la cartera o, si no, l'última).
//  2) Revisió: data de seguiment vençuda, o proposta aprovada fa més d'un any
//     (la idoneïtat MiFID II s'ha de revisar com a mínim anualment, art. 54.12
//     del Reglament Delegat (UE) 2017/565, quan es presta assessorament continu).

export const DRIFT_THRESHOLD_PP = 5;      // punts percentuals
export const ANNUAL_REVIEW_DAYS = 365;

export interface DriftHolding { assetIsin: string; assetName: string; quantity: number; currentPrice: number }
export interface DriftTarget  { isin: string; name: string; weight: number }

export interface DriftRow {
  isin:    string;
  name:    string;
  target:  number;   // % objectiu (0 si no és a la proposta)
  current: number;   // % actual segons el valor de mercat
  diff:    number;   // current − target, en punts percentuals
}

export interface DriftResult {
  rows:        DriftRow[];
  maxAbsDiff:  number;
  outOfBand:   DriftRow[];   // |diff| ≥ llindar
  totalValue:  number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeDrift(holdings: DriftHolding[], targets: DriftTarget[], threshold = DRIFT_THRESHOLD_PP): DriftResult {
  const value = new Map<string, { name: string; v: number }>();
  for (const h of holdings) {
    const k = h.assetIsin.toUpperCase();
    const v = Math.max(0, h.quantity * h.currentPrice);
    const prev = value.get(k);
    value.set(k, { name: prev?.name ?? h.assetName, v: (prev?.v ?? 0) + v });
  }
  const total = [...value.values()].reduce((s, x) => s + x.v, 0);
  const isins = new Set([...value.keys(), ...targets.filter(t => t.weight > 0).map(t => t.isin.toUpperCase())]);
  const rows: DriftRow[] = [...isins].map(isin => {
    const t = targets.find(x => x.isin.toUpperCase() === isin);
    const cur = total > 0 ? (value.get(isin)?.v ?? 0) / total * 100 : 0;
    const target = t?.weight ?? 0;
    return { isin, name: t?.name ?? value.get(isin)?.name ?? isin, target: r2(target), current: r2(cur), diff: r2(cur - target) };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const maxAbsDiff = rows.length ? Math.abs(rows[0].diff) : 0;
  return { rows, maxAbsDiff, outOfBand: rows.filter(r => Math.abs(r.diff) >= threshold), totalValue: r2(total) };
}

export type ReviewReason = 'followup_due' | 'annual_review' | 'no_followup';

export interface ReviewStatus { due: boolean; reasons: ReviewReason[]; detail: string[] }

const days = (from: string, to: string) => Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000);

export function reviewStatus(input: { nextFollowup?: string; lastApprovedAt?: string }, today = new Date().toISOString().slice(0, 10)): ReviewStatus {
  const reasons: ReviewReason[] = [];
  const detail: string[] = [];
  if (input.nextFollowup && input.nextFollowup.slice(0, 10) <= today) {
    reasons.push('followup_due');
    detail.push(`Seguiment previst el ${input.nextFollowup.slice(0, 10)}`);
  }
  if (!input.nextFollowup) { reasons.push('no_followup'); detail.push('Sense data de seguiment'); }
  if (input.lastApprovedAt && days(input.lastApprovedAt, today) > ANNUAL_REVIEW_DAYS) {
    reasons.push('annual_review');
    detail.push(`Proposta aprovada fa ${days(input.lastApprovedAt, today)} dies: cal revisar la idoneïtat`);
  }
  return { due: reasons.some(r => r !== 'no_followup'), reasons, detail };
}

// ─── Proposta objectiu a una data ─────────────────────────────────────────────

export interface TargetCandidate {
  version: number; status: string; approvedAt?: string; appliedAt?: string; appliedPortfolioId?: string;
}
export interface TargetTx { date: string; notes?: string }

const APPLY_NOTE_RE = /(?:Proposta|Reestructuració a la proposta) v(\d+)$/;

/**
 * Data en què una versió es va passar a la cartera: la de les seves operacions
 * (les notes acaben en "Proposta vN" o "Reestructuració a la proposta vN"),
 * no el dia que es va prémer el botó. Sense operacions, la data d'aplicació.
 */
export function effectiveApplyDate(version: number, txs: TargetTx[], appliedAt?: string): string | undefined {
  const dates = txs.filter(t => Number(APPLY_NOTE_RE.exec((t.notes ?? '').trim())?.[1]) === version).map(t => t.date.slice(0, 10)).sort();
  return dates[0] ?? appliedAt?.slice(0, 10);
}

/**
 * Proposta que feia d'objectiu d'una cartera en una data. Un informe d'octubre no
 * es pot comparar amb una proposta aprovada o passada a la cartera al novembre.
 * - Si alguna versió s'ha passat a aquesta cartera: l'última passada fins a la data
 *   (cap, si totes són posteriors).
 * - Si no se n'ha passat cap: l'última aprovada fins a la data.
 */
export function pickTargetAt<T extends TargetCandidate>(proposals: T[], portfolioId: string, txs: TargetTx[], asOf: string): T | null {
  const day = asOf.slice(0, 10);
  const approved = proposals.filter(p => p.status === 'approved');
  const applied = approved.filter(p => p.appliedPortfolioId === portfolioId && p.appliedAt)
    .map(p => ({ p, date: effectiveApplyDate(p.version, txs, p.appliedAt) ?? '' }));
  if (applied.length) {
    return applied.filter(a => a.date && a.date <= day)
      .sort((a, b) => b.date.localeCompare(a.date) || b.p.version - a.p.version)[0]?.p ?? null;
  }
  return approved.filter(p => (p.approvedAt ?? '').slice(0, 10) <= day && p.approvedAt)
    .sort((a, b) => b.version - a.version)[0] ?? null;
}
