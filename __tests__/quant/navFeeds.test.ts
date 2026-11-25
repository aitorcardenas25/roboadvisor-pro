// Actualització diària dels preus: lectura de les fonts oficials i desat a fund_navs.
import { describe, it, expect, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { parseFeedDate, parseFeedNumber, seriesFromSheet, fetchFeed, usdToEur, weekdaysBetween, NAV_SOURCES, MANUAL_ONLY, type FeedContext } from '@/lib/navFeeds';
import { readSheets, readSpreadsheetMl } from '@/lib/xlsxLite';
import { distributionFactors, runNavAutoUpdate, workdaysAfter, madridToday, applyDistributionAdjustment } from '@/lib/navAutoUpdate';
import { upsertNavs, getNavs, __resetNavsForTests } from '@/lib/fundNavs';

const ctx = (over: Partial<FeedContext> = {}): FeedContext => ({ since: '2026-11-10', today: '2026-11-25', ...over });
const res = (body: string | Buffer, status = 200) => new Response(typeof body === 'string' ? body : new Uint8Array(body), { status });

describe('parseFeedDate / parseFeedNumber', () => {
  it('entén els formats de les gestores', () => {
    expect(parseFeedDate('24/Nov/2026')).toBe('2026-11-24');          // iShares
    expect(parseFeedDate('23-11-2026')).toBe('2026-11-23');           // Cobas
    expect(parseFeedDate('20.11.2026')).toBe('2026-11-20');           // Polar
    expect(parseFeedDate('46350.0')).toBe('2026-11-24');              // Excel (Fidelity)
    expect(parseFeedDate('20261124')).toBe('2026-11-24');             // Horos
    expect(parseFeedDate('2026-11-24T00:00:00Z')).toBe('2026-11-24');
    expect(parseFeedDate('31/02/2026')).toBeNull();
    expect(parseFeedDate('Fecha')).toBeNull();
  });
  it('entén els números amb coma, punt i símbol de moneda', () => {
    expect(parseFeedNumber('14,080836')).toBeCloseTo(14.080836);
    expect(parseFeedNumber('289,598 €')).toBeCloseTo(289.598);
    expect(parseFeedNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseFeedNumber('137.339579')).toBeCloseTo(137.339579);
    expect(parseFeedNumber('--')).toBeNull();
  });
});

describe('lectors de fulls de càlcul', () => {
  it('llegeix un .xlsx i en treu la sèrie per la capçalera', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Historico');
    ws.addRow(['BESTINVER RENTA - CLASE B']);
    ws.addRow(['Fecha', 'Valor liquidativo (€)']);
    ws.addRow(['23/11/2026', '14,080836']);
    ws.addRow(['22/11/2026', '14,062380']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const sheets = readSheets(buf);
    expect(sheets[0].name).toBe('Historico');
    expect(seriesFromSheet(sheets[0], /^valor liquidativo/i, 'EUR')).toEqual([
      { date: '2026-11-23', nav: 14.080836, currency: 'EUR' },
      { date: '2026-11-22', nav: 14.06238, currency: 'EUR' },
    ]);
  });

  it('llegeix SpreadsheetML (iShares) amb la moneda de cada fila', () => {
    const xml = `<?xml version="1.0"?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <ss:Worksheet ss:Name="Historical"><ss:Table>
      <ss:Row><ss:Cell><ss:Data ss:Type="String">As Of</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">Currency</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">NAV per Share</ss:Data></ss:Cell></ss:Row>
      <ss:Row><ss:Cell><ss:Data ss:Type="String">24/Nov/2026</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">USD</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="Number">137.339579</ss:Data></ss:Cell></ss:Row>
      </ss:Table></ss:Worksheet></ss:Workbook>`;
    const [sh] = readSpreadsheetMl(xml);
    expect(seriesFromSheet(sh, /^nav per share$/i, 'EUR')).toEqual([{ date: '2026-11-24', nav: 137.339579, currency: 'USD' }]);
  });
});

describe('fonts', () => {
  it('Vanguard: llegeix la resposta GraphQL', async () => {
    const fetchFn = (async () => res(JSON.stringify({ data: { funds: [{ pricingDetails: { navPrices: { items: [
      { price: 62.3694, asOfDate: '2026-11-24', currencyCode: 'EUR' }, { price: 62.9005, asOfDate: '2026-11-23', currencyCode: 'EUR' },
      { price: 60, asOfDate: '2026-10-01', currencyCode: 'EUR' },
    ] } } }] } }))) as typeof fetch;
    const r = await fetchFeed({ isin: 'IE00B03HD191', provider: 'vanguard', key: '9837' }, ctx({ fetchFn }));
    expect(r.points.map(p => p.date)).toEqual(['2026-11-23', '2026-11-24']);   // ordenats i dins el període
  });

  it('Cobas: treu la classe demanada del JSON de la pàgina', async () => {
    const html = '<script>var d = "[{\\"name\\":\\"Cobas Internacional FI Clase A\\",\\"product_profit_info\\":{\\"liquidative_value\\":\\"184,556421 €\\",\\"liquidative_date\\":\\"23-11-2026\\"}},{\\"name\\":\\"Cobas Internacional FI Clase C\\",\\"product_profit_info\\":{\\"liquidative_value\\":\\"190,207249 €\\",\\"liquidative_date\\":\\"23-11-2026\\"}}]"</script>';
    const fetchFn = (async () => res(html)) as typeof fetch;
    const r = await fetchFeed({ isin: 'ES0119199000', provider: 'cobas', key: 'Cobas Internacional', shareClass: 'C' }, ctx({ fetchFn }));
    expect(r.points).toEqual([{ date: '2026-11-23', nav: 190.207249, currency: 'EUR' }]);
  });

  it('una moneda forçada substitueix la de la font', async () => {
    const xml = `<?xml version="1.0"?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><ss:Worksheet ss:Name="Historical"><ss:Table>
      <ss:Row><ss:Cell><ss:Data ss:Type="String">As Of</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">Currency</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">NAV per Share</ss:Data></ss:Cell></ss:Row>
      <ss:Row><ss:Cell><ss:Data ss:Type="String">13/Nov/2026</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="String">USD</ss:Data></ss:Cell><ss:Cell><ss:Data ss:Type="Number">29.4254</ss:Data></ss:Cell></ss:Row>
      </ss:Table></ss:Worksheet></ss:Workbook>`;
    const fetchFn = (async () => res(xml)) as typeof fetch;
    const r = await fetchFeed({ isin: 'IE00BD0NCM55', provider: 'ishares', key: '287649', currency: 'EUR' }, ctx({ fetchFn }));
    expect(r.points).toEqual([{ date: '2026-11-13', nav: 29.4254, currency: 'EUR' }]);
  });

  it('cada ISIN té una sola font i cap fons manual no en té', () => {
    const isins = NAV_SOURCES.map(s => s.isin);
    expect(new Set(isins).size).toBe(isins.length);
    for (const m of Object.keys(MANUAL_ONLY)) expect(isins).not.toContain(m);
  });
});

describe('utilitats', () => {
  it('USD → EUR amb el canvi del BCE del mateix dia o de l\'anterior', () => {
    const rates = new Map([['2026-11-20', 1.1]]);
    expect(usdToEur({ date: '2026-11-23', nav: 110, currency: 'USD' }, rates)).toEqual({ date: '2026-11-23', nav: 100, currency: 'EUR' });
    expect(usdToEur({ date: '2026-12-10', nav: 110, currency: 'USD' }, rates)).toBeNull();
  });
  it('dies laborables', () => {
    expect(weekdaysBetween('2026-11-20', '2026-11-24')).toEqual(['2026-11-20', '2026-11-23', '2026-11-24']);
    expect(workdaysAfter('2026-11-20', '2026-11-24')).toBe(2);
  });
  it('factor de dividend P_ex / (P_ex + D)', () => {
    const f = distributionFactors([{ exDate: '2026-12-11', amount: 0.12, currency: 'USD' }, { exDate: '2026-06-18', amount: 0.123, currency: 'USD' }],
      [{ date: '2026-12-11', nav: 9.88, currency: 'USD' }], '2026-12-01');
    expect(f).toHaveLength(1);
    expect(f[0].factor).toBeCloseTo(9.88 / 10);
  });
  it('dia de Madrid', () => {
    expect(madridToday(new Date('2026-11-24T23:30:00Z'))).toBe('2026-11-25');
  });
});

describe('runNavAutoUpdate (sense base de dades)', () => {
  beforeEach(() => __resetNavsForTests());

  const vanguardFetch = (items: { price: number; asOfDate: string }[]) => (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('vanguard.co.uk')) return res(JSON.stringify({ data: { funds: [{ pricingDetails: { navPrices: { items: items.map(i => ({ ...i, currencyCode: 'EUR' })) } } }] } }));
    return res('no', 404);
  }) as typeof fetch;

  it('desa els dies nous quan la font coincideix amb l\'últim preu desat', async () => {
    await upsertNavs([{ isin: 'IE00B03HD191', date: '2026-11-16', nav: 64.2997, currency: 'EUR' }]);
    const s = await runNavAutoUpdate('admin', { now: new Date('2026-11-25T12:00:00Z'), fetchFn: vanguardFetch([
      { price: 64.2997, asOfDate: '2026-11-16' }, { price: 63.5497, asOfDate: '2026-11-17' }, { price: 62.3694, asOfDate: '2026-11-24' },
    ]) });
    const f = s.funds.find(x => x.isin === 'IE00B03HD191')!;
    expect(f.status).toBe('updated');
    expect(f.added).toBe(2);
    expect((await getNavs('IE00B03HD191')).at(-1)).toMatchObject({ date: '2026-11-24', nav: 62.3694 });
  });

  it('no desa res si la font no coincideix amb l\'històric (una altra classe)', async () => {
    await upsertNavs([{ isin: 'IE00B03HD191', date: '2026-11-16', nav: 64.2997, currency: 'EUR' }]);
    const s = await runNavAutoUpdate('admin', { now: new Date('2026-11-25T12:00:00Z'), fetchFn: vanguardFetch([
      { price: 70, asOfDate: '2026-11-16' }, { price: 71, asOfDate: '2026-11-24' },
    ]) });
    const f = s.funds.find(x => x.isin === 'IE00B03HD191')!;
    expect(f.status).toBe('failed');
    expect(f.message).toMatch(/no coincideix/);
    expect((await getNavs('IE00B03HD191')).at(-1)!.date).toBe('2026-11-16');
  });

  it('marca com a fallat un salt impossible i com a manual els fons sense font', async () => {
    await upsertNavs([
      { isin: 'IE00B03HD191', date: '2026-11-16', nav: 64.2997, currency: 'EUR' },
      { isin: 'LU0625737910', date: '2026-11-16', nav: 125.07, currency: 'EUR' },
    ]);
    const s = await runNavAutoUpdate('cron', { now: new Date('2026-11-25T12:00:00Z'), fetchFn: vanguardFetch([{ price: 30, asOfDate: '2026-11-24' }]) });
    expect(s.funds.find(x => x.isin === 'IE00B03HD191')!.status).toBe('failed');
    expect(s.funds.find(x => x.isin === 'LU0625737910')!.status).toBe('manual');
    // Només es miren els fons que ja tenen preus desats
    expect(s.funds).toHaveLength(2);
  });
});

describe('ajust per dividend', () => {
  beforeEach(() => __resetNavsForTests());
  it('s\'aplica una sola vegada encara que dues execucions coincideixin', async () => {
    await upsertNavs([
      { isin: 'IE00B4WXJJ64', date: '2026-12-09', nav: 100, currency: 'EUR' },
      { isin: 'IE00B4WXJJ64', date: '2026-12-10', nav: 101, currency: 'EUR' },
    ]);
    const raw = new Map([['2026-12-10', 101]]);
    expect(await applyDistributionAdjustment('IE00B4WXJJ64', '2026-12-11', 0.99, raw)).toBe('applied');
    expect(await applyDistributionAdjustment('IE00B4WXJJ64', '2026-12-11', 0.99, raw)).toBe('already');
    const navs = await getNavs('IE00B4WXJJ64');
    expect(navs[0].nav).toBeCloseTo(99);
    expect(navs[1].nav).toBeCloseTo(99.99);
  });
});
