const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const H = { 'user-agent': UA, accept: '*/*', 'accept-language': 'es-ES,es;q=0.9' };
async function get(url, opt = {}) { const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(25000), ...opt }); return { r, t: await r.text() }; }
function show(name, s, n = 1500) { console.log(`### ${name}\n${s.slice(0, n)}`); }
async function run(name, f) { try { await f(); } catch (e) { console.log(`### ${name} ERROR ${e.message}`); } }

await run('ishares', async () => {
  const { t } = await get('https://www.ishares.com/ch/individual/en/products/251882/x');
  show('ishares xls links', [...new Set(t.match(/[^"'\s]*fileType=xls[^"'\s]*/g) || [])].join('\n'));
  const m = (t.match(/[^"'\s]*fileType=xls[^"'\s]*/) || [])[0];
  if (m) { const u = new URL(m.replace(/&amp;/g, '&'), 'https://www.ishares.com'); const x = await get(u.href); show('ishares xls ' + x.r.status + ' ' + u.href, x.t, 800); show('ishares Historical idx', String(x.t.indexOf('Historical'))); const i = x.t.indexOf('ss:Name="Historical"'); show('ishares hist', x.t.slice(i, i + 1500)); }
});
await run('cobas', async () => {
  const { t } = await get('https://www.cobasam.com/valores-liquidativos/');
  show('cobas links', [...new Set(t.match(/https?:\/\/[^"'\s<>]+\.(xlsx?|csv|json)[^"'\s<>]*/gi) || [])].join('\n'), 3000);
  show('cobas api', [...new Set(t.match(/api\.cobasam\.com[^"'\s<>]*/g) || [])].join('\n'), 1500);
});
await run('dws', async () => {
  const { t } = await get('https://funds.deutsche-am.com/api/ProductDetailPage/ActiveEmea/es-es/lu0273159177');
  show('dws guids', [...new Set(t.match(/"[a-zA-Z]*[Gg]uid[a-zA-Z]*":"[^"]+"/g) || [])].join('\n'));
  show('dws chart', [...new Set(t.match(/[^"]*[Cc]hart[^"]*/g) || [])].slice(0, 20).join('\n'));
});
await run('vanguard', async () => {
  const q = { query: 'query PriceDetailsQuery($portIds:[String!]!,$startDate:String!,$endDate:String!,$limit:Float){funds(portIds:$portIds){pricingDetails{navPrices(startDate:$startDate,endDate:$endDate,limit:$limit){items{price asOfDate currencyCode}}}}}', variables: { portIds: ['9837'], startDate: '2026-11-01', endDate: '2026-11-25', limit: 0 } };
  for (const u of ['https://www.vanguard.co.uk/gpx/graphql', 'https://www.vanguard.co.uk/professional/gpx/graphql']) {
    const x = await get(u, { method: 'POST', headers: { ...H, 'content-type': 'application/json', 'apollographql-client-name': 'gpx', 'x-consumer-id': 'uk0' }, body: JSON.stringify(q) });
    show('vanguard POST ' + u + ' ' + x.r.status, x.t, 800);
  }
  const { t } = await get('https://www.vanguard.co.uk/professional/product/fund/equity/9837/global-stock-index-fund-gbp-acc');
  show('vanguard scripts', [...new Set(t.match(/src="[^"]+\.js"/g) || [])].join('\n'));
  show('vanguard gpx', [...new Set(t.match(/[^"'\s]*(gpx|graphql|api)[^"'\s]*/gi) || [])].slice(0, 40).join('\n'), 3000);
});
await run('polar', async () => {
  const { t } = await get('https://www.polarcapitalfunds.com/srp/api/part?id=11938&version=live&route=2493&audience=344&price_part_day=20&price_part_month=11&price_part_year=2026&fund_id=62');
  show('polar table', t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), 2000);
});
await run('fidelity', async () => {
  const { t } = await get('https://www.fidelity.lu/funds/factsheet/LU0353647737');
  show('fidelity page', [...new Set(t.match(/[^"'\s]*HistoricalNav[^"'\s]*/g) || [])].join('\n') + '\n' + t.slice(0, 300));
});
