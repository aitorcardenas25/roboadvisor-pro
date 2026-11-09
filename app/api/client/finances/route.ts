// GET → dades de pressupost i objectius del client que ha iniciat sessió.
// Només es consulta per l'usuari de la sessió: mai es poden veure dades d'un altre client.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getLeadByLinkedUser, getLeadByEmail } from '@/lib/leads';
import { pickFinanceFields } from '@/lib/budget';

type S = { user?: { id?: string; email?: string; role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  const userId = session?.user?.id;
  const role   = session?.user?.role;
  if (!userId || (role !== 'client' && role !== 'admin')) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  }

  const lead = await getLeadByLinkedUser(userId)
    ?? (session?.user?.email ? await getLeadByEmail(session.user.email) : null);
  const data = pickFinanceFields(lead?.questionnaireData);

  return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
}
