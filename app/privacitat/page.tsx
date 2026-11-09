import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacitat — Factor OTC',
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-white font-bold text-lg mb-3">{title}</h2>
      <div className="text-white/60 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacitatPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white font-black text-lg tracking-wider">FACTOR</span>
            <span className="text-[#c9a84c] font-light text-lg tracking-widest">OTC</span>
          </Link>
          <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">← Tornar</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-white font-bold text-2xl mb-2">Política de Privacitat</h1>
          <p className="text-white/30 text-sm">Última actualització: novembre 2026</p>
        </div>

        <Section title="1. Qui som">
          <p>Factor OTC és una eina de planificació i seguiment de les finances personals per a particulars a Catalunya i Espanya. Actualment funciona com a prova pilot tancada. El responsable del tractament de dades és Factor OTC, contactable a <a href="mailto:privacitat@factorotc.com" className="text-[#c9a84c] hover:underline">privacitat@factorotc.com</a>.</p>
        </Section>

        <Section title="2. Dades que recollim">
          <p>Recollim les dades que ens facilites directament:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Dades d&apos;identificació: nom i cognoms, correu electrònic, telèfon</li>
            <li>Dades financeres: perfil d&apos;inversor, cartera d&apos;inversió, transaccions, objectius financers</li>
            <li>Dades de contacte i comunicació: sol·licituds, missatges, consentiment de comunicació</li>
            <li>Dades de pagament: gestionades íntegrament per Stripe (no emmagatzemem dades de targeta)</li>
          </ul>
        </Section>

        <Section title="3. Com les usem">
          <p>Usem les teves dades per:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prestar el servei de planificació i seguiment i generar informes personalitzats</li>
            <li>Gestionar la teva cartera i el seguiment mensual</li>
            <li>Enviar comunicacions relacionades amb el servei (informes, recordatoris, novetats)</li>
            <li>Complir les obligacions legals que ens siguin aplicables</li>
          </ul>
        </Section>

        <Section title="4. Base legal">
          <p>El tractament es basa en:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white/80">Execució del contracte</strong>: per prestar els serveis contractats</li>
            <li><strong className="text-white/80">Consentiment</strong>: per comunicacions comercials i newsletter</li>
            <li><strong className="text-white/80">Obligació legal</strong>: quan una llei ens obligui a conservar o comunicar dades</li>
            <li><strong className="text-white/80">Interès legítim</strong>: per la seguretat i millora del servei</li>
          </ul>
        </Section>

        <Section title="5. Tercers (processadors de dades)">
          <p>Treballem amb els següents proveïdors que actuen com a processadors de dades sota contractes adequats:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white/80">Supabase</strong> — emmagatzematge de dades</li>
            <li><strong className="text-white/80">Resend</strong> — enviament de correus electrònics</li>
            <li><strong className="text-white/80">Stripe</strong> — processament de pagaments (certificació PCI DSS)</li>
            <li><strong className="text-white/80">Vercel</strong> — allotjament de l&apos;aplicació</li>
          </ul>
        </Section>

        <Section title="6. Retenció de dades">
          <p>Conservem les teves dades mentre siguis client actiu i durant el temps que exigeixi la llei un cop deixis de ser-ho. Les dades de leads no convertits s&apos;eliminen als 2 anys.</p>
        </Section>

        <Section title="7. Els teus drets (RGPD)">
          <p>Tens dret a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white/80">Accés</strong>: obtenir una còpia de les teves dades</li>
            <li><strong className="text-white/80">Rectificació</strong>: corregir dades inexactes</li>
            <li><strong className="text-white/80">Eliminació</strong>: sol·licitar l&apos;esborrat de les teves dades</li>
            <li><strong className="text-white/80">Portabilitat</strong>: rebre les teves dades en format llegible per màquina</li>
            <li><strong className="text-white/80">Oposició</strong>: oposar-te a determinats tractaments</li>
          </ul>
          <p className="mt-2">Per exercir qualsevol dret, contacta a <a href="mailto:privacitat@factorotc.com" className="text-[#c9a84c] hover:underline">privacitat@factorotc.com</a>. Si ets client, també pots descarregar les teves dades i demanar-ne l&apos;eliminació des de la pàgina <Link href="/client/finances" className="text-[#c9a84c] hover:underline">Les meves finances</Link>.</p>
          <p>Tens dret a presentar reclamació davant l&apos;Agència Espanyola de Protecció de Dades (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] hover:underline">aepd.es</a>).</p>
        </Section>

        <Section title="8. Cookies">
          <p>Usem únicament cookies tècniques essencials per al funcionament de la plataforma (gestió de sessió). No usem cookies de seguiment, analítica de tercers ni publicitàries. Consulta la nostra <Link href="/cookies" className="text-[#c9a84c] hover:underline">política de cookies</Link>.</p>
        </Section>

        <Section title="9. Contacte">
          <p>Per a qualsevol consulta sobre privacitat: <a href="mailto:privacitat@factorotc.com" className="text-[#c9a84c] hover:underline">privacitat@factorotc.com</a></p>
        </Section>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-white/20 text-xs">
        © {new Date().getFullYear()} Factor OTC ·{' '}
        <Link href="/privacitat" className="hover:text-white/40 transition-colors">Privacitat</Link> ·{' '}
        <Link href="/cookies" className="hover:text-white/40 transition-colors">Cookies</Link>
      </footer>
    </div>
  );
}
