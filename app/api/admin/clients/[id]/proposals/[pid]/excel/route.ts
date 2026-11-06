// GET → Excel de la proposta (fons, imports i projecció any a any)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getProposal } from '@/lib/proposals';
import { buildProposalWorkbook } from '@/lib/proposalExcel';

type S = { user?: { role?: string } } | null;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const { id, pid } = await params;
  const user = (await getAllUsers()).find(u => u.id === id);
  if (!user) return NextResponse.json({ error: 'Client no trobat' }, { status: 404 });
  const proposal = await getProposal(id, pid);
  if (!proposal) return NextResponse.json({ error: 'Proposta no trobada' }, { status: 404 });

  const buf = await buildProposalWorkbook(proposal, user.name);
  const safe = user.name.normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'client';
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="FACTOR_OTC_proposta_${safe}_v${proposal.version}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  });
}
