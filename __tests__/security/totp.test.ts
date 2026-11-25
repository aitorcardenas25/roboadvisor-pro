import { describe, it, expect, beforeAll } from 'vitest';
import { hotp, totp, verifyTotp, base32Encode, base32Decode, newTotpSecret, encryptSecret, decryptSecret, consumeStep, otpauthUrl } from '@/lib/totp';

beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-1234567890-abcdefghij'; });

// Vectors oficials: RFC 4226 annex D (secret ASCII "12345678901234567890")
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it('HOTP coincideix amb els vectors de l\'RFC 4226', () => {
    expect([0, 1, 2, 3, 9].map(c => hotp(RFC_SECRET, c))).toEqual(['755224', '287082', '359152', '969429', '520489']);
  });

  it('TOTP coincideix amb l\'RFC 6238 (SHA1, 6 xifres)', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082');
    expect(totp(RFC_SECRET, 1111111109_000)).toBe('081804');
    expect(totp(RFC_SECRET, 1234567890_000)).toBe('005924');
  });

  it('accepta ±30 s i rebutja codis vells, mal formats o d\'un altre secret', () => {
    const t = 1_800_000_000_000;
    const s = newTotpSecret();
    expect(verifyTotp(s, totp(s, t), t)).not.toBeNull();
    expect(verifyTotp(s, totp(s, t - 30_000), t)).not.toBeNull();
    expect(verifyTotp(s, totp(s, t - 90_000), t)).toBeNull();
    expect(verifyTotp(s, '12345', t)).toBeNull();
    expect(verifyTotp(newTotpSecret(), totp(s, t), t)).toBeNull();
    expect(verifyTotp(s, totp(s, t).replace(/(\d{3})/, '$1 '), t)).not.toBeNull();   // "123 456"
  });

  it('un codi no es pot reutilitzar', () => {
    expect(consumeStep('u-reuse', 100)).toBe(true);
    expect(consumeStep('u-reuse', 100)).toBe(false);
    expect(consumeStep('u-reuse', 101)).toBe(true);
  });

  it('base32 d\'anada i tornada i secret de 160 bits', () => {
    const s = newTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it('el secret es desa xifrat i no es pot llegir amb una altra clau', () => {
    const s = newTotpSecret();
    const enc = encryptSecret(s);
    expect(enc).not.toContain(s);
    expect(decryptSecret(enc)).toBe(s);
    process.env.NEXTAUTH_SECRET = 'una-altra-clau-1234567890-xyz';
    expect(decryptSecret(enc)).toBeNull();
    process.env.NEXTAUTH_SECRET = 'test-secret-1234567890-abcdefghij';
  });

  it('adreça otpauth per al QR', () => {
    expect(otpauthUrl('ABC', 'aitor')).toBe('otpauth://totp/Factor%20OTC%3Aaitor?secret=ABC&issuer=Factor%20OTC&algorithm=SHA1&digits=6&period=30');
  });
});
