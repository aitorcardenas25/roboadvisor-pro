import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getPortfolioById, deleteClientPortfolio, updatePortfolioMeta,
  addHolding, updateHolding, removeHolding, updateHoldingPrice,
  addTransaction, removeTransaction,
  addSnapshot, removeSnapshot,
  addAdvisorNote, updateAdvisorNote, removeAdvisorNote,
} from '@/lib/clientPortfolios';
import { fetchPriceBatch } from '@/lib/marketDataService';
import { z } from 'zod';

type S = { user?: { role?: string } } | null;
function isAdmin(s: S): boolean { return s?.user?.role === 'admin'; }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const portfolio = await getPortfolioById(id);
  if (!portfolio) return NextResponse.json({ error: 'No trobat' }, { status: 404 });
  return NextResponse.json({ portfolio });
}

const HoldingSchema = z.object({
  assetIsin:        z.string().default(''),
  assetName:        z.string().min(1).max(200),
  assetSymbol:      z.string().max(20).optional(),
  assetCategory:    z.string().min(1).max(100),
  broker:           z.string().min(1).max(100),
  quantity:         z.number().nonnegative(),
  avgEntryPrice:    z.number().nonnegative(),
  currentPrice:     z.number().nonnegative(),
  priceLastUpdated: z.string().default(() => new Date().toISOString().split('T')[0]),
  currency:         z.string().default('EUR'),
  notes:            z.string().max(500).optional(),
});

const TransactionSchema = z.object({
  holdingId:     z.string().optional(),
  operationType: z.enum(['buy', 'sell', 'deposit', 'withdrawal', 'rebalance']),
  ticker:        z.string().max(20).optional(),
  assetName:     z.string().max(200).optional(),
  date:          z.string(),
  quantity:      z.number().nonnegative(),
  priceEur:      z.number().nonnegative(),
  totalEur:      z.number().nonnegative(),
  commission:    z.number().nonnegative().default(0),
  broker:        z.string().default(''),
  notes:         z.string().max(500).optional(),
});

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update-meta'),         name: z.string().optional(), description: z.string().optional(), recommendations: z.string().optional(), nextFollowup: z.string().optional() }),
  z.object({ action: z.literal('add-holding'),         holding: HoldingSchema }),
  z.object({ action: z.literal('update-holding'),      holdingId: z.string(), holding: HoldingSchema.partial() }),
  z.object({ action: z.literal('remove-holding'),      holdingId: z.string() }),
  z.object({ action: z.literal('update-price'),        holdingId: z.string(), currentPrice: z.number().nonnegative() }),
  z.object({ action: z.literal('add-transaction'),     transaction: TransactionSchema }),
  z.object({ action: z.literal('remove-transaction'),  transactionId: z.string() }),
  z.object({ action: z.literal('add-snapshot'),        date: z.string(), totalValue: z.number().nonnegative(), notes: z.string().optional() }),
  z.object({ action: z.literal('remove-snapshot'),     snapshotId: z.string() }),
  z.object({ action: z.literal('add-advisor-note'),    text: z.string().min(1).max(2000), author: z.string().default('Admin Factor OTC'), isVisibleToClient: z.boolean().default(true) }),
  z.object({ action: z.literal('update-advisor-note'), noteId: z.string(), text: z.string().optional(), isVisibleToClient: z.boolean().optional() }),
  z.object({ action: z.literal('remove-advisor-note'), noteId: z.string() }),
  z.object({ action: z.literal('refresh-prices') }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const { id } = await params;
  const portfolio = await getPortfolioById(id);
  if (!portfolio) return NextResponse.json({ error: 'No trobat' }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invàlid' }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const op = parsed.data;

  switch (op.action) {
    case 'update-meta':
      return NextResponse.json({ portfolio: await updatePortfolioMeta(id, { name: op.name, description: op.description, recommendations: op.recommendations, nextFollowup: op.nextFollowup }) });
    case 'add-holding':
      return NextResponse.json({ holding: await addHolding(id, op.holding) });
    case 'update-holding':
      await updateHolding(op.holdingId, id, op.holding);
      return NextResponse.json({ ok: true });
    case 'remove-holding':
      await removeHolding(op.holdingId, id);
      return NextResponse.json({ ok: true });
    case 'update-price':
      await updateHoldingPrice(op.holdingId, id, op.currentPrice);
      return NextResponse.json({ ok: true });
    case 'add-transaction':
      return NextResponse.json({ transaction: await addTransaction(id, op.transaction) });
    case 'remove-transaction':
      await removeTransaction(op.transactionId, id);
      return NextResponse.json({ ok: true });
    case 'add-snapshot':
      return NextResponse.json({ snapshot: await addSnapshot(id, { date: op.date, totalValue: op.totalValue, notes: op.notes }) });
    case 'remove-snapshot':
      await removeSnapshot(op.snapshotId, id);
      return NextResponse.json({ ok: true });
    case 'add-advisor-note':
      return NextResponse.json({ note: await addAdvisorNote(id, { text: op.text, author: op.author, isVisibleToClient: op.isVisibleToClient }) });
    case 'update-advisor-note':
      await updateAdvisorNote(op.noteId, id, { text: op.text, isVisibleToClient: op.isVisibleToClient });
      return NextResponse.json({ ok: true });
    case 'remove-advisor-note':
      await removeAdvisorNote(op.noteId, id);
      return NextResponse.json({ ok: true });
    case 'refresh-prices': {
      const symbols = portfolio.holdings
        .filter(h => h.assetSymbol)
        .map(h => h.assetSymbol!);
      if (symbols.length > 0) {
        const prices = await fetchPriceBatch(symbols);
        await Promise.all(
          portfolio.holdings
            .filter(h => h.assetSymbol && prices[h.assetSymbol])
            .map(h => updateHoldingPrice(h.id, id, prices[h.assetSymbol!]!.price, 'fmp')),
        );
      }
      const updated = await getPortfolioById(id);
      return NextResponse.json({ portfolio: updated, updated: symbols.length });
    }
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const ok = await deleteClientPortfolio(id);
  if (!ok) return NextResponse.json({ error: 'No trobat' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
