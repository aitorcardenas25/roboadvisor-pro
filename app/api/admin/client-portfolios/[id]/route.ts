import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
  getPortfolioById, updateClientPortfolio, deleteClientPortfolio,
} from '@/lib/clientPortfolios';
import type { ClientHolding, ClientTransaction, AdvisorNote } from '@/lib/clientPortfolios';
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

// ── Schemas for individual update operations ───────────────────────────────

const HoldingSchema = z.object({
  id:               z.string().optional(),
  assetIsin:        z.string().min(1),
  assetName:        z.string().min(1).max(200),
  assetSymbol:      z.string().max(20).optional(),
  assetCategory:    z.string().min(1).max(100),
  broker:           z.string().min(1).max(100),
  quantity:         z.number().positive(),
  avgEntryPrice:    z.number().positive(),
  currentPrice:     z.number().nonnegative(),
  priceLastUpdated: z.string().default(() => new Date().toISOString().split('T')[0]),
  currency:         z.string().default('EUR'),
  notes:            z.string().max(500).optional(),
});

const TransactionSchema = z.object({
  holdingId: z.string(),
  type:      z.enum(['buy', 'sell']),
  date:      z.string(),
  quantity:  z.number().positive(),
  priceEur:  z.number().positive(),
  totalEur:  z.number().positive(),
  broker:    z.string().min(1).max(100),
  notes:     z.string().max(500).optional(),
});

const AdvisorNoteSchema = z.object({
  text:   z.string().min(1).max(2000),
  author: z.string().default('Admin Factor OTC'),
});

const PatchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update-meta'),       name: z.string().optional(), description: z.string().optional(), recommendations: z.string().optional() }),
  z.object({ action: z.literal('add-holding'),        holding: HoldingSchema }),
  z.object({ action: z.literal('update-holding'),     holdingId: z.string(), holding: HoldingSchema.partial() }),
  z.object({ action: z.literal('remove-holding'),     holdingId: z.string() }),
  z.object({ action: z.literal('update-price'),       holdingId: z.string(), currentPrice: z.number().nonnegative() }),
  z.object({ action: z.literal('add-transaction'),    transaction: TransactionSchema }),
  z.object({ action: z.literal('add-advisor-note'),   note: AdvisorNoteSchema }),
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
  const today = new Date().toISOString().split('T')[0];

  switch (op.action) {
    case 'update-meta': {
      const updated = await updateClientPortfolio(id, {
        name:            op.name            ?? portfolio.name,
        description:     op.description     ?? portfolio.description,
        recommendations: op.recommendations ?? portfolio.recommendations,
      });
      return NextResponse.json({ portfolio: updated });
    }

    case 'add-holding': {
      const newHolding: ClientHolding = {
        ...op.holding,
        id: op.holding.id ?? `h-${Date.now()}`,
      };
      const updated = await updateClientPortfolio(id, {
        holdings: [...portfolio.holdings, newHolding],
      });
      return NextResponse.json({ portfolio: updated });
    }

    case 'update-holding': {
      const holdings = portfolio.holdings.map(h =>
        h.id === op.holdingId ? { ...h, ...op.holding } : h
      );
      const updated = await updateClientPortfolio(id, { holdings });
      return NextResponse.json({ portfolio: updated });
    }

    case 'remove-holding': {
      const updated = await updateClientPortfolio(id, {
        holdings: portfolio.holdings.filter(h => h.id !== op.holdingId),
      });
      return NextResponse.json({ portfolio: updated });
    }

    case 'update-price': {
      const holdings = portfolio.holdings.map(h =>
        h.id === op.holdingId
          ? { ...h, currentPrice: op.currentPrice, priceLastUpdated: today }
          : h
      );
      const updated = await updateClientPortfolio(id, { holdings });
      return NextResponse.json({ portfolio: updated });
    }

    case 'add-transaction': {
      const tx: ClientTransaction = { ...op.transaction, id: `tx-${Date.now()}` };
      const updated = await updateClientPortfolio(id, {
        transactions: [...portfolio.transactions, tx],
      });
      return NextResponse.json({ portfolio: updated });
    }

    case 'add-advisor-note': {
      const note: AdvisorNote = {
        id:     `note-${Date.now()}`,
        date:   today,
        author: op.note.author,
        text:   op.note.text,
      };
      const updated = await updateClientPortfolio(id, {
        advisorNotes: [...portfolio.advisorNotes, note],
      });
      return NextResponse.json({ portfolio: updated });
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
