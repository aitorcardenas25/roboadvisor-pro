// lib/dashboardStats.ts — part pura: estadístiques reals del Dashboard de l'assessor.
// Substitueix les xifres de mostra ("Demo") que hi havia abans.
//  · Activitat mensual (últims N mesos): clients donats d'alta i propostes aprovades.
//  · Distribució per perfil: el perfil de l'última proposta aprovada de cada client.

import { PROFILES, type ProposalProfile } from './proposalMath';

export const PROFILE_NAMES: Record<ProposalProfile, string> = {
  conservador: 'Conservador', moderat: 'Moderat', dinamic: 'Dinàmic', agressiu: 'Agressiu',
};

export interface ActivityMonth { key: string; mes: string; clients: number; propostes: number }
export interface ProfileSlice  { profile: ProposalProfile; name: string; value: number }
export interface DashboardStats { activity: ActivityMonth[]; profiles: ProfileSlice[]; clientsWithProposal: number }

const MONTHS = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];

export function computeDashboardStats(
  clients:   { createdAt: string }[],
  proposals: { clientId: string; status: string; approvedAt?: string; version: number; profile: string }[],
  today = new Date().toISOString().slice(0, 10),
  months = 6,
): DashboardStats {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)) - 1;
  const activity: ActivityMonth[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    const key = d.toISOString().slice(0, 7);
    const yy = String(d.getUTCFullYear()).slice(2);
    activity.push({ key, mes: `${MONTHS[d.getUTCMonth()]} ${yy}`, clients: 0, propostes: 0 });
  }
  const byKey = new Map(activity.map(a => [a.key, a]));
  for (const c of clients) { const a = byKey.get((c.createdAt ?? '').slice(0, 7)); if (a) a.clients++; }

  const approved = proposals.filter(p => p.status === 'approved');
  for (const p of approved) { const a = byKey.get((p.approvedAt ?? '').slice(0, 7)); if (a) a.propostes++; }

  // Perfil vigent de cada client = el de la seva última versió aprovada.
  const latest = new Map<string, { version: number; profile: string }>();
  for (const p of approved) {
    const cur = latest.get(p.clientId);
    if (!cur || cur.version < p.version) latest.set(p.clientId, { version: p.version, profile: p.profile });
  }
  const count = new Map<string, number>();
  for (const { profile } of latest.values()) count.set(profile, (count.get(profile) ?? 0) + 1);
  const profiles = PROFILES
    .map(profile => ({ profile, name: PROFILE_NAMES[profile], value: count.get(profile) ?? 0 }))
    .filter(s => s.value > 0);

  return { activity, profiles, clientsWithProposal: latest.size };
}
