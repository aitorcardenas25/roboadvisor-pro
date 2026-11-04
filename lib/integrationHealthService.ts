import { getDb } from './supabase';

export type IntegrationStatus = 'ok' | 'missing_key' | 'error' | 'demo';

export interface IntegrationCheck {
  id:        string;
  name:      string;
  status:    IntegrationStatus;
  message:   string;
  action?:   string;
  keyHint?:  string;
  latencyMs?: number;
  checkedAt: string;
}

export interface HealthReport {
  checks:    IntegrationCheck[];
  checkedAt: string;
  overall:   'ok' | 'degraded' | 'error';
}

function maskKey(k: string | undefined): string | undefined {
  if (!k) return undefined;
  return k.length >= 8 ? `...${k.slice(-4)}` : '****';
}

async function checkSupabase(): Promise<IntegrationCheck> {
  const id = 'supabase'; const name = 'Supabase';
  const db = getDb();

  if (!db) {
    return { id, name, status: 'demo',
      message: 'Mode in-memory. Les dades no persisteixen entre reinicis.',
      action:  'Configura SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY al .env.local',
      checkedAt: new Date().toISOString() };
  }

  const start = Date.now();
  try {
    const { error } = await db.from('leads').select('id').limit(1);
    const latencyMs = Date.now() - start;
    if (error) return { id, name, status: 'error', message: `Error BD: ${error.message}`, latencyMs, checkedAt: new Date().toISOString() };
    return { id, name, status: 'ok', message: 'Connexió activa. Dades persistents.',
      keyHint: maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY), latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'No s\'ha pogut connectar a Supabase.',
      latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

async function checkFMP(): Promise<IntegrationCheck> {
  const id = 'fmp'; const name = 'Financial Modeling Prep';
  const key = process.env.FMP_API_KEY;

  if (!key) return { id, name, status: 'missing_key',
    message: 'Sense clau API. Dades de mercat simulades.',
    action:  'Configura FMP_API_KEY. Pla gratuït a financialmodelingprep.com',
    checkedAt: new Date().toISOString() };

  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`https://financialmodelingprep.com/api/v3/quote-short/AAPL?apikey=${key}`, { signal: ctrl.signal });
    clearTimeout(t);
    const latencyMs = Date.now() - start;

    if (res.status === 401 || res.status === 403) return { id, name, status: 'error',
      message: 'Clau API invàlida o sense permisos.', keyHint: maskKey(key), latencyMs, checkedAt: new Date().toISOString() };
    if (!res.ok) return { id, name, status: 'error', message: `Error HTTP ${res.status}`,
      keyHint: maskKey(key), latencyMs, checkedAt: new Date().toISOString() };

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { id, name, status: 'error',
      message: 'Resposta inesperada. Pot ser un límit de pla gratuït.',
      keyHint: maskKey(key), latencyMs, checkedAt: new Date().toISOString() };

    return { id, name, status: 'ok', message: 'Connexió activa. Dades reals de mercat disponibles.',
      keyHint: maskKey(key), latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'Timeout o error de xarxa.',
      keyHint: maskKey(key), latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

async function checkAlphaVantage(): Promise<IntegrationCheck> {
  const id = 'alphavantage'; const name = 'Alpha Vantage';
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  return key
    ? { id, name, status: 'ok', message: 'Clau configurada. Disponible com a font alternativa.',
        keyHint: maskKey(key), checkedAt: new Date().toISOString() }
    : { id, name, status: 'missing_key', message: 'No configurat. Opcional: fallback si FMP falla.',
        action: 'Configura ALPHA_VANTAGE_API_KEY (opcional). Gratuït a alphavantage.co',
        checkedAt: new Date().toISOString() };
}

async function checkResend(): Promise<IntegrationCheck> {
  const id = 'resend'; const name = 'Resend (Email)';
  const key = process.env.RESEND_API_KEY;

  if (!key) return { id, name, status: 'missing_key',
    message: 'Sense clau API. Emails no s\'enviaran (es registren per consola).',
    action:  'Configura RESEND_API_KEY. Pla gratuït a resend.com',
    checkedAt: new Date().toISOString() };

  const looksValid = key.startsWith('re_') && key.length > 10;
  return { id, name,
    status:  looksValid ? 'ok' : 'error',
    message: looksValid
      ? 'Clau API configurada. Enviament d\'emails actiu.'
      : 'Format invàlid. La clau Resend hauria de començar per "re_".',
    keyHint: maskKey(key),
    action:  looksValid ? undefined : 'Verifica RESEND_API_KEY al dashboard de resend.com',
    checkedAt: new Date().toISOString() };
}

async function checkStripe(): Promise<IntegrationCheck> {
  const id = 'stripe'; const name = 'Stripe (Pagaments)';
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) return { id, name, status: 'missing_key',
    message: 'Sense clau API. Pagaments no actius.',
    action:  'Configura STRIPE_SECRET_KEY per activar pagaments.',
    checkedAt: new Date().toISOString() };

  const issues: string[] = [];
  if (!process.env.STRIPE_WEBHOOK_SECRET)  issues.push('STRIPE_WEBHOOK_SECRET');
  const pi = process.env.STRIPE_PRICE_INITIAL_REPORT ?? '';
  const ps = process.env.STRIPE_PRICE_MONTHLY_SUB    ?? '';
  if (!pi || pi.includes('placeholder')) issues.push('STRIPE_PRICE_INITIAL_REPORT');
  if (!ps || ps.includes('placeholder')) issues.push('STRIPE_PRICE_MONTHLY_SUB');

  if (issues.length) return { id, name, status: 'error',
    message: `Clau present però manquen: ${issues.join(', ')}`,
    keyHint: maskKey(key),
    action:  'Configura els price IDs a Stripe Dashboard i el webhook secret.',
    checkedAt: new Date().toISOString() };

  return { id, name, status: 'ok', message: 'Clau API, prices i webhook configurats.',
    keyHint: maskKey(key), checkedAt: new Date().toISOString() };
}

async function checkNewsletter(): Promise<IntegrationCheck> {
  const id = 'newsletter'; const name = 'Newsletter';
  try {
    const db = getDb();
    let count = 0;
    if (db) {
      const { count: c } = await db
        .from('newsletter_subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      count = c ?? 0;
    }
    return { id, name, status: 'ok',
      message: db
        ? `${count} subscriptors actius. Dades persistents a Supabase.`
        : `${count} subscriptors actius. Mode in-memory (no persistents).`,
      checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'Error en obtenir subscriptors.', checkedAt: new Date().toISOString() };
  }
}

async function checkYahooFinance(): Promise<IntegrationCheck> {
  const id = 'yahoo'; const name = 'Yahoo Finance';
  // Yahoo Finance is a public endpoint with no API key. We just verify connectivity.
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d',
      { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    clearTimeout(t);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { id, name, status: 'error', message: `Error HTTP ${res.status}. Pot ser un bloqueig temporal.`, latencyMs, checkedAt: new Date().toISOString() };
    return { id, name, status: 'ok', message: 'Disponible. Font pública sense API key. S\'usa com a fallback si FMP i Alpha Vantage fallen.', latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'No s\'ha pogut connectar. Pot ser un bloqueig de xarxa temporal.', latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

async function checkECB(): Promise<IntegrationCheck> {
  const id = 'ecb'; const name = 'Banc Central Europeu (€STR)';
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      'https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=1&format=jsondata',
      { signal: ctrl.signal, headers: { Accept: 'application/json' } }
    );
    clearTimeout(t);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { id, name, status: 'error', message: `Error HTTP ${res.status}`, latencyMs, checkedAt: new Date().toISOString() };
    const json = await res.json();
    const obs = json?.dataSets?.[0]?.series?.['0:0:0']?.observations;
    if (!obs || !Object.keys(obs).length) return { id, name, status: 'error', message: 'Resposta buida de l\'ECB.', latencyMs, checkedAt: new Date().toISOString() };
    const rate = Object.values(obs as Record<string, (number | null)[]>)[0]?.[0];
    return { id, name, status: 'ok', message: `€STR actual: ${rate?.toFixed(3) ?? 'N/A'}%. S\'usa com a taxa lliure de risc per a càlculs CAPM i Sharpe.`, latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'Timeout o error de xarxa. Fallback a taxa hardcoded (3.0%).', latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

async function checkFrankfurter(): Promise<IntegrationCheck> {
  const id = 'frankfurter'; const name = 'Frankfurter (Divises)';
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF', { signal: ctrl.signal });
    clearTimeout(t);
    const latencyMs = Date.now() - start;
    if (!res.ok) return { id, name, status: 'error', message: `Error HTTP ${res.status}`, latencyMs, checkedAt: new Date().toISOString() };
    const json = await res.json();
    const usd = json?.rates?.USD?.toFixed(4) ?? 'N/A';
    return { id, name, status: 'ok', message: `EUR/USD: ${usd}. API gratuïta per a conversió de divises. Sense API key.`, latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { id, name, status: 'error', message: 'Timeout o error de xarxa.', latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

function checkTradingView(): IntegrationCheck {
  return {
    id:        'tradingview',
    name:      'TradingView',
    status:    'ok',
    message:   'Widgets de gràfics disponibles via scripts incrustats. Sense API key. S\'usa per a gràfics interactius de fons i accions.',
    checkedAt: new Date().toISOString(),
  };
}

export async function getIntegrationsHealth(): Promise<HealthReport> {
  const [supabase, fmp, alphavantage, yahoo, ecb, frankfurter, resend, stripe, newsletter] = await Promise.all([
    checkSupabase(),
    checkFMP(),
    checkAlphaVantage(),
    checkYahooFinance(),
    checkECB(),
    checkFrankfurter(),
    checkResend(),
    checkStripe(),
    checkNewsletter(),
  ]);
  const tradingview = checkTradingView();

  const checks = [supabase, fmp, alphavantage, yahoo, ecb, frankfurter, tradingview, resend, stripe, newsletter];
  const hasError   = checks.some(c => c.status === 'error');
  const hasMissing = checks.some(c => c.status === 'missing_key' || c.status === 'demo');

  return {
    checks,
    checkedAt: new Date().toISOString(),
    overall:   hasError ? 'error' : hasMissing ? 'degraded' : 'ok',
  };
}
