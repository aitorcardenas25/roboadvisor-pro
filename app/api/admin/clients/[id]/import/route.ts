// GET  → descarrega la plantilla Excel per a aquest client
// POST → puja la plantilla omplerta (multipart: file, mode=preview|commit, replace=true|false)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getLeadByLinkedUser, getLeadByEmail, saveLeadQuestionnaire } from '@/lib/leads';
import {
  getPortfolioByClientId, createClientPortfolio, addHolding, addTransaction,
  removeHolding, removeTransaction,
} from '@/lib/clientPortfolios';
import { buildTemplate, parseClientWorkbook } from '@/lib/clientImport';
import { logAuditEvent } from '@/lib/auditLog';

type S = { user?: { id?: string; email?: string; role?: string } } | null;
const MAX_BYTES = 5 * 1024 * 1024;

const FormSchema = z.object({
  mode:    z.enum(['preview', 'commit']),
  replace: z.enum(['true', 'false']).default('false'),
});

async function findClient(id: string) {
  const users = await getAllUsers();
  return users.find(u => u.id === id) ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const user = await findClient(id);
  if (!user) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  const buf = await buildTemplate(user.name);
  const safe = user.name.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="FACTOR_OTC_plantilla_${safe}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id } = await params;
  const user = await findClient(id);
  if (!user) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: 'Cal enviar el fitxer com a formulari' }, { status: 400 }); }

  const parsed = FormSchema.safeParse({ mode: form.get('mode'), replace: form.get('replace') ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: 'Paràmetres no vàlids' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el fitxer' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El fitxer supera 5 MB' }, { status: 400 });
  if (!file.name.toLowerCase().endsWith('.xlsx')) return NextResponse.json({ error: 'Ha de ser un fitxer .xlsx' }, { status: 400 });

  const result = await parseClientWorkbook(await file.arrayBuffer());
  const lead = await getLeadByLinkedUser(id) ?? await getLeadByEmail(user.email);
  const existing = await getPortfolioByClientId(id);

  if (parsed.data.mode === 'preview') {
    return NextResponse.json({
      ...result,
      context: {
        hasLead: !!lead,
        existingHoldings:     existing?.holdings.length ?? 0,
        existingTransactions: existing?.transactions.length ?? 0,
      },
    });
  }

  // commit: només si no hi ha errors (cap fila a mitges)
  if (result.errors.length) {
    return NextResponse.json({ error: 'Corregeix els errors abans d\'importar', ...result }, { status: 422 });
  }

  const replace = parsed.data.replace === 'true';
  const portfolio = existing ?? await createClientPortfolio({
    clientId: id, clientName: user.name, name: `Cartera de ${user.name}`,
    description: 'Creada des de la importació d\'Excel', recommendations: '',
  });

  // Primer s'insereixen les files noves i només després s'esborren les antigues:
  // si una inserció falla, es desfà el que s'ha afegit i la cartera queda com estava.
  const oldHoldings = replace && existing ? existing.holdings.map(h => h.id) : [];
  const oldTxs      = replace && existing ? existing.transactions.map(t => t.id) : [];
  const newHoldings: string[] = [];
  const newTxs: string[] = [];
  const now = new Date().toISOString();
  try {
    for (const h of result.holdings) {
      const created = await addHolding(portfolio.id, {
        assetIsin: h.isin, assetName: h.name, assetCategory: h.category, broker: h.broker,
        quantity: h.quantity, avgEntryPrice: h.avgEntryPrice,
        // Fins que no es refresquin preus de mercat, el valor actual = cost (preu pendent)
        currentPrice: h.avgEntryPrice, priceLastUpdated: now, priceSource: 'pending',
        currency: h.currency, notes: h.notes,
      });
      newHoldings.push(created.id);
    }
    for (const t of result.transactions) {
      const created = await addTransaction(portfolio.id, {
        operationType: t.operationType, ticker: t.isin, assetName: t.name, date: t.date,
        quantity: t.quantity, priceEur: t.priceEur, totalEur: t.totalEur,
        commission: t.commission, broker: t.broker, notes: t.notes,
      });
      newTxs.push(created.id);
    }
  } catch (err) {
    await Promise.allSettled([
      ...newHoldings.map(hid => removeHolding(hid, portfolio.id)),
      ...newTxs.map(tid => removeTransaction(tid, portfolio.id)),
    ]);
    console.error('[import] error inserint, s\'ha desfet la importació:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'ha pogut desar la importació; la cartera no s\'ha modificat.' }, { status: 500 });
  }
  for (const hid of oldHoldings) await removeHolding(hid, portfolio.id);
  for (const tid of oldTxs)      await removeTransaction(tid, portfolio.id);

  let personalSaved = false;
  if (lead && Object.keys(result.personal).length) {
    personalSaved = await saveLeadQuestionnaire(lead.id, { ...(lead.questionnaireData ?? {}), ...result.personal });
  }

  logAuditEvent('portfolio.imported', {
    userId: session.user?.id, userEmail: session.user?.email, resource: portfolio.id,
    metadata: {
      clientId: id, file: file.name, replace,
      holdings: result.holdings.length, transactions: result.transactions.length,
      personalFields: Object.keys(result.personal).length, personalSaved,
    },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined,
  });

  return NextResponse.json({
    ok: true, portfolioId: portfolio.id,
    imported: { holdings: result.holdings.length, transactions: result.transactions.length },
    personalSaved, warnings: result.warnings,
  });
}
