import { NAV_SOURCES, fetchFeed, ecbUsdRates, usdToEur, type FeedContext } from '../../lib/navFeeds';
import stored from './stored.json';
const today = new Date().toISOString().slice(0, 10);
const since = '2026-11-12';
const ctx: FeedContext = { since, today };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
(async () => {
  const rates = await ecbUsdRates(ctx, '2026-11-01');
  await Promise.all(NAV_SOURCES.map(async src => {
    try {
      const r = await fetchFeed(src, ctx);
      const pts = r.points.map(p => p.currency === 'USD' ? usdToEur(p, rates)! : p);
      const st = (stored as Record<string, [string, number]>)[src.isin];
      const same = st && pts.find(p => p.date === st[0]);
      const cmp = same ? `stored ${st[0]} ${st[1]} vs ${same.nav} ratio ${(same.nav / st[1]).toFixed(5)}` : `stored ${st?.[0]} NO OVERLAP`;
      console.log(`OK ${src.isin} ${src.provider} n=${r.points.length} first=${pts[0]?.date} last=${pts.at(-1)?.date}=${pts.at(-1)?.nav} | ${cmp}`);
    } catch (e) { console.log(`FAIL ${src.isin} ${src.provider} ${(e as Error).message}`); }
  }));
  for (const id of ['287649', '287635']) {
    const t = await fetch(`https://www.ishares.com/ch/individual/en/products/${id}/x`, { headers: { 'user-agent': UA } }).then(r => r.text());
    const isins = [...new Set(t.match(/IE00[A-Z0-9]{8}/g) || [])];
    const prods = [...new Set(t.match(/\/products\/\d{6}\/[a-z0-9-]+/g) || [])].slice(0, 30);
    const i = t.indexOf('IE00BD0NCM55') >= 0 ? t.indexOf('IE00BD0NCM55') : t.indexOf('IE00BYWYCC39');
    console.log(`ISH ${id} isins=${isins.join(',')} prods=${prods.join(' ')}\n ctx=${t.slice(Math.max(0, i - 400), i + 200).replace(/\s+/g, ' ')}`);
  }
})();
