// Temporal: fins on arriba l'històric de cada font oficial (es treu abans de fusionar).
import { NAV_SOURCES, fetchFeed, ecbUsdRates, usdToEur, type FeedContext } from '../../lib/navFeeds';
import stored from './stored.json';
const today = new Date().toISOString().slice(0, 10);
const ctx: FeedContext = { since: '1985-01-01', today };
(async () => {
  const rates = await ecbUsdRates(ctx, '1999-01-01').catch(e => { console.log('ECB FAIL', e.message); return new Map(); });
  console.log('ECB rates', rates.size);
  const rows = await Promise.all(NAV_SOURCES.map(async src => {
    try {
      const r = await fetchFeed(src, ctx);
      const pts = r.points.map(p => p.currency === 'USD' ? (usdToEur(p, rates) ?? p) : p).sort((a, b) => a.date.localeCompare(b.date));
      let maxGap = 0, gapAt = '';
      for (let i = 1; i < pts.length; i++) { const g = (Date.parse(pts[i].date) - Date.parse(pts[i - 1].date)) / 864e5; if (g > maxGap) { maxGap = g; gapAt = pts[i].date; } }
      const st = (stored as unknown as Record<string, [string, number]>)[src.isin];
      const same = st && pts.find(p => p.date === st[0]);
      const cmp = same ? `ratio@${st[0]}=${(same.nav / st[1]).toFixed(4)}` : `no-overlap@${st?.[0]}`;
      return `OK ${src.isin} ${src.provider} n=${pts.length} first=${pts[0]?.date} last=${pts.at(-1)?.date} maxGap=${maxGap}d@${gapAt} dist=${r.distributions?.length ?? 0} ${cmp}`;
    } catch (e) { return `FAIL ${src.isin} ${src.provider} ${(e as Error).message}`; }
  }));
  console.log(rows.sort().join('\n'));
  // Bestinver mensual des de l'inici
  for (const id of [1, 2, 3, 4, 7, 16, 20, 28]) {
    try {
      const j = await fetch(`https://www.bestinver.es/WS/Api/Profitability/MonthlyVL?idProduct=${id}&chartLegend=x`).then(r => r.json());
      const arr = Object.values(j[0] ?? {})[0] as { x: string }[] | undefined;
      console.log(`BESTINVER-MONTHLY ${id} n=${arr?.length} first=${arr?.[0]?.x}`);
    } catch (e) { console.log(`BESTINVER-MONTHLY ${id} FAIL ${(e as Error).message}`); }
  }
})();
