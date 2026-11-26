// Cartera proposada del client (fase C)
// GET  → versions + dades per a l'editor (fons disponibles, valors per defecte)
// PUT  → desa l'esborrany (crea versió nova si l'última està aprovada)
// POST → { action: 'approve', id } | { action: 'share', id } (el client el veu a partir d'aquí) | { action: 'suggest', profile, ... } | { action: 'fromHoldings' }
//        | { action: 'apply', id, date, amount, broker, dryRun? } (versió aprovada → cartera activa: primera inversió o reestructuració)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getLeadByLinkedUser, getLeadByEmail } from '@/lib/leads';
import { getPortfolioByClientId, computeMetrics } from '@/lib/clientPortfolios';
import {
  getProposals, saveDraft, approveProposal, shareProposal, fundOptions,
  itemsFromHoldings, verifiedPerformance, proposalStats, checkProposalSuitability, getProposal, PROFILES, type ProposalItem, type ProposalProfile, type NavPerformanceMap,
} from '@/lib/proposals';
import type { ClientProposal } from '@/lib/proposalMath';
import { PROFILE_MODELS, templateItems } from '@/lib/proposalTemplates';
import { saveReport } from '@/lib/reportRegistry';
import { sendReportReady } from '@/lib/emails';
import { logAuditEvent } from '@/lib/auditLog';
import { getNavPerformanceMap } from '@/lib/fundNavs';
import { applyProposal } from '@/lib/proposalApply';

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
  z.object({ action: z.literal('share'), id: z.string().min(1) }),   // envia l'informe inicial al client
  z.object({ action: z.literal('notify'), id: z.string().min(1) }),  // torna a enviar el correu d'avís (informe ja enviat)
  z.object({
    action: z.literal('apply'), id: z.string().min(1),
    date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.number().min(0).max(1e9),   // primera inversió: import; reestructuració: aportació nova (pot ser 0)
    broker: z.string().trim().max(100).default(''),
    dryRun: z.boolean().default(false),   // només calcula les operacions
    transfer: z.boolean().default(false), // reestructuració com a traspassos entre fons
  }),
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

  const navPerformance = await getNavPerformanceMap();
  return NextResponse.json({
    client:    { name: ctx.user.name, email: ctx.user.email },
    leadProfile: leadProfile ?? null,
    personal:  q,
    proposals: (await getProposals(id)).map(withStats),
    funds:     fundOptions(navPerformance),
    navPerformance,
    holdings:  ctx.portfolio?.holdings.filter(h => h.quantity > 0).length ?? 0,
    // Cartera actual (pes per valor de mercat) per comparar-ne la diversificació amb la proposta
    current:   (() => {
      const hs = (ctx.portfolio?.holdings ?? []).filter(h => h.quantity > 0 && h.currentPrice > 0);
      const total = hs.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
      return total > 0 ? hs.map(h => ({ isin: h.assetIsin, name: h.assetName, category: h.assetCategory, weight: h.quantity * h.currentPrice / total * 100 })) : [];
    })(),
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

  // Les dades de rendiment no es prenen del navegador: es tornen a buscar a
  // la font verificada (preus entrats a mà o fitxes) per ISIN.
  const navs = await getNavPerformanceMap();
  const items = parsed.data.items.map(x => ({ ...x, ...verifiedPerformance(x.isin, navs) }));
  const saved = await saveDraft(id, { ...parsed.data, items });
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
    return NextResponse.json({ items: itemsFromHoldings(ctx.portfolio?.holdings ?? [], await getNavPerformanceMap()) });
  }

  if (body.action === 'suggest') {
    return NextResponse.json({ items: suggestItems(body.profile, await getNavPerformanceMap()) });
  }

  if (body.action === 'share' || body.action === 'notify') {
    let proposal: ClientProposal;
    if (body.action === 'share') {
      const res = await shareProposal(id, body.id, session.user?.email ?? 'admin');
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
      proposal = res.proposal;
      logAuditEvent('proposal.shared', {
        userId: session.user?.id, userEmail: session.user?.email, resource: body.id,
        metadata: { clientId: id, version: proposal.version },
      });
    } else {
      const found = await getProposal(id, body.id);
      if (!found || found.status !== 'approved' || !found.sharedAt) {
        return NextResponse.json({ error: 'Aquest informe encara no s\'ha enviat al client' }, { status: 422 });
      }
      proposal = found;
    }
    // Avís per correu. L'informe ja és visible al portal encara que el correu falli.
    const mail = ctx.user.email
      ? await sendReportReady(ctx.user.email, ctx.user.name, ctx.user.username)
      : { success: false, error: 'El client no té correu' };
    logAuditEvent('email.report_ready', {
      userId: session.user?.id, userEmail: session.user?.email, resource: id,
      metadata: { ok: mail.success, error: mail.error, proposalId: body.id },
    });
    return NextResponse.json({ proposal: withStats(proposal), email: { sent: mail.success, error: mail.error } });
  }

  if (body.action === 'apply') {
    if (body.date > new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'La data de compra no pot ser futura' }, { status: 400 });
    const res = await applyProposal({
      clientId: id, clientName: ctx.user.name, proposalId: body.id, date: body.date,
      amount: body.amount, broker: body.broker, by: session.user?.email ?? 'admin', dryRun: body.dryRun, transfer: body.transfer,
    });
    if (!res.ok) return NextResponse.json({ error: res.error, problems: res.problems }, { status: res.status });
    if (!res.dryRun) logAuditEvent('proposal.applied', {
      userId: session.user?.id, userEmail: session.user?.email, resource: body.id,
      metadata: {
        clientId: id, portfolioId: res.portfolioId, mode: res.mode, operations: res.lines.length,
        amount: body.amount, date: body.date, valueBefore: res.currentValue, valueAfter: res.newValue,
      },
    });
    return NextResponse.json(res);
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

/**
 * Punt de partida segons perfil: la cartera tipus del perfil (lib/proposalTemplates),
 * amb fons que ja tenen valors liquidatius oficials. Abans es feia servir el
 * constructor antic (lib/portfolio.ts), que triava fons sense preus i la proposta
 * no es podia aprovar.
 */
function suggestItems(profile: ProposalProfile, navs: NavPerformanceMap = {}): ProposalItem[] {
  return templateItems(PROFILE_MODELS[profile], navs) ?? [];
}
