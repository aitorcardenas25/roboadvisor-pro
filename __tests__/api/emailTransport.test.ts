import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn();
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) } }));

const ENV = { ...process.env };
beforeEach(() => { vi.resetModules(); sendMail.mockReset(); delete process.env.GMAIL_USER; delete process.env.GMAIL_APP_PASSWORD; delete process.env.RESEND_API_KEY; });
afterEach(() => { process.env = { ...ENV }; });

describe('enviament de correus', () => {
  it('sense configuració no envia i ho diu clar', async () => {
    const m = await import('@/lib/emails');
    expect(m.emailTransport()).toBeNull();
    expect(await m.sendReportReady('a@example.test', 'Pau')).toEqual({ success: false, error: m.NO_KEY_ERROR });
  });

  it('amb Gmail envia des de GMAIL_USER i l\'enllaç va al portal', async () => {
    process.env.GMAIL_USER = 'remitent@example.test';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    process.env.APP_URL = 'https://app.example.test/';
    sendMail.mockResolvedValue({});
    const m = await import('@/lib/emails');
    expect(m.emailTransport()).toBe('gmail');
    expect(await m.sendReportReady('a@example.test', 'Pau', 'pau')).toEqual({ success: true });
    const arg = sendMail.mock.calls[0][0];
    expect(arg.from).toBe('Factor OTC <remitent@example.test>');
    expect(arg.to).toBe('a@example.test');
    // Passa per l'inici de sessió amb l'usuari ja escrit, i explica com recuperar la contrasenya
    expect(arg.html).toContain('https://app.example.test/login?callbackUrl=%2Fclient%2Finforme-inicial&usuari=pau');
    expect(arg.html).toContain('<strong>pau</strong>');
    expect(arg.html).toContain('https://app.example.test/recuperar');
  });

  it('contrasenya d\'aplicació rebutjada → missatge entenedor', async () => {
    process.env.GMAIL_USER = 'remitent@example.test';
    process.env.GMAIL_APP_PASSWORD = 'dolenta';
    sendMail.mockRejectedValue(new Error('535-5.7.8 Username and Password not accepted. BadCredentials'));
    const m = await import('@/lib/emails');
    const r = await m.sendMonthlyReportAvailable('a@example.test', 'Pau', 'octubre de 2026');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/GMAIL_APP_PASSWORD/);
  });
});
