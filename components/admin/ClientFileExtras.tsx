'use client';

// Peces de la fitxa de client de l'admin: el pas de l'alta, obrir la vista del
// client, entrar les finances a mà i les notes internes (sense cartera).
import { useState } from 'react';
import FinancesForm from '@/components/finances/FinancesForm';
import { ADVISOR_STAGE_LABEL, type AdvisorStage } from '@/lib/onboarding';

const ORDER: AdvisorStage[] = ['sense-dades', 'dades', 'esborrany', 'aprovat', 'enviat', 'actiu'];
const STEPS: { label: string; doneFrom: AdvisorStage; tab: 'dades' | 'proposal' | 'portfolio' }[] = [
  { label: 'Dades',            doneFrom: 'dades',    tab: 'dades' },
  { label: 'Proposta',         doneFrom: 'esborrany', tab: 'proposal' },
  { label: 'Informe aprovat',  doneFrom: 'aprovat',  tab: 'proposal' },
  { label: 'Enviat al client', doneFrom: 'enviat',   tab: 'proposal' },
  { label: 'Cartera activa',   doneFrom: 'actiu',    tab: 'portfolio' },
];
const NEXT: Record<AdvisorStage, string> = {
  'sense-dades': 'Puja l\'Excel del client o entra les dades a mà (pestanya 1).',
  'dades':       'Prepara la proposta: tria els fons i els pesos (pestanya 2).',
  'esborrany':   'Revisa la proposta i aprova-la per generar l\'informe inicial (pestanya 2).',
  'aprovat':     'Revisa l\'informe i, quan el vulguis ensenyar, prem «Enviar al client» a la versió aprovada (pestanya 2). Fins llavors el client només veu la pantalla d\'espera.',
  'enviat':      'Quan el client hagi comprat, crea la cartera des de la proposta aprovada (pestanya 2).',
  'actiu':       'Seguiment: informes mensuals i revisió de la cartera.',
};

export function StageBar({ stage, onGo }: { stage: AdvisorStage; onGo: (tab: 'dades' | 'proposal' | 'portfolio') => void }) {
  const at = ORDER.indexOf(stage);
  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const done = at >= ORDER.indexOf(s.doneFrom);
          const current = !done && (i === 0 || at >= ORDER.indexOf(STEPS[i - 1].doneFrom));
          return (
            <button key={s.label} type="button" onClick={() => onGo(s.tab)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                done ? 'border-positive/30 bg-positive/10 text-positive'
                  : current ? 'border-accent/40 bg-accent-soft text-accent font-semibold'
                  : 'border-line text-ink-muted'}`}>
              <span aria-hidden>{done ? '✓' : i + 1}</span>{s.label}
            </button>
          );
        })}
      </div>
      <p className="text-ink-soft text-xs mt-3">
        <span className="text-ink font-medium">{ADVISOR_STAGE_LABEL[stage]}.</span> Següent pas: {NEXT[stage]}
      </p>
    </div>
  );
}

/** Obre el portal en una pestanya nova, amb les dades d'aquest client i en només lectura. */
export function PreviewButton({ clientId }: { clientId: string }) {
  const [error, setError] = useState('');
  async function open() {
    setError('');
    const w = window.open('about:blank', '_blank');   // abans de l'await: si no, el navegador el bloqueja
    const r = await fetch('/api/admin/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { w?.close(); setError(j.error ?? 'No s\'ha pogut obrir'); return; }
    if (w) w.location.href = j.url ?? '/client/patrimoni';
    else window.location.href = j.url ?? '/client/patrimoni';
  }
  return (
    <div className="text-right">
      <button type="button" onClick={open}
        className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent text-xs font-medium hover:bg-accent-soft">
        Veure com el client ↗
      </button>
      {error && <p className="text-negative text-xs mt-1">{error}</p>}
    </div>
  );
}

/** L'assessor entra o corregeix a mà les finances i els objectius (sense Excel). */
export function ManualFinances({ clientId, data, onSaved }: { clientId: string; data: Record<string, unknown>; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!open) return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => { setOpen(true); setSaved(false); }}
        className="px-3 py-1.5 rounded-lg border border-line text-ink text-xs font-medium hover:bg-subtle">
        Entrar o corregir les dades a mà
      </button>
      {saved && <span className="text-positive text-xs">Desat.</span>}
    </div>
  );
  return (
    <FinancesForm data={data} endpoint={`/api/admin/clients/${clientId}/finances`} title="Dades del client"
      onCancel={() => setOpen(false)}
      onSaved={() => { setOpen(false); setSaved(true); onSaved(); }} />
  );
}

/** Notes internes de l'assessor (no les veu el client). Funcionen des del primer dia. */
export function InternalNotes({ clientId, initial }: { clientId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function save() {
    setState('saving');
    const r = await fetch(`/api/admin/clients/${clientId}/notes`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: text }),
    }).catch(() => null);
    setState(r?.ok ? 'saved' : 'error');
  }
  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <h3 className="text-ink font-semibold text-sm">Notes internes</h3>
      <p className="text-ink-muted text-xs mt-0.5 mb-3">No surten al portal del client. Per exemple: què t&apos;ha explicat per WhatsApp, dubtes, coses a revisar. Ull: si el client descarrega «les meves dades» (dret RGPD), hi surten.</p>
      <textarea value={text} onChange={e => { setText(e.target.value); setState('idle'); }} rows={6} maxLength={10_000}
        className="w-full bg-subtle border border-line rounded-md px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent/50" />
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={save} disabled={state === 'saving' || text === initial && state !== 'error'}
          className="px-3 py-1.5 rounded-lg bg-accent text-accent-ink text-xs font-semibold disabled:opacity-40">
          {state === 'saving' ? 'Desant…' : 'Desar les notes'}
        </button>
        {state === 'saved' && <span className="text-positive text-xs">Desat.</span>}
        {state === 'error' && <span className="text-negative text-xs">No s&apos;ha pogut desar.</span>}
      </div>
    </div>
  );
}

// Nom complet editable (nom + cognoms): és el que surt a la portada i a les capçaleres dels informes.
export function ClientNameEditor({ clientId, initial, onSaved }: { clientId: string; initial: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  async function save() {
    setState('saving'); setMsg('');
    const r = await fetch(`/api/admin/clients/${clientId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: text }),
    }).catch(() => null);
    if (r?.ok) { setState('idle'); setEditing(false); onSaved(); return; }
    const j = await r?.json().catch(() => null);
    setMsg(j?.error ?? 'No s\'ha pogut desar.'); setState('error');
  }
  const oneWord = initial.trim().split(/\s+/).length < 2;
  if (!editing) return (
    <div className="text-right">
      <span className="text-ink text-sm">{initial}</span>
      <button type="button" onClick={() => { setText(initial); setEditing(true); }}
        className="ml-2 text-accent text-xs hover:underline">Editar</button>
      {oneWord && <p className="text-warning text-xs mt-0.5">Falten els cognoms: als informes surt només «{initial}».</p>}
    </div>
  );
  return (
    <div className="flex flex-col items-end gap-1.5">
      <input value={text} onChange={e => { setText(e.target.value); setState('idle'); }} maxLength={100} autoFocus
        placeholder="Nom i cognoms"
        className="w-56 bg-subtle border border-line rounded-md px-2 py-1 text-sm text-ink focus:outline-none focus:border-accent/50" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(false)} className="text-ink-muted text-xs">Cancel·lar</button>
        <button type="button" onClick={save} disabled={state === 'saving' || text.trim().length < 2 || text.trim() === initial}
          className="px-2.5 py-1 rounded-md bg-accent text-accent-ink text-xs font-semibold disabled:opacity-40">
          {state === 'saving' ? 'Desant…' : 'Desar'}
        </button>
      </div>
      {state === 'error' && <span className="text-negative text-xs">{msg}</span>}
    </div>
  );
}
