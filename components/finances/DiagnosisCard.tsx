'use client';

// Diagnòstic automàtic: es recalcula al moment amb les dades que hi ha.
// Tot el càlcul és a lib/diagnosis.ts.
import type { Diagnosis, DiagnosisStatus, Tone } from '@/lib/diagnosis';

const STATUS: Record<DiagnosisStatus, { label: string; dot: string; border: string }> = {
  vermell:   { label: 'Cal actuar',          dot: 'bg-negative',    border: 'border-negative/40' },
  ambre:     { label: 'En camí',             dot: 'bg-warning',  border: 'border-warning/40' },
  verd:      { label: 'Base sòlida',         dot: 'bg-positive',  border: 'border-positive/40' },
  incomplet: { label: 'Falten dades',        dot: 'bg-subtle-strong',   border: 'border-line-strong' },
};
const TONE: Record<Tone, string> = { bo: 'text-positive', atencio: 'text-warning', alerta: 'text-negative', neutre: 'text-ink' };

export default function DiagnosisCard({ d, audience = 'client' }: { d: Diagnosis; audience?: 'client' | 'admin' }) {
  const s = STATUS[d.status];
  return (
    <section className={`bg-surface border ${s.border} rounded-xl p-5`} aria-labelledby="diagnosis-title">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} aria-hidden />
        <h2 id="diagnosis-title" className="text-accent text-xs uppercase tracking-widest">
          {audience === 'client' ? 'El teu diagnòstic' : 'Diagnòstic'} · {s.label}
        </h2>
      </div>
      <p className="text-ink font-semibold text-lg leading-snug">{d.headline}</p>

      {d.findings.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {d.findings.map(f => (
            <div key={f.label}>
              <dt className="text-ink-muted text-xs">{f.label}</dt>
              <dd className={`text-xl font-bold ${TONE[f.tone]}`}>{f.value}</dd>
              <dd className="text-ink-muted text-xs">{f.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      {d.actions.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <p className="text-ink-soft text-xs uppercase tracking-widest mb-3">{audience === 'client' ? 'Què pots fer ara' : 'Accions per al client'}</p>
          <ol className="space-y-3">
            {d.actions.map((a, i) => (
              <li key={a.title} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div><p className="text-ink text-sm font-medium">{a.title}</p><p className="text-ink-soft text-sm">{a.detail}</p></div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {d.missing.length > 0 && d.status !== 'incomplet' && (
        <p className="text-ink-muted text-xs mt-4">Per afinar-lo falta: {d.missing.join(', ')}.</p>
      )}
      <p className="text-ink-muted text-xs mt-3">Calculat amb les dades {audience === 'client' ? 'que has posat' : 'del client'}. Els objectius es calculen només amb estalvi, sense suposar cap rendiment. No és una recomanació d&apos;inversió.</p>
    </section>
  );
}
