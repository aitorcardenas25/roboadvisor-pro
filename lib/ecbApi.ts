/**
 * ECB Statistical Data Warehouse — risk-free rate (€STR / Eonia)
 *
 * Primary series: €STR (Euro Short-Term Rate), key policy rate proxy
 * Fallback series: ECB deposit facility rate
 * Hard fallback: 3.0% (approximate current ECB deposit rate)
 */

const ECB_BASE = 'https://data-api.ecb.europa.eu/service/data';

// €STR: overnight rate, best proxy for EUR risk-free
const ESTR_SERIES = 'EST/B.EU000A2X2A25.WT';
// ECB deposit facility rate (monthly, end-of-period)
const DEPOSIT_SERIES = 'FM/B.U2.EUR.RT.MM.EURIBOR1MD_.HSTA';

const HARD_FALLBACK_RATE = 3.0; // %

interface EcbObservation {
  date: string;
  value: number;
}

async function fetchLatestObservation(series: string): Promise<number | null> {
  const url = `${ECB_BASE}/${series}?lastNObservations=1&format=jsondata`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 86400 }, // cache 24h in Next.js
    });
    if (!res.ok) return null;
    const json = await res.json();
    const obs: Record<string, (number | null)[]> =
      json?.dataSets?.[0]?.series?.['0:0:0']?.observations ?? {};
    const entries = Object.values(obs);
    if (!entries.length) return null;
    const last = entries[entries.length - 1];
    const val = last?.[0];
    if (val == null) return null;
    return val;
  } catch {
    return null;
  }
}

/**
 * Returns the current EUR risk-free rate as an annual percentage (e.g. 3.15).
 * Tries €STR → ECB deposit rate → hard fallback in that order.
 */
export async function getRiskFreeRate(): Promise<number> {
  const estr = await fetchLatestObservation(ESTR_SERIES);
  if (estr !== null && isFinite(estr)) return estr;

  const deposit = await fetchLatestObservation(DEPOSIT_SERIES);
  if (deposit !== null && isFinite(deposit)) return deposit;

  return HARD_FALLBACK_RATE;
}

/**
 * Returns rate + metadata for display/audit purposes.
 */
export async function getRiskFreeRateWithMeta(): Promise<{
  rate: number;
  source: 'estr' | 'deposit' | 'fallback';
  fetchedAt: string;
}> {
  const fetchedAt = new Date().toISOString();

  const estr = await fetchLatestObservation(ESTR_SERIES);
  if (estr !== null && isFinite(estr)) {
    return { rate: estr, source: 'estr', fetchedAt };
  }

  const deposit = await fetchLatestObservation(DEPOSIT_SERIES);
  if (deposit !== null && isFinite(deposit)) {
    return { rate: deposit, source: 'deposit', fetchedAt };
  }

  return { rate: HARD_FALLBACK_RATE, source: 'fallback', fetchedAt };
}
