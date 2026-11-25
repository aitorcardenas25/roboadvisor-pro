// lib/passwordLink.ts — enllaços per crear o canviar la contrasenya.
//
// L'administrador no ha de saber ni enviar mai la contrasenya d'un client:
// el client rep un enllaç (per correu o, si cal, per WhatsApp) i la tria ell.
//
// L'enllaç porta un testimoni signat amb HMAC-SHA256 (NEXTAUTH_SECRET):
//   - qui és (id de l'usuari) i per a què és ('activar' o 'recuperar'),
//   - fins quan val (activar: 7 dies; recuperar: 1 hora),
//   - una empremta del hash de la contrasenya actual. Quan el client posa una
//     contrasenya nova, el hash canvia i l'enllaç deixa de valer: és d'un sol ús.
// No cal cap taula nova a la base de dades.
// Referència: OWASP Forgot Password Cheat Sheet (testimonis d'un sol ús,
// caducitat curta, resposta igual tant si el compte existeix com si no).
import { createHmac, createHash, timingSafeEqual } from 'crypto';

export type PasswordLinkPurpose = 'activar' | 'recuperar';

export const LINK_TTL_MS: Record<PasswordLinkPurpose, number> = {
  activar:   7 * 24 * 60 * 60 * 1000,
  recuperar: 60 * 60 * 1000,
};

interface Payload { u: string; p: PasswordLinkPurpose; e: number; f: string }

const b64 = (s: Buffer | string) => Buffer.from(s).toString('base64url');

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) throw new Error('NEXTAUTH_SECRET no configurat');
  return s;
}

const fingerprint = (stamp: string) => createHash('sha256').update(stamp).digest('base64url').slice(0, 22);
const sign = (data: string) => createHmac('sha256', secret()).update(data).digest('base64url');

export function createPasswordToken(userId: string, stamp: string, purpose: PasswordLinkPurpose, now = Date.now()): string {
  const payload: Payload = { u: userId, p: purpose, e: now + LINK_TTL_MS[purpose], f: fingerprint(stamp) };
  const data = b64(JSON.stringify(payload));
  return `${data}.${sign(data)}`;
}

export type TokenCheck =
  | { ok: true; userId: string; purpose: PasswordLinkPurpose; expiresAt: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/** Comprova el testimoni. `stampOf` retorna l'estat actual de la contrasenya de l'usuari (null si no existeix o està desactivat). */
export async function verifyPasswordToken(
  token: string,
  stampOf: (userId: string) => Promise<string | null>,
  now = Date.now(),
): Promise<TokenCheck> {
  const [data, sig] = String(token ?? '').split('.');
  if (!data || !sig) return { ok: false, reason: 'invalid' };
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: 'invalid' };
  let p: Payload;
  try { p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as Payload; }
  catch { return { ok: false, reason: 'invalid' }; }
  if (!p?.u || (p.p !== 'activar' && p.p !== 'recuperar') || typeof p.e !== 'number') return { ok: false, reason: 'invalid' };
  if (p.e < now) return { ok: false, reason: 'expired' };
  const stamp = await stampOf(p.u);
  if (!stamp) return { ok: false, reason: 'invalid' };
  if (fingerprint(stamp) !== p.f) return { ok: false, reason: 'used' };
  return { ok: true, userId: p.u, purpose: p.p, expiresAt: p.e };
}

/** Regles mínimes de contrasenya (NIST SP 800-63B §5.1.1: llargada, no límits de caràcters, no comunes). */
const COMMON = ['contrasenya', 'password', '1234567890', '0123456789', 'qwertyuiop', 'factorotc', 'abcdefghij'];
export function passwordProblem(password: string, username?: string): string | null {
  if (password.length < 10) return 'Ha de tenir com a mínim 10 caràcters.';
  if (password.length > 200) return 'És massa llarga.';
  const low = password.toLowerCase();
  if (username && username.length >= 3 && low.includes(username.toLowerCase())) return 'No pot contenir el teu nom d\'usuari.';
  if (COMMON.some(c => low.includes(c)) || /^(.)\1+$/.test(password)) return 'És massa fàcil d\'endevinar. Prova una frase de 3 o 4 paraules.';
  return null;
}
