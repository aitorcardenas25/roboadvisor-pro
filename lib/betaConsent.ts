// lib/betaConsent.ts
// Consentiment de la beta privada (RGPD art. 6.1.a i 7): el client l'accepta
// al primer accés i queda registrat amb data i versió del text.
// Text basat en l'esborrany per a l'advocat (9/11/2026). PENDENT DE REVISIÓ LEGAL:
// responsable amb NIF i termini de conservació es configuren per variables d'entorn.
import { getDb } from './supabase';

/** Canviar la versió obliga tots els clients a tornar a acceptar. */
export const CONSENT_VERSION = 'beta-2026-11-v1';

export interface ConsentSection { title: string; body: string }

export function consentText(env: Record<string, string | undefined> = process.env): {
  version: string; title: string; sections: ConsentSection[]; dataLabel: string; surveyLabel: string;
} {
  const controller = env.PRIVACY_CONTROLLER?.trim() || 'Aitor Cárdenas Castillo, que opera amb el nom FACTOR OTC';
  const contact    = env.PRIVACY_CONTACT_EMAIL?.trim() || 'privacitat@factorotc.com';
  const retention  = env.BETA_RETENTION_TEXT?.trim()
    || 'Mentre duri la beta (3 mesos). Si no continues, les esborrem en acabar-la.';
  return {
    version: CONSENT_VERSION,
    title: 'Beta privada · Informació sobre protecció de dades',
    sections: [
      { title: 'Qui és el responsable', body: `${controller}. Contacte: ${contact}.` },
      { title: 'Per a què farem servir les teves dades', body: 'Per mostrar-te una anàlisi del teu pressupost, del fons d\'emergència i dels teus objectius dins l\'app, i per demanar-te la teva opinió sobre l\'eina durant la beta. També registrem quan entres a l\'app per saber si l\'eina és útil.' },
      { title: 'Quines dades', body: 'Identificació i contacte; les dades econòmiques que tu ens facilitis (ingressos, despeses, estalvis, deutes, objectius, inversions); quan entres a l\'app; les teves respostes a l\'enquesta mensual.' },
      { title: 'Base legal', body: 'El teu consentiment, que pots retirar quan vulguis sense cap conseqüència.' },
      { title: 'Qui més hi té accés', body: 'Proveïdors tecnològics que guarden o envien les dades per encàrrec nostre: Supabase (base de dades), Vercel (allotjament) i Resend (correu). Alguns poden tractar dades fora de la UE, amb les garanties previstes al RGPD. No venem ni cedim les teves dades a ningú.' },
      { title: 'Quant de temps', body: retention },
      { title: 'Els teus drets', body: `Accés, rectificació, supressió, oposició, limitació i portabilitat, escrivint a ${contact} o des de "Les meves finances". També pots reclamar a l'Agència Espanyola de Protecció de Dades (aepd.es).` },
      { title: 'Important', body: 'L\'app mostra informació descriptiva i càlculs amb les dades que tu ens dones. No és assessorament financer.' },
    ],
    dataLabel:   'He llegit aquesta informació i accepto que FACTOR OTC tracti les meves dades per a la beta.',
    surveyLabel: 'Accepto rebre l\'enquesta mensual per correu o WhatsApp (opcional).',
  };
}

export interface ConsentRecord { userId: string; version: string; acceptedAt: string; surveyOptIn: boolean }

const _mem = new Map<string, ConsentRecord>();

/** Darrer consentiment del client per a la versió vigent, o null. */
export async function getConsent(userId: string, version = CONSENT_VERSION): Promise<ConsentRecord | null> {
  const db = getDb();
  if (!db) {
    const r = _mem.get(userId);
    return r && r.version === version ? r : null;
  }
  const { data, error } = await db.from('client_consents').select('*')
    .eq('user_id', userId).eq('version', version).order('accepted_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return { userId, version, acceptedAt: String(data.accepted_at), surveyOptIn: Boolean(data.survey_opt_in) };
}

export async function saveConsent(rec: ConsentRecord & { ip?: string | null }): Promise<boolean> {
  const db = getDb();
  if (!db) { _mem.set(rec.userId, { userId: rec.userId, version: rec.version, acceptedAt: rec.acceptedAt, surveyOptIn: rec.surveyOptIn }); return true; }
  const { error } = await db.from('client_consents').insert({
    id: `consent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: rec.userId, version: rec.version, accepted_at: rec.acceptedAt,
    survey_opt_in: rec.surveyOptIn, ip: rec.ip ?? null,
  });
  return !error;
}

/** Data d'acceptació per client (versió vigent), per al panell de la beta. */
export async function getConsentDates(version = CONSENT_VERSION): Promise<Record<string, string>> {
  const db = getDb();
  if (!db) {
    const out: Record<string, string> = {};
    for (const r of _mem.values()) if (r.version === version) out[r.userId] = r.acceptedAt;
    return out;
  }
  const { data, error } = await db.from('client_consents').select('user_id,accepted_at').eq('version', version);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const r of data) {
    const id = String(r.user_id), at = String(r.accepted_at);
    if (!out[id] || at < out[id]) out[id] = at;
  }
  return out;
}

export function __resetConsentsForTests() { _mem.clear(); }
