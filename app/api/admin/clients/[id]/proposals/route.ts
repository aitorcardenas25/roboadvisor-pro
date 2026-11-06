// Cartera proposada del client (fase C)
// GET  → versions + dades per a l'editor (fons disponibles, valors per defecte)
// PUT  → desa l'esborrany (crea versió nova si l'última està aprovada)
// POST → { action: 'approve', id } | { action: 'suggest', profile, ... } | { action: 'fromHoldings' }
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getLeadByLinkedUser, getLeadByEmail } from '@/lib/leads';
import { getPortfolioByClientId, computeMetrics } from '@/lib/clientPortfolios';
import {
  getProposals, saveDraft, approveProposal, fundOptions, fundToItem,
  itemsFromHoldings, roundWeights, proposalStats, checkProposalSuitability, getProposal, PROFILES, type ProposalItem, type ProposalProfile,
} from '@/lib/proposals';
import { buildPortfolio } from '@/lib/portfolio';
import type { InvestorQuestionnaire } from '@/lib/scoring';
import { saveReport } from '@/lib/reportRegistry';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; name?: string; role?: string } } | null;

const ItemSchema = z.object({
  isin:                 z.string().trim().min(1).max(20),
  name:                 z.string().trim().min(1).max(200),
  category:             z.string().trim().max(100).default(''),
  weight:               z.number().min(0).max(100),
  risk:                 z.number().int().min(1).max(7),
  ter:                  z.number().min(0).max(10),
  platform:             z.string().trim().max(100).default(''),
  justification:        z.string().trim().max(2000).default(''),
  historicalReturn5Y:   z.number().min(-100).max(100).optional(),
  historicalVolatility: z.number().min(0).max(200).optional(),
});

const ParamsSchema = z.object({
  profile:       z.enum(PROFILES),
  objective:     z.string().trim().max(200).default(''),
  horizon:       z.number().int().min(1).max(50),
  initialAmount: z.number().min(0).max(1e9),
  monthlyAmount: z.number().min(0).max(1e7),
  adminNote:     z.string().trim().max(5000).default(''),
});

const PutSchema = ParamsSchema.extend({ items: z.array(ItemSchema).max(40) });

const PostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'), id: z.string().min(1),
    expectedUpdatedAt: z.string().optional(),
    overrideReason: z.string().trim().max(1000).optional(),   // obligatori si no és idònia
  }),
  z.object({ action: z.literal('suggest'), profile: z.enum(PROFILES), initialAmount: z.number().min(0), monthlyAmount: z.number().min(0) }),
  z.object({ action: z.literal('fromHoldings') }),
]);

async function context(id: string) {
  const user = (await getAllUsers()).find(u => u.id === id) ?? null;
  if (!user) return null;
  const lead = await getLeadByLinkedUser(id) ?? await getLeadByEmail(user.email);
  const portfolio = await getPortfolioByClientId(id);
  return { user, lead, portfolio };
}

const withStats = <T extends Parameters<typeof proposalStats>[0]>(p: T) => ({ ...p, stats: proposalStats(p) });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const ctx = await context(id);
  if (!ctx) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  const q = (ctx.lead?.questionnaireData ?? {}) as Record<string, unknown>;
  const leadProfile = ctx.lead?.profile;
  const currentValue = ctx.portfolio ? computeMetrics(ctx.portfolio).currentValue : 0;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

  return NextResponse.json({
    client:    { name: ctx.user.name, email: ctx.user.email },
    leadProfile: leadProfile ?? null,
    personal:  q,
    proposals: (await getProposals(id)).map(withStats),
    funds:     fundOptions(),
    holdings:  ctx.portfolio?.holdings.length ?? 0,
    defaults: {
      profile:       (PROFILES as readonly string[]).includes(leadProfile ?? '') ? leadProfile : 'moderat',
      objective:     '',
      horizon:       n(q.investmentHorizon) ?? 10,
      initialAmount: Math.round(currentValue) || n(q.initialInvestment) || n(q.currentSavings) || 0,
      monthlyAmount: n(q.monthlyContribution) ?? 0,
      adminNote:     '',
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const ctx = await context(id);
  if (!ctx) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Dades no vàlides', issues: parsed.error.issues }, { status: 400 });

  const saved = await saveDraft(id, parsed.data);
  logAuditEvent('proposal.saved', {
    userId: session.user?.id, userEmail: session.user?.email, resource: saved.id,
    metadata: { clientId: id, version: saved.version, funds: saved.items.length },
  });
  return NextResponse.json({ proposal: withStats(saved) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const ctx = await context(id);
  if (!ctx) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Petició no vàlida' }, { status: 400 });
  const body = parsed.data;

  if (body.action === 'fromHoldings') {
    return NextResponse.json({ items: itemsFromHoldings(ctx.portfolio?.holdings ?? []) });
  }

  if (body.action === 'suggest') {
    return NextResponse.json({ items: suggestItems(body.profile, body.initialAmount, body.monthlyAmount, ctx.lead?.questionnaireData) });
  }

  // Idoneïtat (MiFID II) al servidor abans de congelar la recomanació
  const draft = await getProposal(id, body.id);
  if (!draft) return NextResponse.json({ error: 'Proposta no trobada' }, { status: 404 });
  const suitability = checkProposalSuitability(draft, ctx.lead?.questionnaireData ?? {}, ctx.lead?.profile);
  const overrideReason = body.overrideReason?.trim() || undefined;
  if (suitability.status === 'inadequate' && (!overrideReason || overrideReason.length < 10)) {
    return NextResponse.json({
      error: 'La proposta no és idònia per al client. Corregeix-la o escriu el motiu per aprovar-la igualment (mín. 10 caràcters).',
      suitability,
    }, { status: 422 });
  }

  const res = await approveProposal(id, body.id, session.user?.email ?? 'admin', {
    suitability, expectedUpdatedAt: body.expectedUpdatedAt,
    suitabilityOverride: suitability.status === 'inadequate' ? overrideReason : undefined,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  const p = res.proposal;

  // Registre d'informes: així surt a "Informes" del client i a l'admin
  await saveReport({
    clientName: ctx.user.name, clientEmail: ctx.user.email, profile: p.profile, score: 0,
    monthlyAmount: p.monthlyAmount, investable: p.initialAmount, horizon: p.horizon,
    portfolio: p.items.map(x => x.name), pdfGenerated: true, emailSent: false,
    date: new Date().toLocaleDateString('ca-ES'),
  }).catch(err => console.error('[proposals] no s\'ha pogut registrar l\'informe:', err instanceof Error ? err.message : err));

  logAuditEvent('proposal.approved', {
    userId: session.user?.id, userEmail: session.user?.email, resource: p.id,
    metadata: {
      clientId: id, version: p.version, funds: p.items.length,
      suitability: suitability.status, override: !!p.suitabilityOverride,
    },
  });
  return NextResponse.json({ proposal: withStats(p) });
}

/** Punt de partida segons perfil, amb el constructor de carteres existent. */
function suggestItems(profile: ProposalProfile, initialAmount: number, monthlyAmount: number, q?: Record<string, unknown>): ProposalItem[] {
  const questionnaire = {
    ...(q ?? {}),
    currentSavings: initialAmount, percentageToInvest: 100, monthlyContribution: monthlyAmount,
    esgPreference: (q?.esgPreference as string) ?? 'no-importa',
  } as unknown as InvestorQuestionnaire;
  const portfolio = buildPortfolio(profile, questionnaire);
  const items = portfolio.allocations.map(a => fundToItem(a.product.isin, a.weight) ?? {
    isin: a.product.isin, name: a.product.name, category: a.product.category, weight: a.weight,
    risk: a.product.mifidRiskIndicator ?? 4, ter: a.product.ter, platform: '', justification: a.rationale,
  }).map((it, i) => ({ ...it, justification: portfolio.allocations[i].rationale || it.justification }));
  return roundWeights(items);
}
