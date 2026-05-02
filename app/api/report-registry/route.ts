import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { saveReport, getReports, type ReportRecord } from '@/lib/reportRegistry';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin') return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });
  return NextResponse.json({ reports: getReports() });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin' && role !== 'authorized')
    return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  try {
    const body = await req.json() as Partial<ReportRecord>;
    const rec = saveReport({
      clientName:    body.clientName    ?? 'Client',
      clientEmail:   body.clientEmail   ?? '',
      profile:       body.profile       ?? 'moderat',
      score:         body.score         ?? 0,
      monthlyAmount: body.monthlyAmount ?? 0,
      investable:    body.investable    ?? 0,
      horizon:       body.horizon       ?? 10,
      portfolio:     body.portfolio     ?? [],
      pdfGenerated:  body.pdfGenerated  ?? false,
      emailSent:     body.emailSent     ?? false,
      date:          body.date          ?? new Date().toLocaleDateString('ca-ES'),
    });
    return NextResponse.json({ report: rec }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Error intern.' }, { status: 500 });
  }
}
