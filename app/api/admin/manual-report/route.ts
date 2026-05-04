import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { generateManualReport, type ManualPortfolioInput } from '@/lib/manualReport';
import { saveReport } from '@/lib/reportRegistry';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== 'admin')
    return NextResponse.json({ error: 'Accés no autoritzat.' }, { status: 403 });

  let body: ManualPortfolioInput;
  try {
    body = await req.json() as ManualPortfolioInput;
  } catch {
    return NextResponse.json({ error: 'Cos de la petició invàlid.' }, { status: 400 });
  }

  if (!body.clientName || !body.assets || body.assets.length === 0)
    return NextResponse.json({ error: 'Falten dades obligatòries.' }, { status: 400 });

  const html = generateManualReport(body);

  saveReport({
    clientName:    body.clientName,
    clientEmail:   body.clientEmail,
    profile:       body.investorProfile,
    score:         0,
    monthlyAmount: body.monthlyAmount,
    investable:    body.initialAmount,
    horizon:       body.horizon,
    portfolio:     body.assets.map(a => a.name),
    pdfGenerated:  false,
    emailSent:     false,
    date:          new Date().toLocaleDateString('ca-ES'),
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type':        'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="informe-manual-${body.clientName.replace(/\s+/g, '-').toLowerCase()}.html"`,
      'Cache-Control':       'no-store',
    },
  });
}
