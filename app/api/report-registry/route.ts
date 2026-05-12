import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { saveReport, getReports } from '@/lib/reportRegistry';
import { validateBody } from '@/lib/validate';
import { SaveReportSchema } from '@/lib/schemas';
import { rateLimit, LIMITS, rateLimitResponse } from '@/lib/rateLimiter';
import { logAuditEvent } from '@/lib/auditLog';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ reports: await getReports() });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  const rl = rateLimit(`report-gen:${ip}`, LIMITS.reportGen.maxRequests, LIMITS.reportGen.windowMs);
  if (!rl.ok) return rateLimitResponse(rl.resetInMs) as unknown as NextResponse;

  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; id?: string; email?: string } | undefined;
  if (user?.role !== 'admin' && user?.role !== 'authorized')
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, SaveReportSchema);
  if (!v.ok) return v.response;

  try {
    const rec = await saveReport(v.data);
    logAuditEvent('report.generated', {
      userId: user?.id,
      userEmail: user?.email,
      resource: rec.id,
      metadata: { profile: v.data.profile, clientEmail: v.data.clientEmail },
    });
    return NextResponse.json({ report: rec }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error intern.' }, { status: 500 });
  }
}
