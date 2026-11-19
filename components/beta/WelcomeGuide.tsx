'use client';

// Benvinguda i 3 primers passos del client de la beta.
// L'estat de cada pas el calcula el servidor (GET /api/client/onboarding).
// "Amagar la benvinguda" només es recorda en aquest navegador (comoditat):
// els passos pendents es continuen mostrant en format compacte.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OnboardingStatus, StepId, StepState } from '@/lib/onboarding';

const DISMISS_KEY = 'factorotc.benvinguda.amagada';

export const STEP_TEXT: Record<StepId, { title: string; body: string }> = {
  dades: {
    title: 'Explica\'ns la teva situació',
    body: 'Omple la plantilla Excel amb els teus ingressos, despeses, estalvis i objectius (uns 15 minuts). '
      + 'Si ja tens fons o ETF, hi afegeixes també què tens i on. Si una dada no la saps, deixa-la en blanc.',
  },
  proposta: {
    title: 'El teu assessor prepara una proposta',
    body: 'Amb les teves dades, l\'assessor revisa el pressupost i el fons d\'emergència i et prepara una proposta de cartera. '
      + 'Te l\'explica abans que decideixis res: tu tries si l\'apliques o no.',
  },
  seguiment: {
    title: 'Segueix el teu patrimoni aquí',
    body: 'Quan inverteixis, en aquest portal veuràs quant val tot el que tens, quant has guanyat o perdut i l\'informe de cada mes.',
  },
};

const STATE_LABEL: Record<StepState, string> = { fet: 'Fet', 'en-curs': 'Ara', pendent: 'Després' };
const STATE_CLASS: Record<StepState, string> = {
  fet:       'text-positive border-positive/30 bg-positive/5',
  'en-curs': 'text-accent border-accent/40 bg-accent-soft',
  pendent:   'text-ink-muted border-line bg-subtle',
};

function StepActions({ id }: { id: StepId }) {
  const btn  = 'inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium';
  if (id === 'dades') return (
    <div className="flex flex-wrap gap-2 mt-3">
      <a href="/api/client/template" className={`${btn} bg-accent text-accent-ink hover:bg-accent-hover`}>Descarregar la plantilla (.xlsx)</a>
      <Link href="/client/guia#plantilla" className={`${btn} border border-line text-ink-soft hover:border-line-strong`}>Com s&apos;omple</Link>
      <Link href="/client/finances" className={`${btn} border border-line text-ink-soft hover:border-line-strong`}>Prefereixo el formulari</Link>
    </div>
  );
  if (id === 'seguiment') return (
    <div className="flex flex-wrap gap-2 mt-3">
      <Link href="/client/cartera" className={`${btn} border border-line text-ink-soft hover:border-line-strong`}>La meva cartera</Link>
    </div>
  );
  return null;
}

/** Llista dels 3 passos. `status` null = encara no se sap (es mostren sense estat). */
export function StepList({ status, actions = true }: { status: OnboardingStatus | null; actions?: boolean }) {
  const ids: StepId[] = ['dades', 'proposta', 'seguiment'];
  return (
    <ol className="divide-y divide-line">
      {ids.map((id, i) => {
        const state = status?.steps.find(s => s.id === id)?.state;
        return (
          <li key={id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <span className="w-7 h-7 flex-shrink-0 rounded-full border border-line-strong text-ink-soft text-sm flex items-center justify-center">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-ink font-semibold text-sm">{STEP_TEXT[id].title}</h3>
                {state && <span className={`text-[11px] px-2 py-0.5 rounded border ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>}
              </div>
              <p className="text-ink-soft text-sm leading-relaxed mt-1">{STEP_TEXT[id].body}</p>
              {actions && state !== 'fet' && (id === 'dades' || state === 'en-curs') && <StepActions id={id} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function WelcomeGuide({ name }: { name?: string }) {
  const [status, setStatus]       = useState<OnboardingStatus | null>(null);
  const [failed, setFailed]       = useState(false);
  const [dismissed, setDismissed] = useState(true); // fins llegir el navegador, no es mostra la benvinguda gran

  useEffect(() => {
    try { setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); }
    fetch('/api/client/onboarding', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((j: OnboardingStatus) => setStatus(j))
      .catch(() => setFailed(true));
  }, []);

  function dismiss() {
    setDismissed(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* navegador sense emmagatzematge: només dura aquesta visita */ }
  }

  if (failed || !status) return null;
  if (status.complete && dismissed) return null;

  const first = name?.trim().split(' ')[0];

  if (dismissed) {
    const done = status.steps.filter(s => s.state === 'fet').length;
    const current = status.steps.find(s => s.state === 'en-curs');
    return (
      <section className="bg-surface border border-line rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-3" aria-label="Primers passos">
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold">Primers passos: {done} de 3 fets</p>
          {current && <p className="text-ink-muted text-sm">Ara: {STEP_TEXT[current.id].title.toLowerCase()}.</p>}
        </div>
        <div className="flex gap-2">
          {current?.id === 'dades' && (
            <a href="/api/client/template" className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-accent-ink hover:bg-accent-hover">Descarregar la plantilla</a>
          )}
          <Link href="/client/guia" className="px-3 py-1.5 rounded-md text-xs font-medium border border-line text-ink-soft hover:border-line-strong">Veure la guia</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface border border-line rounded-lg mb-6" aria-labelledby="benvinguda-titol">
      <div className="p-5 sm:p-6 border-b border-line">
        <h2 id="benvinguda-titol" className="text-ink font-bold text-xl">{first ? `Benvingut/da, ${first}` : 'Benvingut/da a Factor OTC'}</h2>
        <p className="text-ink-soft text-sm leading-relaxed mt-2 max-w-2xl">
          Factor OTC t&apos;ajuda a tenir els teus diners ordenats: tot el que tens, a tots els bancs, en una sola pantalla,
          i com evolucionen les teves inversions. Ets a la beta, que és gratuïta. Les teves opinions ens ajuden a millorar-la.
        </p>
        <ul className="text-ink-muted text-xs mt-3 space-y-1">
          <li>Factor OTC no és un banc i no mou els teus diners: els teus fons continuen al teu banc o broker.</li>
          <li>Les decisions sempre són teves.</li>
        </ul>
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="text-ink-muted text-xs mb-4">Com funciona, en 3 passos</h3>
        <StepList status={status} />
      </div>
      <div className="px-5 sm:px-6 py-4 border-t border-line flex flex-wrap items-center justify-between gap-3 bg-subtle/50 rounded-b-lg">
        <Link href="/client/guia" className="text-accent text-sm hover:underline">Guia completa i paraules que veuràs</Link>
        <button type="button" onClick={dismiss} className="px-4 py-2 rounded-lg bg-subtle text-ink text-sm hover:bg-subtle-strong">
          Entesos, amaga la benvinguda
        </button>
      </div>
    </section>
  );
}
