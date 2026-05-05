import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getNewsletter, getActiveSubscribers, changeStatus } from '@/lib/newsletter';

function isAdmin(session: { user?: { role?: string } } | null) {
  return (session?.user as { role?: string })?.role === 'admin';
}

function buildNewsletterHTML(nl: Awaited<ReturnType<typeof getNewsletter>>): string {
  if (!nl) return '';
  const s = nl.sections;
  const section = (title: string, content: string, color = '#1a3a2a') =>
    content.trim() ? `
      <tr><td style="padding:24px 40px 0;">
        <p style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px;">${title}</p>
        <div style="border-left:3px solid ${color};padding-left:14px;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;">${content}</div>
      </td></tr>` : '';

  return `<!DOCTYPE html><html lang="ca"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0">
  <tr><td style="background:#1a3a2a;padding:28px 40px;border-radius:12px 12px 0 0;">
    <span style="font-size:18px;font-weight:900;color:#fff;letter-spacing:2px;">FACTOR</span>
    <span style="font-size:18px;font-weight:300;color:#c9a84c;letter-spacing:4px;margin-left:6px;">OTC</span>
    <span style="float:right;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;padding-top:4px;">Newsletter</span>
  </td></tr>
  <tr><td style="background:#fff;padding:32px 40px 8px;">
    <h1 style="font-size:22px;color:#111827;margin:0 0 4px;">${nl.title}</h1>
    <p style="font-size:12px;color:#9ca3af;margin:0;">${new Date().toLocaleDateString('ca-ES', { year:'numeric', month:'long', day:'numeric' })}</p>
  </td></tr>
  ${section('📰 Notícies de mercat',        s.marketNews)}
  ${section('🌍 Resum macroeconòmic',        s.macroSummary,      '#3b82f6')}
  ${section('📈 Oportunitats de compra',     s.buyOpportunities,  '#10b981')}
  ${section('📉 Oportunitats de venda',      s.sellOpportunities, '#ef4444')}
  ${section('💡 Idees d\'inversió',          s.investmentIdeas,   '#c9a84c')}
  ${section('🔬 Anàlisi fonamental',         s.fundamental)}
  ${section('📊 Anàlisi tècnica',            s.technical)}
  ${section('⚠️ Riscos principals',          s.mainRisks,         '#f59e0b')}
  <tr><td style="background:#fff;padding:24px 40px 32px;">
    <div style="background:#f3f4f6;border-radius:8px;padding:14px;font-size:11px;color:#9ca3af;line-height:1.6;">
      <strong>Avís legal:</strong> ${s.disclaimer}
    </div>
  </td></tr>
  <tr><td style="background:#1a3a2a;padding:20px 40px;border-radius:0 0 12px 12px;">
    <span style="font-size:12px;font-weight:900;color:#fff;">FACTOR</span>
    <span style="font-size:12px;color:#c9a84c;margin-left:4px;">OTC</span>
    <p style="font-size:10px;color:rgba(255,255,255,0.3);margin:4px 0 0;">Eina de suport a la decisió d'inversió · No executa operacions reals</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) return NextResponse.json({ error: 'No autoritzat.' }, { status: 403 });

  const { id } = await params;
  const nl = await getNewsletter(id);
  if (!nl) return NextResponse.json({ error: 'Newsletter no trobada.' }, { status: 404 });
  if (nl.status !== 'validated') {
    return NextResponse.json({ error: 'Només es poden enviar newsletters validades.' }, { status: 422 });
  }

  const subscribers = await getActiveSubscribers();
  if (subscribers.length === 0) {
    return NextResponse.json({ error: 'No hi ha subscriptors actius.' }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Simulem enviament sense API key real
    await changeStatus(id, 'sent');
    return NextResponse.json({
      success:  true,
      simulated: true,
      message:  `Enviament simulat a ${subscribers.length} subscriptors (RESEND_API_KEY no configurada).`,
      sentTo:   subscribers.length,
    });
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const html   = buildNewsletterHTML(nl);
    const from   = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

    // Enviem per lots de 50 (límit Resend batch)
    const batchSize = 50;
    let sent = 0;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      await Promise.all(batch.map(sub =>
        resend.emails.send({
          from,
          to:      [sub.email],
          subject: nl.subject,
          html,
        })
      ));
      sent += batch.length;
    }

    await changeStatus(id, 'sent');
    return NextResponse.json({ success: true, sentTo: sent });
  } catch (err) {
    return NextResponse.json({ error: `Error enviant: ${(err as Error).message}` }, { status: 500 });
  }
}
