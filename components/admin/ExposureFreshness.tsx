'use client';
// Recordatori trimestral: fitxes de diversificació (regió, sector, mida, top-10)
// que tenen més d'un trimestre. Les dades són a lib/fundExposureData.ts.
import { useMemo } from 'react';
import { staleExposures, EXPOSURE_STALE_DAYS } from '@/lib/fundExposure';

const fdate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default function ExposureFreshness() {
  const stale = useMemo(() => staleExposures(), []);
  if (!stale.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-warning/30 bg-surface p-4">
      <p className="text-ink text-sm font-medium">Cal actualitzar la diversificació de {stale.length === 1 ? '1 fons' : `${stale.length} fons`}</p>
      <p className="text-ink-muted text-xs mt-1">
        La fitxa oficial té més de {EXPOSURE_STALE_DAYS} dies. Les propostes i els informes continuen mostrant-la, amb la seva data.
        Es revisa cada trimestre (fitxer lib/fundExposureData.ts).
      </p>
      <ul className="mt-2 space-y-0.5">
        {stale.slice(0, 8).map(s => (
          <li key={s.isin} className="text-xs text-ink-soft">{s.name} <span className="text-ink-muted">· fitxa a {fdate(s.asOf)}</span></li>
        ))}
        {stale.length > 8 && <li className="text-xs text-ink-muted">i {stale.length - 8} més</li>}
      </ul>
    </div>
  );
}
