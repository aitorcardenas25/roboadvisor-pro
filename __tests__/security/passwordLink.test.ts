import { describe, it, expect, beforeAll } from 'vitest';
import { createPasswordToken, verifyPasswordToken, passwordProblem, LINK_TTL_MS } from '@/lib/passwordLink';

beforeAll(() => { process.env.NEXTAUTH_SECRET = 'test-secret-1234567890-abcdefghij'; });

const NOW = Date.UTC(2026, 10, 25, 12);
const stamps: Record<string, string | null> = { u1: '$2a$12$hashAntic' };
const stampOf = async (id: string) => stamps[id] ?? null;

describe('enllaç de contrasenya', () => {
  it('val per a l\'usuari i el propòsit amb què s\'ha creat', async () => {
    const t = createPasswordToken('u1', stamps.u1!, 'activar', NOW);
    expect(await verifyPasswordToken(t, stampOf, NOW + 1000)).toMatchObject({ ok: true, userId: 'u1', purpose: 'activar' });
  });

  it('caduca: activar 7 dies, recuperar 1 hora', async () => {
    const a = createPasswordToken('u1', stamps.u1!, 'activar', NOW);
    const r = createPasswordToken('u1', stamps.u1!, 'recuperar', NOW);
    expect((await verifyPasswordToken(a, stampOf, NOW + LINK_TTL_MS.activar - 1)).ok).toBe(true);
    expect(await verifyPasswordToken(a, stampOf, NOW + LINK_TTL_MS.activar + 1)).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyPasswordToken(r, stampOf, NOW + 61 * 60_000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('és d\'un sol ús: quan canvia la contrasenya, deixa de valer', async () => {
    const t = createPasswordToken('u1', stamps.u1!, 'activar', NOW);
    const after = async () => '$2a$12$hashNou';
    expect(await verifyPasswordToken(t, after, NOW + 1000)).toEqual({ ok: false, reason: 'used' });
  });

  it('no es pot falsificar ni canviar d\'usuari', async () => {
    const t = createPasswordToken('u1', stamps.u1!, 'activar', NOW);
    const [data, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, 'base64url').toString()), u: 'admin' })).toString('base64url');
    expect(await verifyPasswordToken(`${forged}.${sig}`, stampOf, NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyPasswordToken('basura', stampOf, NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyPasswordToken(`${data}.${sig.slice(0, -2)}xx`, stampOf, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('un usuari desactivat o esborrat no el pot fer servir', async () => {
    const t = createPasswordToken('u2', 'x', 'recuperar', NOW);
    expect(await verifyPasswordToken(t, stampOf, NOW)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('regles de contrasenya', () => {
    expect(passwordProblem('curta')).toMatch(/10/);
    expect(passwordProblem('pau.prova-2026', 'pau.prova')).toMatch(/usuari/);
    expect(passwordProblem('password123456')).toMatch(/fàcil/);
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/fàcil/);
    expect(passwordProblem('gat verd salta el riu')).toBeNull();
  });
});
