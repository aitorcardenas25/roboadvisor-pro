import { Resend } from 'resend';

const resend      = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM        = `Factor OTC <${process.env.RESEND_FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'noreply@factorotc.com'}>`;
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
  Factor OTC · Planificació i seguiment financer · <a href="https://factorotc.com/privacitat" style="color:#c9a84c;">Política de privacitat</a>
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

export async function sendAccessRequestConfirmation(to: string, name: string): Promise<EmailResult> {
  const subject = 'Hem rebut la teva sol·licitud d\'accés';
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Sol·licitud rebuda, ${name}!</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Hem rebut la teva sol·licitud d'accés a Factor OTC. El nostre equip la revisarà aviat i et contactarà en les properes 24–48 hores.</p>
    <div style="margin:24px 0;padding:16px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:10px;">
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">Mentre tant, pots consultar les nostres <strong style="color:#c9a84c;">carteres model</strong> i els darrers <strong style="color:#c9a84c;">informes de mercat</strong> a la nostra web.</p>
    </div>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">Si tens qualsevol dubte, respon directament a aquest email.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendQuestionnaireReceivedToAdmin(lead: {
  name: string;
  email: string;
  profile?: string;
  leadId: string;
}): Promise<EmailResult> {
  const subject = `Qüestionari completat: ${lead.name}`;
  if (!resend) { console.log('[email]', subject, ADMIN_EMAIL); return { success: false, error: 'No API key' }; }
  const row = (label: string, val: string, highlight = false) =>
    `<tr><td style="color:rgba(255,255,255,0.45);font-size:12px;padding:5px 8px;white-space:nowrap;">${label}</td><td style="color:${highlight ? '#c9a84c' : '#fff'};padding:5px 8px;">${val}</td></tr>`;
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Qüestionari de perfil completat</h2>
    <table style="width:100%;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.2);">
      ${row('Nom', lead.name)}
      ${row('Email', `<a href="mailto:${lead.email}" style="color:#c9a84c;">${lead.email}</a>`, true)}
      ${lead.profile ? row('Perfil calculat', lead.profile, true) : ''}
      ${row('ID Lead', lead.leadId)}
    </table>
    <a href="https://factorotc.com/admin" style="display:inline-block;margin:24px 0;padding:10px 24px;background:#1a3a2a;border:1px solid rgba(45,106,79,0.5);color:#c9a84c;font-weight:600;border-radius:10px;text-decoration:none;">Veure al panell admin →</a>`;
  const { error } = await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendMonthlyReportAvailable(to: string, name: string, period: string): Promise<EmailResult> {
  const subject = `Informe mensual disponible — ${period}`;
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">El teu informe mensual ja és disponible</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Hola ${name}, el teu assessor ha preparat l'informe mensual corresponent al <strong style="color:#c9a84c;">${period}</strong>.</p>
    <p style="color:rgba(255,255,255,0.6);line-height:1.6;margin-top:12px;">L'informe inclou: valor actual de la cartera, rendiment del mes, principals posicions i comentaris de l'assessor.</p>
    <a href="https://factorotc.com/client/cartera" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#c9a84c;color:#0d1f1a;font-weight:700;border-radius:10px;text-decoration:none;">Veure la meva cartera</a>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">Si tens qualsevol pregunta sobre l'informe, contacta directament amb el teu assessor.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendLeadNotification(lead: {
  name: string;
  lastName?: string;
  email: string;
  phone?: string;
  interest: string;
  type?: string;
  profile?: string;
  source?: string;
}): Promise<EmailResult> {
  const fullName = [lead.name, lead.lastName].filter(Boolean).join(' ');
  const subject  = `Nou lead: ${fullName}`;
  if (!resend) { console.log('[email]', subject, ADMIN_EMAIL); return { success: false, error: 'No API key' }; }
  const originLabel = lead.type === 'questionnaire'   ? 'Qüestionari completat'
    : lead.type === 'report-request' ? "Sol·licitud d'informe"
    : lead.source ?? lead.type ?? 'Formulari';
  const row = (label: string, val: string, highlight = false) =>
    `<tr><td style="color:rgba(255,255,255,0.45);font-size:12px;padding:5px 8px;white-space:nowrap;">${label}</td><td style="color:${highlight ? '#c9a84c' : '#fff'};padding:5px 8px;">${val}</td></tr>`;
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Nou lead capturat</h2>
    <table style="width:100%;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;background:rgba(0,0,0,0.2);">
      ${row('Nom', fullName)}
      ${row('Email', `<a href="mailto:${lead.email}" style="color:#c9a84c;">${lead.email}</a>`, true)}
      ${lead.phone ? row('Telèfon', lead.phone) : ''}
      ${row('Origen', originLabel)}
      ${lead.profile ? row('Perfil', lead.profile) : ''}
      ${row('Interès', lead.interest)}
    </table>
    <a href="https://factorotc.com/admin" style="display:inline-block;margin:24px 0;padding:10px 24px;background:#1a3a2a;border:1px solid rgba(45,106,79,0.5);color:#c9a84c;font-weight:600;border-radius:10px;text-decoration:none;">Gestionar al panell admin →</a>`;
  const { error } = await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendDeletionRequestToAdmin(req: { userId: string; email: string; name: string; reason?: string }): Promise<EmailResult> {
  const subject = `Sol·licitud d'eliminació de dades: ${req.name}`;
  if (!resend) { console.log('[email]', subject, ADMIN_EMAIL); return { success: false, error: 'No API key' }; }
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Sol·licitud d'eliminació de dades (RGPD art. 17)</h2>
    <p style="color:rgba(255,255,255,0.7);">El client <strong>${esc(req.name)}</strong> (${esc(req.email)}, usuari ${esc(req.userId)}) demana esborrar les seves dades.</p>
    ${req.reason ? `<p style="color:rgba(255,255,255,0.7);">Motiu: ${esc(req.reason)}</p>` : ''}
    <p style="color:rgba(255,255,255,0.5);font-size:13px;">Termini per respondre: 1 mes (RGPD art. 12.3). Comprova abans si alguna llei obliga a conservar part de les dades.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}

export async function sendBetaWelcome(to: string, name: string, username: string): Promise<EmailResult> {
  const subject = 'Benvingut/da a la beta de Factor OTC';
  if (!resend) { console.log('[email]', subject, to); return { success: false, error: 'No API key' }; }
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const base_url = (process.env.NEXTAUTH_URL ?? 'https://factorotc.com').replace(/\/$/, '');
  const first = esc(name.split(' ')[0] || name);
  const body = `
    <h2 style="color:#c9a84c;margin:0 0 16px;">Hola, ${first}!</h2>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">Ja tens el compte a la beta privada de Factor OTC. Durant 3 mesos podràs ordenar el pressupost, veure el fons d'emergència que et convé i seguir els teus objectius.</p>
    <p style="color:rgba(255,255,255,0.7);line-height:1.6;">El teu usuari és <strong style="color:#fff;">${esc(username)}</strong>. La contrasenya te la passo per un altre canal. Quan entris, canvia-la des de "Les meves finances".</p>
    <a href="${base_url}/login" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#c9a84c;color:#0d1f1a;font-weight:700;border-radius:10px;text-decoration:none;">Entrar a l'app</a>
    <p style="color:rgba(255,255,255,0.4);font-size:13px;">El primer cop et demanarem que acceptis com tractem les teves dades. Si tens dubtes, respon a aquest correu.</p>`;
  const { error } = await resend.emails.send({ from: FROM, to, subject, html: base(subject, body) });
  return error ? { success: false, error: error.message } : { success: true };
}
