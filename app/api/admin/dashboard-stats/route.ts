// GET → activitat mensual i distribució per perfil, amb dades reals (clients i propostes aprovades)
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getAllProposals } from '@/lib/proposals';
import { computeDashboardStats } from '@/lib/dashboardStats';

type S = { user?: { role?: string } } | null;

export async function GET() {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  try {
    const [users, proposals] = await Promise.all([getAllUsers(), getAllProposals()]);
    return NextResponse.json(computeDashboardStats(users.filter(u => u.role === 'client'), proposals));
  } catch (err) {
    console.error('[dashboard-stats]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No s\'han pogut calcular les estadístiques' }, { status: 500 });
  }
}
