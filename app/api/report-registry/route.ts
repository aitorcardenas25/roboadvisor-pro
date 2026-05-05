import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { saveReport, getReports } from '@/lib/reportRegistry';
import { validateBody } from '@/lib/validate';
import { SaveReportSchema } from '@/lib/schemas';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ reports: await getReports() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin' && role !== 'authorized')
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const v = await validateBody(req, SaveReportSchema);
  if (!v.ok) return v.response;

  try {
    const rec = await saveReport(v.data);
    return NextResponse.json({ report: rec }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error intern.' }, { status: 500 });
  }
}
