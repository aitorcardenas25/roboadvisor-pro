'use client';

// Guia del client: els 3 passos, com s'omple la plantilla Excel i les paraules
// que veurà al portal, explicades sense tecnicismes.
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StepList } from '@/components/beta/WelcomeGuide';
import type { OnboardingStatus } from '@/lib/onboarding';

const card = 'bg-surface border border-line rounded-lg p-5 sm:p-6';

const SHEETS: { name: string; when: string; rows: [string, string][] }[] = [
  {
    name: 'Dades personals',
    when: 'Tothom. És la pestanya més important.',
    rows: [
      ['Ingressos nets mensuals', 'El que et queda a la nòmina cada mes, després d\'impostos. Si cobres 14 pagues, suma-les i divideix per 12.'],
      ['Despeses fixes al mes', 'El que pagues cada mes sí o sí: lloguer, factures, menjar, transport, assegurances.'],
      ['Despeses variables al mes', 'El que canvia d\'un mes a l\'altre: oci, roba, sopars, viatges. Una aproximació ja serveix.'],
      ['Estalvis en efectiu', 'Els diners que tens al compte corrent o en comptes d\'estalvi, sense comptar inversions.'],
      ['Deute total pendent', 'El que encara deus: préstec del cotxe, hipoteca, estudis. Si no en tens, posa 0.'],
      ['Com et veus invertint', 'Conservador si una baixada et trauria la son; Equilibrat si acceptes alts i baixos moderats; Dinàmic si pots esperar anys encara que baixi molt.'],
    ],
  },
  {
    name: 'Objectius',
    when: 'Tothom. Una línia per a cada cosa que vols aconseguir.',
    rows: [
      ['Termini', 'Ja ve posat: curt (menys d\'un any), mitjà (1 a 5 anys) i llarg (més de 5 anys).'],
      ['Què vols aconseguir', 'Amb les teves paraules: "fons d\'emergència", "entrada d\'un pis", "jubilació", "viatge".'],
      ['Import i any', 'Si ho saps, quant necessites i per a quin any. Si no, deixa-ho en blanc.'],
    ],
  },
  {
    name: 'Posicions',
    when: 'Només si ja tens fons o ETF. Si no inverteixes, deixa-la buida. Si l\'omples, cada fila necessita ISIN, participacions i preu mitjà.',
    rows: [
      ['ISIN', 'El codi de 12 lletres i números de cada fons (per exemple IE00B42W4L06). Surt a l\'app o a l\'extracte del banc o broker.'],
      ['Broker / entitat', 'On el tens: MyInvestor, Renta 4, Indexa, el teu banc...'],
      ['Participacions', 'Quantes participacions tens. Surt al mateix extracte, al costat del fons.'],
      ['Preu mitjà de compra', 'Obligatori. El que et va costar cada participació de mitjana; al broker sol sortir com a "preu mitjà" o "cost mitjà". Si no el trobes, divideix el total que hi has posat entre les participacions.'],
    ],
  },
  {
    name: 'Moviments',
    when: 'Opcional, però com més n\'hi posis, més exacta serà la teva rendibilitat.',
    rows: [
      ['Data', 'El dia de la compra o venda, en format dd/mm/aaaa (per exemple 15/03/2025).'],
      ['Tipus', 'Tria al desplegable: Compra, Venda, Aportació, Retirada o Rebalanceig.'],
      ['Import total', 'Els euros que hi vas posar (o que vas treure) aquell dia.'],
    ],
  },
];

const GLOSSARY: [string, string][] = [
  ['Patrimoni net', 'Tot el que tens (comptes, inversions, pis...) menys el que deus.'],
  ['Fons d\'emergència', 'Diners apartats per a imprevistos, normalment entre 3 i 6 mesos de despeses. Va abans que invertir.'],
  ['Fons d\'inversió i ETF', 'Una cistella de moltes empreses o bons que compres de cop. Un ETF és un fons que cotitza a borsa.'],
  ['Valor liquidatiu', 'El preu oficial d\'una participació d\'un fons en un dia concret. El publica la gestora del fons.'],
  ['Rendibilitat', 'Quant has guanyat o perdut, en percentatge. La "real" descompta les aportacions que has fet tu.'],
  ['Volatilitat', 'Com de fort puja i baixa una inversió. Més volatilitat vol dir més alts i baixos.'],
  ['Caiguda màxima', 'La pitjor baixada que ha tingut, des d\'un màxim fins al punt més baix. Serveix per saber què pot passar en un mal any.'],
  ['Comissions (TER)', 'El que cobra el fons cada any, en percentatge. Un 0,20 % vol dir 2 € l\'any per cada 1.000 € invertits.'],
];

export default function ClientGuidePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [steps, setSteps] = useState<OnboardingStatus | null>(null);
  useEffect(() => { if (status === 'unauthenticated') router.push('/login?callbackUrl=/client/guia'); }, [status, router]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/client/onboarding', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).then(j => { if (j) setSteps(j); }).catch(() => {});
  }, [status]);
  const name = session?.user?.name ?? '';

  return (
    <div className="theme-client min-h-screen bg-canvas">
      <nav className="border-b border-line bg-surface sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-semibold text-[9px] leading-none">F</span>
            </div>
            <span className="text-ink-muted text-sm hidden sm:inline">Factor OTC</span>
            <span className="text-ink-muted text-sm hidden sm:inline">/</span>
            <span className="text-ink-soft text-sm truncate">Guia</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-xs">
            <Link href="/client/patrimoni" className="text-ink-muted hover:text-accent transition-colors">El meu patrimoni</Link>
            <Link href="/client/cartera" className="text-ink-muted hover:text-accent transition-colors">La meva cartera</Link>
            <Link href="/client/finances" className="text-ink-muted hover:text-accent transition-colors hidden sm:inline">Les meves finances</Link>
            {name && <span className="text-ink-muted hidden md:inline">{name}</span>}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-ink font-bold text-2xl mb-1">Guia per començar</h1>
          <p className="text-ink-muted text-sm">Com funciona Factor OTC, com s&apos;omple la plantilla i què volen dir les paraules que veuràs.</p>
        </header>

        <section className={card} aria-labelledby="passos">
          <h2 id="passos" className="text-ink font-semibold text-lg mb-4">Els 3 passos</h2>
          <StepList status={steps} />
        </section>

        <section id="plantilla" className={`${card} scroll-mt-20`} aria-labelledby="plantilla-titol">
          <h2 id="plantilla-titol" className="text-ink font-semibold text-lg">Com s&apos;omple la plantilla Excel</h2>
          <p className="text-ink-soft text-sm leading-relaxed mt-2">
            La plantilla té quatre pestanyes a baix de tot. Només cal escriure a les caselles en blanc.
            Si una dada no la saps, deixa-la buida: és millor buida que inventada. Les xifres, sense el símbol €.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <a href="/api/client/template" className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-semibold hover:bg-accent-hover">
              Descarregar la plantilla (.xlsx)
            </a>
            <Link href="/client/finances" className="inline-flex items-center px-4 py-2 rounded-lg border border-line text-ink-soft text-sm hover:border-line-strong">
              Si encara no inverteixes, pots fer servir el formulari
            </Link>
          </div>

          <div className="mt-6 space-y-6">
            {SHEETS.map((s, i) => (
              <div key={s.name}>
                <h3 className="text-ink font-semibold text-sm">Pestanya {i + 1}: {s.name}</h3>
                <p className="text-ink-muted text-xs mt-0.5 mb-2">{s.when}</p>
                <dl className="border border-line rounded-md divide-y divide-line">
                  {s.rows.map(([k, v]) => (
                    <div key={k} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-3 py-2.5">
                      <dt className="text-ink text-sm font-medium">{k}</dt>
                      <dd className="text-ink-soft text-sm leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-ink font-semibold text-sm">Quan l&apos;hagis omplert</h3>
            <ul className="text-ink-soft text-sm leading-relaxed mt-2 space-y-1 list-disc pl-5">
              <li>Desa el fitxer sense canviar el nom de les pestanyes ni l&apos;ordre de les columnes.</li>
              <li>Envia&apos;l al teu assessor pel canal que t&apos;hagi indicat. Són dades personals: no el comparteixis per xarxes socials ni grups.</li>
              <li>L&apos;assessor el carrega a la teva fitxa i, si hi ha alguna dada que no s&apos;entén, t&apos;ho pregunta abans.</li>
            </ul>
          </div>
        </section>

        <section className={card} aria-labelledby="glossari">
          <h2 id="glossari" className="text-ink font-semibold text-lg mb-3">Paraules que veuràs</h2>
          <dl className="divide-y divide-line">
            {GLOSSARY.map(([k, v]) => (
              <div key={k} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 py-2.5">
                <dt className="text-ink text-sm font-medium">{k}</dt>
                <dd className="text-ink-soft text-sm leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="text-ink-muted text-xs leading-relaxed">
          Factor OTC no és un banc ni mou els teus diners. La informació d&apos;aquest portal és descriptiva i les decisions d&apos;inversió són sempre teves.
        </p>
      </main>
    </div>
  );
}
