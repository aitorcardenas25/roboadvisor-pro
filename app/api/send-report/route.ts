// app/api/send-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { saveReport } from '@/lib/reportRegistry';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY no configurada');
  return new Resend(key);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pdfBlob  = formData.get('pdf')        as Blob   | null;
    const email    = formData.get('email')         as string | null;
    const name     = formData.get('name')          as string | null;
    const profile  = formData.get('profile')       as string | null;
    const score    = formData.get('score')         as string | null;
    const date     = formData.get('date')          as string | null;
    const monthly  = formData.get('monthlyAmount') as string | null;
    const invest   = formData.get('investable')    as string | null;
    const horizon  = formData.get('horizon')       as string | null;
    const portfolio= formData.get('portfolio')     as string | null;

    // ── Validació ────────────────────────────────────────────────────────────
    if (!email || !pdfBlob) {
      return NextResponse.json(
        { error: 'Email i PDF són obligatoris.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invàlid.' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY no configurada. Afegeix-la al .env.local.' },
        { status: 503 }
      );
    }

    // ── Convertir PDF a Buffer ────────────────────────────────────────────────
    const pdfBuffer    = Buffer.from(await pdfBlob.arrayBuffer());
    const clientName   = name    || 'Client';
    const profileLabel = profile || 'personalitzat';
    const scoreValue   = score   || '—';
    const reportDate   = date    || new Date().toLocaleDateString('ca-ES');
    const fileName     = `Factor_OTC_Informe_${clientName.replace(/\s+/g, '_')}_${reportDate.replace(/\//g, '-')}.pdf`;

    // ── Enviar email amb Resend ───────────────────────────────────────────────
    const { data, error } = await getResend().emails.send({
      from:    process.env.FROM_EMAIL ?? 'onboarding@resend.dev',
      to:      [email],
      subject: `Factor OTC — Informe Financer Personalitzat — ${clientName}`,
      html:    buildEmailHTML(clientName, profileLabel, scoreValue, reportDate),
      attachments: [
        {
          filename:    fileName,
          content:     pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (error) {
      console.error('[send-report] Resend error:', error);
      const msg = error.message ?? '';
      const userMsg = msg.includes('testing emails') || msg.includes('verify a domain')
        ? 'Mode test actiu: Resend només permet enviar al teu propi email fins que verifiquis un domini a resend.com/domains.'
        : `Error enviant l'email: ${msg}`;
      return NextResponse.json({ error: userMsg }, { status: 500 });
    }

    // Guardar al registre d'informes
    saveReport({
      clientName:    clientName,
      clientEmail:   email,
      profile:       profileLabel,
      score:         parseInt(scoreValue) || 0,
      monthlyAmount: parseFloat(monthly ?? '0') || 0,
      investable:    parseFloat(invest  ?? '0') || 0,
      horizon:       parseInt(horizon   ?? '10') || 10,
      portfolio:     portfolio ? portfolio.split(',').map(s => s.trim()) : [],
      pdfGenerated:  true,
      emailSent:     true,
      date:          reportDate,
    });

    return NextResponse.json({
      success:  true,
      messageId: data?.id,
      message:  `Informe enviat correctament a ${email}`,
    });

  } catch (error) {
    console.error('[send-report] Error:', error);
    return NextResponse.json(
      { error: 'Error intern del servidor.' },
      { status: 500 }
    );
  }
}

// ─── EMAIL HTML TEMPLATE ──────────────────────────────────────────────────────

function buildEmailHTML(
  name:    string,
  profile: string,
  score:   string,
  date:    string
): string {
  const profileIcons: Record<string, string> = {
    conservador: '🛡️',
    moderat:     '⚖️',
    dinamic:     '📈',
    agressiu:    '🚀',
  };
  const profileColors: Record<string, string> = {
    conservador: '#10b981',
    moderat:     '#3b82f6',
    dinamic:     '#f59e0b',
    agressiu:    '#ef4444',
  };

  const icon  = profileIcons[profile]  ?? '📊';
  const color = profileColors[profile] ?? '#c9a84c';

  return `
<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factor OTC — Informe Financer</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family: Arial, Helvetica, sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header verd -->
          <tr>
            <td style="background:#1a3a2a; padding: 32px 40px; border-radius: 12px 12px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px; font-weight:900; color:#ffffff; letter-spacing:2px;">FACTOR</span>
                    <span style="font-size:20px; font-weight:300; color:#c9a84c; letter-spacing:4px; margin-left:6px;">OTC</span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px; color:rgba(255,255,255,0.4); letter-spacing:2px; text-transform:uppercase;">
                      Informe Financer
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cos principal -->
          <tr>
            <td style="background:#ffffff; padding: 40px;">

              <!-- Salutació -->
              <h1 style="font-size:24px; color:#111827; margin:0 0 8px 0; font-weight:700;">
                Hola, ${name}! 👋
              </h1>
              <p style="font-size:15px; color:#6b7280; margin:0 0 32px 0; line-height:1.6;">
                T'enviem el teu informe financer personalitzat generat per <strong>Factor OTC</strong>.
                Trobaràs tots els detalls adjunts en format PDF.
              </p>

              <!-- Card perfil -->
              <div style="background:#f9f8f5; border:1px solid #e5e7eb; border-left: 4px solid ${color}; border-radius:8px; padding:20px; margin-bottom:32px;">
                <p style="font-size:11px; color:#9ca3af; text-transform:uppercase; letter-spacing:2px; margin:0 0 8px 0;">
                  Perfil inversor determinat
                </p>
                <div style="display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <p style="font-size:22px; font-weight:900; color:#111827; margin:0;">
                      ${icon} ${profile.charAt(0).toUpperCase() + profile.slice(1)}
                    </p>
                    <p style="font-size:13px; color:#6b7280; margin:4px 0 0 0;">
                      Puntuació: <strong>${score}</strong> · Data: ${date}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Contingut informe -->
              <p style="font-size:14px; color:#374151; margin:0 0 16px 0; font-weight:600;">
                📄 L'informe adjunt inclou:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                ${[
                  ['📊', 'Resum executiu i flux de caixa'],
                  ['👤', 'Perfil inversor i scoring detallat'],
                  ['📋', 'Diagnòstic financer personal'],
                  ['💼', 'Composició detallada de la cartera'],
                  ['📈', 'Anàlisi gràfica i mètriques'],
                  ['🎲', 'Projecció Monte Carlo (1.000 simulacions)'],
                  ['⚠️', 'Anàlisi de riscos i pla de seguiment'],
                  ['✅', 'Conclusions i propers passos'],
                ].map(([icon, text]) => `
                  <tr>
                    <td style="padding:6px 0; color:#6b7280; font-size:13px;">
                      <span style="margin-right:8px;">${icon}</span>${text}
                    </td>
                  </tr>
                `).join('')}
              </table>

              <!-- Avís legal -->
              <div style="background:#f3f4f6; border-radius:8px; padding:16px; margin-bottom:24px;">
                <p style="font-size:11px; color:#9ca3af; margin:0; line-height:1.6;">
                  <strong>Avís legal:</strong> Aquest informe és una eina de suport a la decisió
                  d'inversió amb finalitat orientativa i educativa. No constitueix assessorament
                  financer personalitzat regulat. Factor OTC no és una entitat financera regulada.
                  Els rendiments passats no garanteixen rendiments futurs.
                </p>
              </div>

              <!-- CTA -->
              <p style="font-size:14px; color:#6b7280; margin:0; line-height:1.6;">
                Si tens cap dubte sobre l'informe, no dubtis en contactar-nos.
                Recorda que sempre pots tornar a generar un nou informe actualitzat a
                <a href="https://factorotc.com" style="color:#c9a84c; text-decoration:none; font-weight:600;">factorotc.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1a3a2a; padding:24px 40px; border-radius:0 0 12px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:13px; font-weight:900; color:#ffffff;">FACTOR</span>
                    <span style="font-size:13px; color:#c9a84c; margin-left:4px;">OTC</span>
                    <p style="font-size:11px; color:rgba(255,255,255,0.3); margin:4px 0 0 0;">
                      Eina de suport a la decisió d'inversió
                    </p>
                  </td>
                  <td align="right">
                    <p style="font-size:11px; color:rgba(255,255,255,0.3); margin:0;">
                      © ${new Date().getFullYear()} Factor OTC
                    </p>
                    <p style="font-size:11px; color:rgba(255,255,255,0.2); margin:4px 0 0 0;">
                      No executa operacions reals
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
}