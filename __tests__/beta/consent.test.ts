import { describe, it, expect, beforeEach } from 'vitest';
import { consentText, getConsent, saveConsent, getConsentDates, CONSENT_VERSION, __resetConsentsForTests } from '@/lib/betaConsent';

describe('consentText', () => {
  it('cobreix els punts mínims de l\'art. 13 RGPD i diu que no és assessorament', () => {
    const t = consentText({});
    const titles = t.sections.map(s => s.title);
    for (const k of ['Qui és el responsable', 'Per a què', 'Base legal', 'Qui més hi té accés', 'Quant de temps', 'Els teus drets']) {
      expect(titles.some(x => x.startsWith(k))).toBe(true);
    }
    expect(t.sections.map(s => s.body).join(' ')).toContain('No és assessorament financer');
    expect(t.version).toBe(CONSENT_VERSION);
  });

  it('agafa responsable, contacte i conservació de les variables d\'entorn', () => {
    const t = consentText({ PRIVACY_CONTROLLER: 'Persona X, NIF 0000', PRIVACY_CONTACT_EMAIL: 'hola@exemple.cat', BETA_RETENTION_TEXT: '6 mesos' });
    const all = t.sections.map(s => s.body).join(' ');
    expect(all).toContain('Persona X, NIF 0000');
    expect(all).toContain('hola@exemple.cat');
    expect(t.sections.find(s => s.title === 'Quant de temps')!.body).toBe('6 mesos');
  });
});

describe('registre de consentiment (memòria)', () => {
  beforeEach(() => __resetConsentsForTests());

  it('sense registre, cal consentiment', async () => {
    expect(await getConsent('u1')).toBeNull();
  });

  it('desa data i opció d\'enquesta', async () => {
    await saveConsent({ userId: 'u1', version: CONSENT_VERSION, acceptedAt: '2026-11-09T10:00:00Z', surveyOptIn: true });
    expect(await getConsent('u1')).toMatchObject({ acceptedAt: '2026-11-09T10:00:00Z', surveyOptIn: true });
    expect(await getConsentDates()).toEqual({ u1: '2026-11-09T10:00:00Z' });
  });

  it('una versió nova del text torna a demanar el consentiment', async () => {
    await saveConsent({ userId: 'u1', version: 'beta-antiga', acceptedAt: '2026-10-01T10:00:00Z', surveyOptIn: false });
    expect(await getConsent('u1')).toBeNull();
  });
});
