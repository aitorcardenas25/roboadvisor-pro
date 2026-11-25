// Temporal: caigudes amb l'històric diari complet de cada font (es treu abans de fusionar).
import { NAV_SOURCES, fetchFeed, ecbUsdRates, usdToEur } from '../../lib/navFeeds';
import { computeFundDrawdowns, dateLabel, fallLabel, recoveryLabel } from '../../lib/drawdowns';
import type { FeedDistribution, FeedPoint } from '../../lib/navFeeds';
function adjustForDistributions(points: FeedPoint[], dists: FeedDistribution[]): FeedPoint[] {
  const factors = dists.map(d => {
    const pEx = points.find(p => p.date === d.exDate && p.currency === d.currency);
    return pEx ? { exDate: d.exDate, factor: pEx.nav / (pEx.nav + d.amount) } : null;
  }).filter((f): f is { exDate: string; factor: number } => !!f).sort((a, b) => b.exDate.localeCompare(a.exDate));
  let k = 1, j = 0;
  return [...points].sort((a, b) => b.date.localeCompare(a.date)).map(p => {
    while (j < factors.length && factors[j].exDate > p.date) k *= factors[j++].factor;
    return { ...p, nav: Math.round(p.nav * k * 1e6) / 1e6 };
  }).reverse();
}

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
