'use client';
// Repartiment d'una cartera: renda variable / renda fixa i gestió activa / passiva.
// La classificació i els càlculs són a lib/fundClassification.ts.
import { allocationBreakdown, allocationNote } from '@/lib/fundClassification';

const pct = (n: number) => `${n.toLocaleString('ca-ES', { maximumFractionDigits: 0 })} %`;

interface Seg { label: string; pct: number; tone: string }

function Bar({ title, segs }: { title: string; segs: Seg[] }) {
  const shown = segs.filter(s => s.pct > 0.05);
  return (
    <div>
      <p className="text-ink-muted text-[11px]">{title}</p>
      <div className="mt-1.5 flex h-2 rounded-full overflow-hidden bg-subtle" role="img"
        aria-label={`${title}: ${shown.map(s => `${s.label} ${pct(s.pct)}`).join(', ')}`}>
        {shown.map(s => <div key={s.label} className={s.tone} style={{ width: `${s.pct}%` }} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {shown.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className={`inline-block w-2 h-2 rounded-sm ${s.tone}`} />
            {s.label} <span className="text-ink font-semibold">{pct(s.pct)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AllocationSummary({ items, className = '' }: {
  items: { isin: string; weight: number; category?: string; name?: string }[];
  className?: string;
}) {
  const b = allocationBreakdown(items);
  if (!items.some(x => x.weight > 0)) return null;
  return (
    <div className={className}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Bar title="Renda variable i renda fixa" segs={[
          { label: 'Renda variable', pct: b.equity, tone: 'bg-accent' },
          { label: b.moneyMarket > 0.05 ? `Renda fixa (${pct(b.moneyMarket)} monetari)` : 'Renda fixa', pct: b.fixedIncome, tone: 'bg-ink-soft' },
          { label: 'Altres', pct: b.other, tone: 'bg-ink-muted' },
          { label: 'Sense classificar', pct: b.unknownAsset, tone: 'bg-line' },
        ]} />
        <Bar title="Estil de gestió" segs={[
          { label: 'Gestió passiva', pct: b.passive, tone: 'bg-accent' },
          { label: 'Gestió activa', pct: b.active, tone: 'bg-ink-soft' },
          { label: 'Sense classificar', pct: b.unknownStyle, tone: 'bg-line' },
        ]} />
      </div>
      <p className="text-ink-muted text-[11px] mt-2">{allocationNote(b)}</p>
    </div>
  );
}
