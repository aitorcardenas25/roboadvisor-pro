import { NAV_SOURCES, fetchFeed, ecbUsdRates, usdToEur, type FeedContext } from '../../lib/navFeeds';
import { readSheets } from '../../lib/xlsxLite';
const today = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
const ctx: FeedContext = { since, today };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
async function dump(name: string, url: string) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA } }); const b = Buffer.from(await r.arrayBuffer());
    console.log(`--- DUMP ${name} ${r.status} ${r.headers.get('content-type')} ${b.length}`);
    try { for (const sh of readSheets(b)) console.log(`  sheet ${sh.name}: ` + JSON.stringify(sh.rows.slice(0, 6))); }
    catch { console.log('  ' + b.toString('utf8').slice(0, 1200)); }
  } catch (e) { console.log(`--- DUMP ${name} ERROR ${(e as Error).message}`); }
}
(async () => {
  const rates = await ecbUsdRates(ctx, since).catch(e => { console.log('ECB ERR', e.message); return new Map(); });
  console.log('ECB rates', rates.size, [...rates].slice(-2));
  await Promise.all(NAV_SOURCES.map(async src => {
    try {
      const r = await fetchFeed(src, ctx);
      const last = r.points.slice(-2).map(p => `${p.date}=${p.nav}${p.currency}` + (p.currency === 'USD' ? `→${usdToEur(p, rates)?.nav}EUR` : '')).join(' ');
      console.log(`OK ${src.isin} ${src.provider} n=${r.points.length} ${last}${r.distributions ? ' dist=' + JSON.stringify(r.distributions.slice(-2)) : ''}`);
    } catch (e) { console.log(`FAIL ${src.isin} ${src.provider} ${(e as Error).message}`); }
  }));
  await dump('fidelity', `https://www.fidelity.lu/api/ce/fdh/HistoricalNav.xlsx?id=LU0353647737&countries=lu&country=lu&languages=en&language=en&channels=ce.private-investor&channel=ce.private-investor&r=${Date.now()}`);
  await dump('xtrackers', `https://etf.dws.com/api/pdp/es-es/etf/LU0290358497/historicaldata/download?startDate=${since}&endDate=${today}&includeTax=true`);
  await dump('bestinver', 'https://www.bestinver.es/WS/Api/Profitability/DownloadExcelLiquidity?productId=7');
  await dump('horos', 'https://horosam.com/api/pricesPure_5a017ae36ccb761f259a0435.json');
  await dump('dws-chart', `https://funds.deutsche-am.com/api/chart-data/ActiveEmea/es-es/GetChartData?instrumentListingGuid=4611c858-7eb1-48d7-844f-8ffc6766135b&startDate=${since}&endDate=${today}&resolution=5000`);
  await dump('dws-navfile', `https://funds.deutsche-am.com/api/chart-data/ActiveEmea/es-ES/DownloadNavFile/4611c858-7eb1-48d7-844f-8ffc6766135b?startDate=${since}&endDate=${today}`);
  const ish = await fetch('https://www.ishares.com/ch/individual/en/products/308904/x/1535604580403.ajax?fileType=xls&fileName=fund&dataType=fund', { headers: { 'user-agent': UA } }).then(r => r.text());
  for (const sh of readSheets(Buffer.from(ish.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;')))) console.log(`  ishares sheet ${sh.name}: ` + JSON.stringify(sh.rows.slice(0, 3)));
  const cob = await fetch('https://www.cobasam.com/valores-liquidativos/', { headers: { 'user-agent': UA } }).then(r => r.text());
  const i = cob.search(/Cobas Renta/); console.log('COBAS RENTA HTML ' + cob.slice(i, i + 1500).replace(/\s+/g, ' '));
})();
