// GET → progrés cap als objectius del client de la sessió (o del client que
// mira l'admin en la vista del client). Només lectura. Càlcul a lib/goalProgress.ts.
import { NextResponse } from 'next/server';
import { getClientTarget } from '@/lib/clientTarget';
import { findLeadForUser } from '@/lib/leads';
import { buildWealthForUser } from '@/lib/wealthStore';
import { goalsProgress, availableForGoals, type GoalInput } from '@/lib/goalProgress';
import type { BudgetInput } from '@/lib/budget';

export async function GET() {
  const user = await getClientTarget();
  if (!user) return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
  const [lead, { wealth }] = await Promise.all([
    findLeadForUser(user.id, user.email),
    buildWealthForUser(user.id, user.email),
  ]);
  const q = (lead?.questionnaireData ?? {}) as Record<string, unknown>;
  const summary = goalsProgress({
    goals:     Array.isArray(q.goals) ? q.goals as GoalInput[] : [],
    budget:    q as BudgetInput,
    available: availableForGoals(wealth.groups),
  });
  return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } });
}
