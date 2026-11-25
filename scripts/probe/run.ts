// Temporal: caigudes amb l'històric diari complet de cada font (es treu abans de fusionar).
import { NAV_SOURCES, fetchFeed, ecbUsdRates, usdToEur } from '../../lib/navFeeds';
import { adjustForDistributions } from '../../lib/navBackfill';
import { computeFundDrawdowns, dateLabel, fallLabel, recoveryLabel } from '../../lib/drawdowns';
const today = new Date().toISOString().slice(0, 10);
(async () => {
  const rates = await ecbUsdRates({ since: '1999-01-04', today }, '1999-01-04');
  const rows = await Promise.all(NAV_SOURCES.map(async src => {
    try {
      const f = await fetchFeed(src, { since: '1985-01-01', today });
      let pts = f.points.filter(p => p.nav > 0).sort((a, b) => a.date.localeCompare(b.date));
      if (src.adjustDistributions) pts = adjustForDistributions(pts, f.distributions ?? []);
      pts = pts.map(p => p.currency === 'USD' ? usdToEur(p, rates) : p).filter((p): p is NonNullable<typeof p> => !!p);
      const d = computeFundDrawdowns({ isin: src.isin, name: src.isin }, pts);
      return `${src.isin} ${src.provider} ${d.frequency} ${d.windowStart}→ max ${d.maxDrawdown} | ` + d.episodes.map(e => `${dateLabel(e.peakDate, d.frequency)}→${dateLabel(e.troughDate, d.frequency)} ${e.depthPct}% caient ${fallLabel(e, d.frequency)} rec ${recoveryLabel(e, d.frequency)}`).join(' ; ') + (d.warnings.length ? ` [${d.warnings.join(' / ')}]` : '');
    } catch (e) { return `FAIL ${src.isin} ${(e as Error).message}`; }
  }));
  console.log(rows.sort().join('\n'));
})();
