'use client';

// Diagnòstic automàtic: es recalcula al moment amb les dades que hi ha.
// Tot el càlcul és a lib/diagnosis.ts.
import type { Diagnosis, DiagnosisStatus, Tone } from '@/lib/diagnosis';

const STATUS: Record<DiagnosisStatus, { label: string; dot: string; border: string }> = {
  vermell:   { label: 'Cal actuar',          dot: 'bg-red-400',    border: 'border-red-400/40' },
  ambre:     { label: 'En camí',             dot: 'bg-amber-300',  border: 'border-amber-300/40' },
  verd:      { label: 'Base sòlida',         dot: 'bg-green-400',  border: 'border-green-400/40' },
  incomplet: { label: 'Falten dades',        dot: 'bg-white/30',   border: 'border-white/15' },
};
const TONE: Record<Tone, string> = { bo: 'text-green-300', atencio: 'text-amber-200', alerta: 'text-red-300', neutre: 'text-white' };

export default function DiagnosisCard({ d, audience = 'client' }: { d: Diagnosis; audience?: 'client' | 'admin' }) {
  const s = STATUS[d.status];
  return (
    <section className={`bg-[#0d1f1a] border ${s.border} rounded-xl p-5`} aria-labelledby="diagnosis-title">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} aria-hidden />
        <h2 id="diagnosis-title" className="text-[#c9a84c] text-xs uppercase tracking-widest">
          {audience === 'client' ? 'El teu diagnòstic' : 'Diagnòstic'} · {s.label}
        </h2>
      </div>
      <p className="text-white font-semibold text-lg leading-snug">{d.headline}</p>

      {d.findings.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {d.findings.map(f => (
            <div key={f.label}>
              <dt className="text-white/40 text-xs">{f.label}</dt>
              <dd className={`text-xl font-bold ${TONE[f.tone]}`}>{f.value}</dd>
              <dd className="text-white/40 text-xs">{f.detail}</dd>
            </div>
          ))}
        </dl>
      )}

      {d.actions.length > 0 && (
        <div className="mt-5 pt-4 border-t border-white/5">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-3">{audience === 'client' ? 'Què pots fer ara' : 'Accions per al client'}</p>
          <ol className="space-y-3">
            {d.actions.map((a, i) => (
              <li key={a.title} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#c9a84c]/15 text-[#c9a84c] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div><p className="text-white text-sm font-medium">{a.title}</p><p className="text-white/50 text-sm">{a.detail}</p></div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {d.missing.length > 0 && d.status !== 'incomplet' && (
        <p className="text-white/30 text-xs mt-4">Per afinar-lo falta: {d.missing.join(', ')}.</p>
      )}
      <p className="text-white/25 text-xs mt-3">Calculat amb les dades {audience === 'client' ? 'que has posat' : 'del client'}. Els objectius es calculen només amb estalvi, sense suposar cap rendiment. No és una recomanació d&apos;inversió.</p>
    </section>
  );
}
