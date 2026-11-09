// GET → ús de la beta per client: dies actius per setmana, darrer accés, consentiment.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getAllUsers } from '@/lib/users';
import { getActivitySince, summarizeUsage, weekStart } from '@/lib/betaActivity';
import { getConsentDates } from '@/lib/betaConsent';
import { getAllLeads } from '@/lib/leads';
import { diagnose, type DiagnosisInput } from '@/lib/diagnosis';
import { pickFinanceFields } from '@/lib/budget';

type S = { user?: { role?: string } } | null;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions) as S;
  if (session?.user?.role !== 'admin') return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });

  const weeks = Math.min(26, Math.max(1, Number(req.nextUrl.searchParams.get('weeks')) || 8));
  const now = new Date();
  const since = new Date(weekStart(now).getTime() - (weeks - 1) * 7 * 86_400_000);

  const [users, rows, consents, leads] = await Promise.all([getAllUsers(), getActivitySince(since), getConsentDates(), getAllLeads()]);
  const clients = users.filter(u => u.role === 'client' && u.active).map(u => ({ id: u.id, name: u.name, email: u.email }));
  const lastLogin = Object.fromEntries(users.map(u => [u.id, u.lastLoginAt]));

  const summary = summarizeUsage(rows, clients, consents, now, weeks);
  // Si no hi ha activitat registrada (abans d'aquesta versió), el darrer login de la taula d'usuaris ajuda.
  for (const c of summary.clients) if (!c.lastSeen && lastLogin[c.id]) c.lastSeen = lastLogin[c.id]!;

  // Diagnòstic de cada client amb la seva fitxa (vinculada per usuari o per correu).
  for (const c of summary.clients) {
    const lead = leads.find(l => l.linkedUserId === c.id) ?? leads.find(l => l.email && l.email.toLowerCase() === c.email.toLowerCase());
    const d = diagnose(pickFinanceFields(lead?.questionnaireData) as DiagnosisInput, now);
    c.diagnosis = { status: d.status, headline: d.headline };
  }

  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
