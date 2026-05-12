import { NextResponse } from 'next/server';
import { getDb } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface CheckResult { status: 'ok' | 'degraded' | 'error'; latencyMs?: number }

async function checkEcbApi(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 4000);
    const res  = await fetch(
      'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.ESTRXXX.WT.ST?startPeriod=2024-01-01&detail=dataonly&format=jsondata',
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    return { status: res.ok ? 'ok' : 'degraded', latencyMs: Date.now() - start };
  } catch {
    return { status: 'degraded', latencyMs: Date.now() - start };
  }
}

async function checkDb(): Promise<CheckResult> {
  const db = getDb();
  if (!db) return { status: 'ok' };  // in-memory mode, always ok

  const start = Date.now();
  try {
    await db.from('portfolios').select('id').limit(1);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error', latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const [ecb, db] = await Promise.all([checkEcbApi(), checkDb()]);

  const checks = { ecb, db };
  const overall = Object.values(checks).some(c => c.status === 'error')
    ? 'error'
    : Object.values(checks).some(c => c.status === 'degraded')
    ? 'degraded'
    : 'ok';

  return NextResponse.json(
    {
      status:    overall,
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? '0.1.0',
      uptime:    process.uptime(),
      checks,
    },
    { status: overall === 'error' ? 503 : 200 },
  );
}
