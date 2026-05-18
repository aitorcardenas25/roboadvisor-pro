import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = 'Factor OTC <noreply@factorotc.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@factorotc.com';

interface EmailResult { success: boolean; error?: string }

function base(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ca"><head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0a0f0d;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f0d;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0d1f1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px;border-bottom:1px solid rgba(255,255,255,0.06);">
  <span style="font-size:18px;font-weight:900;color:#fff;letter-spacing:2px;">FACTOR</span>
  <span style="font-size:18px;font-weight:300;color:#c9a84c;letter-spacing:3px;margin-left:6px;">OTC</span>
</td></tr>
<tr><td style="padding:32px;color:#fff;">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:rgba(255,255,255,0.3);">
  Factor OTC · Assessorament financer independent · <a href="https://factorotc.com/privacitat" style="color:#c9a84c;">Política de privacitat</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendWelcomeEmail(to: string, name: string): Promise<EmailResult> {
  const subject = 'Benvingut/da a Factor OTC';
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Benvingut/da, ${name}!</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">El teu compte a Factor OTC ja és actiu. Ara pots accedir a la teva zona privada i consultar la teva cartera d'inversió.</p>
    <a href="https://factorotc.com/login" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#c9a84c;color:#0d1f1a;font-weight:700;border-radius:10px;text-decoration:none;">Accedir ara</a>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">Si tens qualsevol dubte, respon a aquest email.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendPaymentConfirmation(to: string, name: string, product: string, amount: number): Promise<EmailResult> {
  const subject = `Confirmació de pagament — ${product}`;
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Pagament confirmat</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Hola ${name}, hem rebut el teu pagament correctament.</p>
    <table style="width:100%;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;margin:20px 0;background:rgba(0,0,0,0.2);">
      <tr><td style="color:rgba(255,255,255,0.5);font-size:13px;">Producte</td><td style="color:#fff;text-align:right;font-weight:600;">${product}</td></tr>
      <tr><td style="color:rgba(255,255,255,0.5);font-size:13px;padding-top:8px;">Import</td><td style="color:#c9a84c;text-align:right;font-weight:700;padding-top:8px;">${amount.toFixed(2)} €</td></tr>
    </table>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">Guarda aquest email com a comprovant del pagament.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendReportReady(to: string, name: string, reportUrl: string): Promise<EmailResult> {
  const subject = 'El teu informe financer està llest';
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">El teu informe financer</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Hola ${name}, l'assessor ha preparat el teu informe financer personalitzat.</p>
    <a href="${reportUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#c9a84c;color:#0d1f1a;font-weight:700;border-radius:10px;text-decoration:none;">Veure informe</a>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">L'informe inclou el diagnòstic de la teva situació financera, el teu perfil inversor i la proposta de cartera personalitzada.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendLeadNotification(lead: { name: string; email: string; interest: string }): Promise<EmailResult> {
  const subject = `Nou lead: ${lead.name}`;
  if (!resend) { console.log('[email]', subject, ADMIN_EMAIL); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Nou lead capturat</h2>
    <table style="width:100%;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:20px;background:rgba(0,0,0,0.2);">
      <tr><td style="color:rgba(255,255,255,0.5);font-size:13px;">Nom</td><td style="color:#fff;">${lead.name}</td></tr>
      <tr><td style="color:rgba(255,255,255,0.5);font-size:13px;padding-top:8px;">Email</td><td style="color:#c9a84c;padding-top:8px;"><a href="mailto:${lead.email}" style="color:#c9a84c;">${lead.email}</a></td></tr>
      <tr><td style="color:rgba(255,255,255,0.5);font-size:13px;padding-top:8px;">Interès</td><td style="color:#fff;padding-top:8px;">${lead.interest}</td></tr>
    </table>
    <a href="https://factorotc.com/admin" style="display:inline-block;margin:24px 0;padding:10px 24px;background:#1a3a2a;border:1px solid rgba(45,106,79,0.5);color:#c9a84c;font-weight:600;border-radius:10px;text-decoration:none;">Gestionar al panell admin</a>`;
  const { error } = await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}
