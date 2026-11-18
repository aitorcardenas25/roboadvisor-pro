'use client';

import { useState } from 'react';
import Link from 'next/link';
import LeadForm from '@/components/LeadForm';

/**
 * Portada de la beta tancada (direcció A: banca privada, clara i sòbria).
 * Un sol objectiu: explicar què és el servei i portar a "Sol·licitar accés"
 * o "Accés clients". Sense animacions, sense dades simulades.
 */

const STEPS = [
  {
    title: 'Ens passes les teves dades',
    desc: "Omples una plantilla senzilla amb estalvis, ingressos, despeses i objectius. Si no saps alguna xifra, la deixes en blanc.",
  },
  {
    title: 'Preparem la proposta amb tu',
    desc: 'Primer ordenem el pressupost i el fons d’emergència. Després construïm una cartera de fons i la revisem junts abans de fer res.',
  },
  {
    title: 'En segueixes l’evolució',
    desc: 'Veus quant val la cartera i quant ha rendit de veritat, amb informe mensual i descàrrega en Excel per períodes.',
  },
];

const IS = [
  'Una visió única de la teva inversió, encara que la tinguis repartida.',
  'Rendibilitat calculada amb els valors liquidatius oficials de cada fons.',
  'Un informe mensual clar, sense jerga.',
  'Una persona de confiança que t’acompanya.',
];

const IS_NOT = [
  'No custodiem diners ni executem operacions: els teus fons continuen a la teva entitat.',
  'No és un servei d’assessorament financer regulat.',
  'No et prometem rendibilitats.',
  'Durant la beta no té cap cost.',
];

export default function LandingPage() {
  const [showLeadForm, setShowLeadForm] = useState(false);

  return (
    <div className="theme-client min-h-screen bg-canvas text-ink">
      {/* Capçalera */}
      <header className="border-b border-line bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-semibold text-lg text-ink">Factor</span>
            <span className="text-lg text-accent">OTC</span>
          </Link>
          <Link href="/login"
            className="text-sm font-medium px-4 py-2 rounded-md border border-line-strong text-ink hover:bg-subtle transition-colors">
            Accés clients
          </Link>
        </div>
      </header>

      <main>
        {/* Presentació */}
        <section className="bg-surface border-b border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <p className="text-sm text-accent font-medium mb-4">Beta privada · només per invitació</p>
            <h1 className="text-3xl sm:text-5xl font-semibold leading-tight max-w-3xl text-ink">
              Els teus estalvis, ordenats i amb la rendibilitat real.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-ink-soft max-w-2xl leading-relaxed">
              Factor OTC és un servei personal: t&apos;ajudem a ordenar les finances, preparem amb tu una
              cartera de fons i en fem el seguiment amb dades oficials, explicades en llenguatge planer.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button onClick={() => setShowLeadForm(true)}
                className="px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-accent-ink font-medium text-sm transition-colors">
                Sol·licitar accés
              </button>
              <Link href="/login"
                className="px-6 py-3 rounded-md border border-line-strong text-ink hover:bg-subtle font-medium text-sm text-center transition-colors">
                Ja tinc compte
              </Link>
            </div>
          </div>
        </section>

        {/* Com funciona */}
        <section className="border-b border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="text-2xl font-semibold mb-10">Com funciona</h2>
            <ol className="grid gap-8 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="border-t-2 border-accent pt-4">
                  <span className="text-sm text-ink-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-1 font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Què és i què no és */}
        <section className="border-b border-line bg-surface">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold mb-5">Què et donem</h2>
              <ul className="space-y-3">
                {IS.map(t => (
                  <li key={t} className="flex gap-3 text-sm text-ink-soft leading-relaxed">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-5">Què no fem</h2>
              <ul className="space-y-3">
                {IS_NOT.map(t => (
                  <li key={t} className="flex gap-3 text-sm text-ink-soft leading-relaxed">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Crida final */}
        <section>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold">Places limitades durant la beta</h2>
              <p className="mt-2 text-sm text-ink-soft">Deixa&apos;ns les teves dades i et contactarem personalment.</p>
            </div>
            <button onClick={() => setShowLeadForm(true)}
              className="px-6 py-3 rounded-md bg-accent hover:bg-accent-hover text-accent-ink font-medium text-sm transition-colors">
              Sol·licitar accés
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 justify-between text-xs text-ink-muted">
          <p>© {new Date().getFullYear()} Factor OTC</p>
          <nav className="flex gap-5">
            <Link href="/privacitat" className="hover:text-ink">Privacitat</Link>
            <Link href="/cookies" className="hover:text-ink">Cookies</Link>
            <Link href="/login" className="hover:text-ink">Accés clients</Link>
          </nav>
          <p className="sm:max-w-xs sm:text-right">
            No constitueix assessorament financer regulat · No executa operacions reals
          </p>
        </div>
      </footer>

      {showLeadForm && <LeadForm onClose={() => setShowLeadForm(false)} />}
    </div>
  );
}
