// lib/emails.ts — correus de l'app.
//
// Dues maneres d'enviar (la primera que estigui configurada a Vercel):
//   1. Gmail: GMAIL_USER (l'adreça) + GMAIL_APP_PASSWORD (contrasenya d'aplicació de 16 lletres,
//      no la contrasenya normal). Surten des d'aquest Gmail i les respostes hi arriben.
//   2. Resend: RESEND_API_KEY (+ RESEND_FROM_EMAIL amb un domini verificat).
// Si no n'hi ha cap, no s'envia res i es retorna NO_KEY_ERROR (queda a l'audit log).
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@factorotc.com';

interface EmailResult { success: boolean; error?: string }

/** Adreça pública de l'app per als enllaços dels correus (la de Vercel si no hi ha domini propi). */
export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'https://roboadvisor-pro.vercel.app').replace(/\/$/, '');
}

/** Missatge entenedor quan no es pot enviar (es mostra a l'admin i queda a l'audit log). */
export const NO_KEY_ERROR = 'Correu no configurat: falten GMAIL_USER i GMAIL_APP_PASSWORD a Vercel';

/** Quin sistema d'enviament hi ha configurat (per mostrar-ho a l'admin). */
export function emailTransport(): 'gmail' | 'resend' | null {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return null;
}

let gmail: nodemailer.Transporter | null = null;

/** Envia un correu pel sistema configurat. Mai llença: retorna l'error en text. */
async function deliver(to: string, subject: string, html: string): Promise<EmailResult> {
  const t = emailTransport();
  if (!t) { console.log('[email] no configurat:', subject); return { success: false, error: NO_KEY_ERROR }; }
  try {
    if (t === 'gmail') {
      const user = process.env.GMAIL_USER!;
      gmail ??= nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user, pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, '') },
      });
      await gmail.sendMail({ from: `Factor OTC <${user}>`, to, subject, html });
      return { success: true };
    }
    const from = `Factor OTC <${process.env.RESEND_FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'onboarding@resend.dev'}>`;
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, subject, html });
    return error ? { success: false, error: error.message } : { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Gmail retorna 535 si la contrasenya d'aplicació no és bona
    return { success: false, error: /535|Invalid login|BadCredentials/i.test(msg)
      ? 'Gmail ha rebutjat la contrasenya d\'aplicació (GMAIL_APP_PASSWORD)' : msg };
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Plantilla clara (mateixa paleta que el portal del client). */
function base(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="ca"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2a26;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8e5;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #eef1ef;">
  <span style="font-size:16px;font-weight:700;color:#1e4d3f;">Factor</span>
  <span style="font-size:16px;font-weight:400;color:#5f6b66;margin-left:4px;">OTC</span>
</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6;color:#33403b;">${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #eef1ef;font-size:11px;line-height:1.5;color:#7a8681;">
  Factor OTC · Planificació i seguiment financer. Factor OTC no és un banc i no mou els teus diners.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

const h2 = (t: string) => `<h2 style="color:#1e4d3f;font-size:20px;margin:0 0 14px;">${t}</h2>`;
const p_ = (t: string) => `<p style="margin:0 0 12px;">${t}</p>`;
const small = (t: string) => `<p style="margin:16px 0 0;font-size:13px;color:#7a8681;">${t}</p>`;
const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;margin:12px 0 4px;padding:12px 24px;background:#1e4d3f;color:#ffffff;font-weight:600;border-radius:8px;text-decoration:none;">${label}</a>`;

export async function sendWelcomeEmail(to: string, name: string): Promise<EmailResult> {
  const subject = 'Benvingut/da a Factor OTC';
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Benvingut/da, ${name}!</h2>
    <p style="color:#33403b;line-height:1.6;">El teu compte a Factor OTC ja és actiu. Ara pots accedir a la teva zona privada i consultar la teva cartera d'inversió.</p>
    <a href="${appUrl()}/login" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#1e4d3f;color:#ffffff;font-weight:700;border-radius:10px;text-decoration:none;">Accedir ara</a>
    <p style="color:#7a8681;font-size:13px;">Si tens qualsevol dubte, respon a aquest email.</p>`;
  return deliver(to, subject, base(subject, body));
}

export async function sendPaymentConfirmation(to: string, name: string, product: string, amount: number): Promise<EmailResult> {
  const subject = `Confirmació de pagament — ${product}`;
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Pagament confirmat</h2>
    <p style="color:#33403b;line-height:1.6;">Hola ${name}, hem rebut el teu pagament correctament.</p>
    <table style="width:100%;border:1px solid #e3e8e5;border-radius:10px;padding:20px;margin:20px 0;background:#f7f9f8;">
      <tr><td style="color:#7a8681;font-size:13px;">Producte</td><td style="color:#1f2a26;text-align:right;font-weight:600;">${product}</td></tr>
      <tr><td style="color:#7a8681;font-size:13px;padding-top:8px;">Import</td><td style="color:#1e4d3f;text-align:right;font-weight:700;padding-top:8px;">${amount.toFixed(2)} €</td></tr>
    </table>
    <p style="color:#7a8681;font-size:13px;">Guarda aquest email com a comprovant del pagament.</p>`;
  return deliver(to, subject, base(subject, body));
}

/**
 * Enllaç a una pàgina del portal passant per l'inici de sessió, amb l'usuari ja escrit.
 * Si el client ja té la sessió oberta, /login el porta directament a la pàgina.
 */
export function portalLink(path: string, username?: string): string {
  const q = new URLSearchParams({ callbackUrl: path });
  if (username) q.set('usuari', username);
  return `${appUrl()}/login?${q.toString()}`;
}

/** Recordatori d'accés al peu dels avisos: amb quin usuari s'entra i què fer si no recorda la contrasenya. */
function accessHint(username?: string): string {
  return small(`${username ? `Per entrar, el teu usuari és <strong>${esc(username)}</strong>. ` : ''}Si no recordes la contrasenya, <a href="${appUrl()}/recuperar" style="color:#1e4d3f;">tria'n una de nova aquí</a>.`);
}

/** L'assessor ha enviat l'informe inicial: ja el pot veure al portal. */
export async function sendReportReady(to: string, name: string, username?: string): Promise<EmailResult> {
  const subject = 'El teu informe inicial ja està llest';
  const first = esc(name.split(' ')[0] || name);
  const body = `${h2(`Hola, ${first}`)}
    ${p_('El teu assessor t\'ha preparat l\'informe inicial: la foto de la teva situació, els teus objectius i la proposta de cartera.')}
    ${p_('A partir d\'ara també tens accés a tot el teu portal.')}
    ${button(portalLink('/client/informe-inicial', username), 'Veure l\'informe')}
    ${accessHint(username)}
    ${small('Si tens cap dubte, respon a aquest correu i en parlem abans que decideixis res.')}`;
  return deliver(to, subject, base(subject, body));
}
export async function sendAccessRequestConfirmation(to: string, name: string): Promise<EmailResult> {
  const subject = 'Hem rebut la teva sol·licitud d\'accés';
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Sol·licitud rebuda, ${name}!</h2>
    <p style="color:#33403b;line-height:1.6;">Hem rebut la teva sol·licitud d'accés a Factor OTC. El nostre equip la revisarà aviat i et contactarà en les properes 24–48 hores.</p>
    <div style="margin:24px 0;padding:16px;background:#eef5f1;border:1px solid #cfe1d8;border-radius:10px;">
      <p style="color:#7a8681;font-size:13px;margin:0;">Mentre tant, pots consultar les nostres <strong style="color:#1e4d3f;">carteres model</strong> i els darrers <strong style="color:#1e4d3f;">informes de mercat</strong> a la nostra web.</p>
    </div>
    <p style="color:#7a8681;font-size:13px;">Si tens qualsevol dubte, respon directament a aquest email.</p>`;
  return deliver(to, subject, base(subject, body));
}

export async function sendQuestionnaireReceivedToAdmin(lead: {
  name: string;
  email: string;
  profile?: string;
  leadId: string;
}): Promise<EmailResult> {
  const subject = `Qüestionari completat: ${lead.name}`;
  const row = (label: string, val: string, highlight = false) =>
    `<tr><td style="color:#7a8681;font-size:12px;padding:5px 8px;white-space:nowrap;">${label}</td><td style="color:${highlight ? '#1e4d3f' : '#1f2a26'};padding:5px 8px;">${val}</td></tr>`;
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Qüestionari de perfil completat</h2>
    <table style="width:100%;border:1px solid #e3e8e5;border-radius:10px;overflow:hidden;background:#f7f9f8;">
      ${row('Nom', lead.name)}
      ${row('Email', `<a href="mailto:${lead.email}" style="color:#1e4d3f;">${lead.email}</a>`, true)}
      ${lead.profile ? row('Perfil calculat', lead.profile, true) : ''}
      ${row('ID Lead', lead.leadId)}
    </table>
    <a href="${appUrl()}/admin" style="display:inline-block;margin:24px 0;padding:10px 24px;background:#1e4d3f;border:1px solid #1e4d3f;color:#ffffff;font-weight:600;border-radius:10px;text-decoration:none;">Veure al panell admin →</a>`;
  return deliver(ADMIN_EMAIL, subject, base(subject, body));
}

export async function sendMonthlyReportAvailable(to: string, name: string, period: string, username?: string): Promise<EmailResult> {
  const subject = `El teu informe mensual ja és disponible (${period})`;
  const first = esc(name.split(' ')[0] || name);
  const body = `${h2(`Hola, ${first}`)}
    ${p_(`Ja tens l'informe mensual (<strong>${esc(period)}</strong>): quant val la teva cartera, com ha anat el mes i el comentari del teu assessor.`)}
    ${button(portalLink('/client/cartera', username), 'Veure l\'informe')}
    ${accessHint(username)}
    ${small('Si tens cap pregunta sobre l\'informe, respon a aquest correu.')}`;
  return deliver(to, subject, base(subject, body));
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
  const originLabel = lead.type === 'questionnaire'   ? 'Qüestionari completat'
    : lead.type === 'report-request' ? "Sol·licitud d'informe"
    : lead.source ?? lead.type ?? 'Formulari';
  const row = (label: string, val: string, highlight = false) =>
    `<tr><td style="color:#7a8681;font-size:12px;padding:5px 8px;white-space:nowrap;">${label}</td><td style="color:${highlight ? '#1e4d3f' : '#1f2a26'};padding:5px 8px;">${val}</td></tr>`;
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Nou lead capturat</h2>
    <table style="width:100%;border:1px solid #e3e8e5;border-radius:10px;overflow:hidden;background:#f7f9f8;">
      ${row('Nom', fullName)}
      ${row('Email', `<a href="mailto:${lead.email}" style="color:#1e4d3f;">${lead.email}</a>`, true)}
      ${lead.phone ? row('Telèfon', lead.phone) : ''}
      ${row('Origen', originLabel)}
      ${lead.profile ? row('Perfil', lead.profile) : ''}
      ${row('Interès', lead.interest)}
    </table>
    <a href="${appUrl()}/admin" style="display:inline-block;margin:24px 0;padding:10px 24px;background:#1e4d3f;border:1px solid #1e4d3f;color:#ffffff;font-weight:600;border-radius:10px;text-decoration:none;">Gestionar al panell admin →</a>`;
  return deliver(ADMIN_EMAIL, subject, base(subject, body));
}

export async function sendDeletionRequestToAdmin(req: { userId: string; email: string; name: string; reason?: string }): Promise<EmailResult> {
  const subject = `Sol·licitud d'eliminació de dades: ${req.name}`;
  const body = `
    <h2 style="color:#1e4d3f;margin:0 0 16px;">Sol·licitud d'eliminació de dades (RGPD art. 17)</h2>
    <p style="color:#33403b;">El client <strong>${esc(req.name)}</strong> (${esc(req.email)}, usuari ${esc(req.userId)}) demana esborrar les seves dades.</p>
    ${req.reason ? `<p style="color:#33403b;">Motiu: ${esc(req.reason)}</p>` : ''}
    <p style="color:#7a8681;font-size:13px;">Termini per respondre: 1 mes (RGPD art. 12.3). Comprova abans si alguna llei obliga a conservar part de les dades.</p>`;
  return deliver(ADMIN_EMAIL, subject, base(subject, body));
}

/** Benvinguda amb l'enllaç per crear la contrasenya (el client la tria; ningú més la sap). */
export async function sendBetaWelcome(to: string, name: string, username: string, activationUrl?: string): Promise<EmailResult> {
  const subject = 'Benvingut/da a la beta de Factor OTC';
  const first = esc(name.split(' ')[0] || name);
  const body = `${h2(`Hola, ${first}!`)}
    ${p_('Ja tens el compte a la beta privada de Factor OTC. Primer explica\'ns la teva situació a «Les meves finances» (o envia\'ns l\'Excel): amb això et preparem l\'informe inicial.')}
    ${p_(`El teu usuari és <strong>${esc(username)}</strong>.`)}
    ${activationUrl
      ? `${p_('Per entrar, primer tria la teva contrasenya amb aquest botó. L\'enllaç és personal, val 7 dies i només es pot fer servir una vegada.')}
         ${button(activationUrl, 'Crear la meva contrasenya')}`
      : button(`${appUrl()}/login`, 'Entrar a l\'app')}
    ${small('Pots entrar des de l\'ordinador o el mòbil. Comprova sempre que l\'adreça del navegador és la de Factor OTC i que hi surt el cadenat. Nosaltres mai et demanarem la contrasenya.')}
    ${small('El primer cop et demanarem que acceptis com tractem les teves dades. Si tens dubtes, respon a aquest correu.')}`;
  return deliver(to, subject, base(subject, body));
}

/** Enllaç per canviar la contrasenya oblidada (val 1 hora). */
export async function sendPasswordReset(to: string, name: string, resetUrl: string): Promise<EmailResult> {
  const subject = 'Canvia la teva contrasenya de Factor OTC';
  const first = esc(name.split(' ')[0] || name);
  const body = `${h2(`Hola, ${first}`)}
    ${p_('Hem rebut una petició per canviar la contrasenya del teu compte. Si l\'has feta tu, prem el botó. L\'enllaç val 1 hora i només es pot fer servir una vegada.')}
    ${button(resetUrl, 'Triar una contrasenya nova')}
    ${small('Si no has demanat res, ignora aquest correu: la teva contrasenya no canviarà.')}`;
  return deliver(to, subject, base(subject, body));
}
