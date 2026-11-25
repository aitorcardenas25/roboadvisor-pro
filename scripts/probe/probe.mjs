// Temporary probe: which official NAV sources answer from a datacenter IP.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const tests = [
  ['ecb', 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=3&format=csvdata'],
  ['bestinver-xlsx', 'https://www.bestinver.es/WS/Api/Profitability/DownloadExcelLiquidity?productId=1'],
  ['bestinver-page', 'https://www.bestinver.es/'],
  ['magallanes', 'https://www.magallanesvalue.com/wp-content/fund-datasheet/prices.php?fund=iberian&classLetter=M&from=20261101&to=20261125&type=EXCEL'],
  ['azvalor', 'https://areacliente.azvalor.com/api/product/international/prices'],
  ['horos-page', 'https://horosam.com/'],
  ['cobas-page', 'https://www.cobasam.com/'],
  ['xtrackers', 'https://etf.dws.com/api/pdp/es-es/etf/LU0290358497/historicaldata/download?startDate=2026-11-01&endDate=2026-11-25&includeTax=true'],
  ['dws-pdp', 'https://funds.deutsche-am.com/api/ProductDetailPage/ActiveEmea/es-es/lu0273159177'],
  ['dws-page', 'https://funds.deutsche-am.com/es-es/'],
  ['fidelity', 'https://www.fidelity.lu/api/ce/fdh/HistoricalNav.xlsx?id=LU0353647737'],
  ['polar', 'https://www.polarcapitalfunds.com/srp/api/part?id=11938&version=live&route=2493&audience=344&price_part_day=20&price_part_month=11&price_part_year=2026&fund_id=62'],
  ['jpm', 'https://am.jpmorgan.com/FundsMarketingHandler/historicalData?cusip=LU0329202252&country=es&role=per&language=es'],
  ['pictet', 'https://am.pictet.com/es/es/individuals/funds/pictet-china-index/LU0625737910'],
  ['amundi', 'https://www.amundi.es/retail/product/view/LU0996182563'],
  ['ishares-ch', 'https://www.ishares.com/ch/individual/en/products/251882/x'],
  ['ishares-uk', 'https://www.ishares.com/uk/individual/en/products/251882/x'],
  ['vanguard', 'https://www.vanguard.co.uk/professional/product/fund/equity/9837/global-stock-index-fund-gbp-acc'],
  ['vanguard-gql', 'https://www.vanguard.co.uk/gpx/graphql'],
];
for (const [name, url] of tests) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*', 'accept-language': 'es-ES,es;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const buf = Buffer.from(await r.arrayBuffer());
    const txt = buf.toString('latin1');
    const head = buf[0] === 0x50 && buf[1] === 0x4b ? '[ZIP/XLSX]' : txt.slice(0, 300).replace(/\s+/g, ' ');
    console.log(`### ${name} ${r.status} ${r.headers.get('content-type')} ${buf.length}B ${Date.now()-t0}ms final=${r.url}\n${head}`);
    if (name.endsWith('page') || name === 'pictet' || name === 'amundi' || name.startsWith('ishares') || name === 'vanguard') {
      const links = [...new Set((txt.match(/https?:\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-/.]*(api|price|nav|liquid|xls|json|historic)[^"'\s<>]*/gi) || []))].filter(l => /api|price|nav|liquid|xls|json|histor|valor|vl/i.test(l)).slice(0, 40);
      console.log('LINKS: ' + links.join(' | '));
    }
  } catch (e) { console.log(`### ${name} ERROR ${e.message} ${Date.now()-t0}ms`); }
}
