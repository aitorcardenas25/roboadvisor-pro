// Bitcoin declarat al patrimoni: preu diari (Kraken / CoinGecko / Bitstamp),
// valoració quantitat × tancament, i dades de risc (caiguda màxima, Magdon-Ismail & Atiya 2004).
// El bitcoin NO és a l'univers de fons: l'app no el recomana.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseKraken, parseBitstamp, parseCoinGecko, btcContext, checkContinuity, updateBtcPrices, getBtcSeries, _resetMemory,
} from '@/lib/cryptoPrices';
import { addItem, updateItem, listItems, consolidateWealth, WealthItemInputSchema } from '@/lib/wealth';
import { ADVISOR_FUNDS } from '@/lib/fundUniverse';

const TODAY = '2026-11-26';
const sec = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;

describe('lectura de les fonts de preu', () => {
  it('Kraken: tancament de cada dia i descarta el dia d\'avui (encara obert)', () => {
    const json = { error: [], result: { XXBTZEUR: [
      [sec('2026-11-24'), '80000.0', '81000', '79000', '80500.4', '80200', '100', 1000],
      [sec('2026-11-25'), '80500.4', '82000', '80000', '81234.567', '81000', '120', 1100],
      [sec('2026-11-26'), '81234.5', '81300', '81000', '81100.0', '81100', '5', 50],
    ], last: sec('2026-11-26') } };
    expect(parseKraken(json, TODAY)).toEqual([
      { date: '2026-11-24', close: 80500.4 }, { date: '2026-11-25', close: 81234.57 },
    ]);
  });

  it('Kraken: un error de l\'API és un error, no un preu', () => {
    expect(() => parseKraken({ error: ['EGeneral:Too many requests'] }, TODAY)).toThrow(/Too many/);
  });

  it('Bitstamp: format data.ohlc', () => {
    const json = { data: { pair: 'BTC/EUR', ohlc: [
      { timestamp: String(sec('2016-04-16')), open: '370', high: '375', low: '365', close: '371.5', volume: '10' },
    ] } };
    expect(parseBitstamp(json, TODAY)).toEqual([{ date: '2016-04-16', close: 371.5 }]);
  });

  it('CoinGecko: el punt de les 00:00 UTC és el tancament del dia anterior', () => {
    const json = { prices: [
      [Date.parse('2026-11-25T00:00:00Z'), 80500],
      [Date.parse('2026-11-26T00:00:00Z'), 81200],
      [Date.parse('2026-11-26T08:13:00Z'), 81500],   // preu en directe: no és un tancament
    ] };
    expect(parseCoinGecko(json, TODAY)).toEqual([{ date: '2026-11-24', close: 80500 }, { date: '2026-11-25', close: 81200 }]);
  });
});

describe('controls de qualitat', () => {
  it('rebutja un preu que no coincideix amb el desat el mateix dia', () => {
    expect(checkContinuity({ date: '2026-11-24', close: 80000 }, [{ date: '2026-11-24', close: 90000 }])).toMatch(/no coincideix/);
    expect(checkContinuity({ date: '2026-11-24', close: 80000 }, [{ date: '2026-11-24', close: 80100 }, { date: '2026-11-25', close: 79000 }])).toBeNull();
  });
  it('rebutja salts diaris no creïbles', () => {
    expect(checkContinuity({ date: '2026-11-24', close: 80000 }, [{ date: '2026-11-25', close: 8000 }])).toMatch(/salt/);
  });
});

describe('btcContext', () => {
  it('variació 12 mesos i caiguda màxima pic → vall', () => {
    const filler = Array.from({ length: 30 }, (_, i) => ({ date: `2023-01-${String(i + 1).padStart(2, '0')}`, close: 20000 }));
    const s = [
      { date: '2021-11-08', close: 58000 }, { date: '2022-11-21', close: 15000 }, ...filler,
      { date: '2025-11-25', close: 75000 }, { date: '2026-11-25', close: 90000 },
    ];
    const c = btcContext(s, 'Kraken')!;
    expect(c.price).toBe(90000);
    expect(c.change1yPct).toBe(20);
    expect(c.maxDrawdownPct).toBeCloseTo((15000 / 58000 - 1) * 100, 1);
    expect(c.maxDrawdownPeak).toBe('2021-11-08');
    expect(c.maxDrawdownTrough).toBe('2022-11-21');
    expect(c.fromAthPct).toBe(0);
  });
  it('sense preus no hi ha context', () => { expect(btcContext([])).toBeNull(); });
});

describe('actualització diària (sense Supabase: memòria)', () => {
  beforeEach(() => _resetMemory());

  const hist = Array.from({ length: 1200 }, (_, i) => {
    const d = new Date(Date.parse('2023-08-15T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
    return { timestamp: String(sec(d)), close: String(30000 + i * 10) };
  }).filter(r => Number(r.timestamp) < sec(TODAY));

  function fakeFetch(opts: { krakenFails?: boolean } = {}): typeof fetch {
    return (async (url: string | URL) => {
      const u = String(url);
      const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (u.includes('bitstamp')) {
        const end = Number(new URL(u).searchParams.get('end'));
        return ok({ data: { ohlc: hist.filter(r => Number(r.timestamp) <= end).slice(-1000) } });
      }
      if (u.includes('kraken')) {
        if (opts.krakenFails) return new Response('down', { status: 503 });
        return ok({ error: [], result: { XXBTZEUR: hist.slice(-5).map(r => [Number(r.timestamp), '0', '0', '0', r.close, '0', '0', 0]) } });
      }
      if (u.includes('coingecko')) {
        return ok({ prices: hist.slice(-3).map(r => [(Number(r.timestamp) + 86_400) * 1000, Number(r.close)]) });
      }
      return new Response('?', { status: 404 });
    }) as typeof fetch;
  }

  it('primera vegada: carrega l\'històric complet i després els dies nous', async () => {
    const r = await updateBtcPrices({ fetchFn: fakeFetch(), now: new Date(`${TODAY}T12:00:00Z`) });
    expect(r.status).toBe('updated');
    expect(r.lastDate).toBe('2026-11-25');
    expect((await getBtcSeries()).length).toBe(hist.length);
    const again = await updateBtcPrices({ fetchFn: fakeFetch(), now: new Date(`${TODAY}T12:00:00Z`) });
    expect(again.status).toBe('up_to_date');
  });

  it('si Kraken falla, fa servir CoinGecko', async () => {
    const r = await updateBtcPrices({ fetchFn: fakeFetch({ krakenFails: true }), now: new Date(`${TODAY}T12:00:00Z`) });
    expect(r.status).not.toBe('failed');
    expect(r.source).toBe('CoinGecko');
    expect(r.message).toMatch(/Kraken ha fallat/);
  });

  it('si totes les fonts fallen, no inventa res', async () => {
    const down = (async () => new Response('down', { status: 503 })) as unknown as typeof fetch;
    const r = await updateBtcPrices({ fetchFn: down, now: new Date(`${TODAY}T12:00:00Z`) });
    expect(r.status).toBe('failed');
    expect(await getBtcSeries()).toEqual([]);
  });
});

describe('bitcoin declarat al patrimoni', () => {
  const btc = { price: 80000, date: '2026-11-25', source: 'Kraken', change1yPct: 10, maxDrawdownPct: -76.5,
    maxDrawdownPeak: '2021-11-08', maxDrawdownTrough: '2022-11-21', fromAthPct: -20, historyFrom: '2016-04-01' };

  it('cal indicar la quantitat de BTC', () => {
    expect(WealthItemInputSchema.safeParse({ kind: 'bitcoin', name: 'BTC', asOf: TODAY }).success).toBe(false);
    expect(WealthItemInputSchema.safeParse({ kind: 'bitcoin', name: 'BTC', asOf: TODAY, units: 0 }).success).toBe(false);
    expect(WealthItemInputSchema.safeParse({ kind: 'bitcoin', name: 'BTC', asOf: TODAY, units: 0.05 }).success).toBe(true);
  });

  it('valor = quantitat × últim tancament, amb la data del preu', () => {
    const r = addItem({}, WealthItemInputSchema.parse({ kind: 'bitcoin', name: 'BTC', entity: 'Kraken', asOf: '2026-01-10', units: 0.123456789 }), 'client', new Date(), 70000);
    if ('error' in r) throw new Error(r.error);
    const [item] = listItems(r.next);
    expect(item.units).toBe(0.12345679);
    expect(item.value).toBe(8641.98);   // valor calculat el dia que es va entrar

    const w = consolidateWealth({ holdings: [], netContributed: 0, questionnaire: r.next, today: TODAY, btc });
    const line = w.groups.find(g => g.group === 'inversions')!.lines[0];
    expect(line).toMatchObject({ value: 9876.54, asOf: '2026-11-25', source: 'preu-mercat', units: 0.12345679, unitPrice: 80000, stale: false });
    expect(w.bitcoin).toMatchObject({ units: 0.12345679, value: 9876.54, pctOfAssets: 100, maxDrawdownPct: -76.5 });
  });

  it('sense preu, es queda l\'últim valor calculat i ho avisa', () => {
    const r = addItem({}, WealthItemInputSchema.parse({ kind: 'bitcoin', name: 'BTC', asOf: TODAY, units: 1 }), 'client', new Date(), 70000);
    if ('error' in r) throw new Error(r.error);
    const w = consolidateWealth({ holdings: [], netContributed: 0, questionnaire: r.next, today: TODAY, btc: null });
    expect(w.grossAssets).toBe(70000);
    expect(w.bitcoin).toBeNull();
    expect(w.warnings.join(' ')).toMatch(/preu diari del bitcoin/);
  });

  it('canviar un bitcoin per un compte treu la quantitat', () => {
    const r = addItem({}, WealthItemInputSchema.parse({ kind: 'bitcoin', name: 'BTC', asOf: TODAY, units: 1 }), 'client', new Date(), 70000);
    if ('error' in r) throw new Error(r.error);
    const id = listItems(r.next)[0].id;
    const upd = updateItem(r.next, id, WealthItemInputSchema.parse({ kind: 'compte', name: 'Compte', value: 500, asOf: TODAY }))!;
    expect(listItems(upd)[0].units).toBeUndefined();
    expect(listItems(upd)[0].value).toBe(500);
  });

  it('sense bitcoin declarat no hi ha bloc de bitcoin', () => {
    const w = consolidateWealth({ holdings: [], netContributed: 0, questionnaire: {}, today: TODAY, btc });
    expect(w.bitcoin).toBeNull();
  });

  it('el bitcoin no és a la llista de fons que es poden proposar', () => {
    expect(ADVISOR_FUNDS.some(f => /bitcoin|btc|crypto|cripto/i.test(`${f.name} ${f.isin}`))).toBe(false);
  });
});
