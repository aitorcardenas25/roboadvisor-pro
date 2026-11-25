// lib/totp.ts — verificació en dos passos per a l'administrador.
//
// Codis de 6 xifres que canvien cada 30 segons (TOTP, RFC 6238, sobre HOTP,
// RFC 4226, amb HMAC-SHA1), compatibles amb Google Authenticator, Microsoft
// Authenticator, 1Password, etc. S'accepta el codi anterior i el següent
// (±30 s) per si el rellotge del mòbil no va exacte.
//
// El secret es desa xifrat (AES-256-GCM amb una clau derivada de
// NEXTAUTH_SECRET): si algú llegís la base de dades no podria generar codis.
import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('Secret no vàlid');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Secret nou de 160 bits (la mida que recomana l'RFC 4226). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226 §5.3): truncament dinàmic a 6 xifres. */
export function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const code = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

export const totpStep = (now = Date.now()) => Math.floor(now / 30_000);
export const totp = (secret: string, now = Date.now()) => hotp(secret, totpStep(now));

/** Retorna el pas de temps del codi si és vàlid (±1 pas), o null. */
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  const c = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const step = totpStep(now);
  for (const d of [0, -1, 1]) {
    const expected = Buffer.from(hotp(secret, step + d));
    if (timingSafeEqual(expected, Buffer.from(c))) return step + d;
  }
  return null;
}

/** Adreça per al codi QR que llegeixen les apps d'autenticació. */
export function otpauthUrl(secret: string, account: string, issuer = 'Factor OTC'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ── Xifrat del secret en repòs ─────────────────────────────────────────────

function key(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) throw new Error('NEXTAUTH_SECRET no configurat');
  return createHash('sha256').update(`factor-otc-totp:${s}`).digest();
}

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, enc] = stored.split('.');
    if (v !== 'v1') return null;
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
  } catch { return null; }
}

// Un codi no es pot fer servir dues vegades (memòria de la instància; un atacant
// hauria de reutilitzar-lo dins els mateixos 90 segons).
const usedSteps = new Map<string, number>();
export function consumeStep(userId: string, step: number): boolean {
  const last = usedSteps.get(userId);
  if (last !== undefined && step <= last) return false;
  usedSteps.set(userId, step);
  return true;
}
