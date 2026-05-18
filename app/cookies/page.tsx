import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Cookies — Factor OTC',
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

export default function CookiesPage() {
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
          <h1 className="text-white font-bold text-2xl mb-2">Política de Cookies</h1>
          <p className="text-white/30 text-sm">Última actualització: maig 2026</p>
        </div>

        <Section title="1. Què són les cookies">
          <p>Les cookies són petits fitxers de text que els llocs web emmagatzemen al teu dispositiu quan els visites. Permeten que el lloc web recordi les teves accions i preferències durant un temps determinat.</p>
        </Section>

        <Section title="2. Quines cookies usem">
          <p>Factor OTC únicament utilitza <strong className="text-white/80">cookies tècniques essencials</strong> necessàries per al funcionament de la plataforma:</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-white/40 font-medium">Nom</th>
                  <th className="text-left py-2 pr-4 text-white/40 font-medium">Finalitat</th>
                  <th className="text-left py-2 pr-4 text-white/40 font-medium">Durada</th>
                  <th className="text-left py-2 text-white/40 font-medium">Tipus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 pr-4 text-white/70 font-mono">next-auth.session-token</td>
                  <td className="py-2 pr-4">Gestió de sessió autenticada</td>
                  <td className="py-2 pr-4">Sessió / 30 dies</td>
                  <td className="py-2">HTTP-only, Secure</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-white/70 font-mono">next-auth.csrf-token</td>
                  <td className="py-2 pr-4">Protecció contra CSRF</td>
                  <td className="py-2 pr-4">Sessió</td>
                  <td className="py-2">HTTP-only, Secure</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-white/70 font-mono">cookie-consent</td>
                  <td className="py-2 pr-4">Recorda que has acceptat les cookies</td>
                  <td className="py-2 pr-4">1 any</td>
                  <td className="py-2">localStorage</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="3. El que NO fem">
          <p>Factor OTC <strong className="text-white/80">no utilitza</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cookies de seguiment o analítica de tercers (Google Analytics, Hotjar, etc.)</li>
            <li>Cookies publicitàries o de retargeting</li>
            <li>Cookies de xarxes socials</li>
            <li>Fingerprinting del navegador</li>
            <li>Píxels de seguiment</li>
          </ul>
        </Section>

        <Section title="4. Base legal">
          <p>Les cookies tècniques essencials estan exemptes del consentiment previ en virtut de l&apos;article 22.2 de la Llei 34/2002 de Serveis de la Societat de la Informació (LSSI), ja que són estrictament necessàries per a la prestació del servei.</p>
        </Section>

        <Section title="5. Com gestionar les cookies">
          <p>Pots configurar el teu navegador per bloquejar o eliminar cookies. Ten en compte que bloquejar les cookies tècniques pot afectar el funcionament de la plataforma (no podràs iniciar sessió).</p>
          <p>Instruccions per gestionar cookies als principals navegadors:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong className="text-white/70">Chrome</strong>: Configuració → Privadesa i seguretat → Cookies</li>
            <li><strong className="text-white/70">Firefox</strong>: Preferències → Privadesa i seguretat</li>
            <li><strong className="text-white/70">Safari</strong>: Preferències → Privadesa</li>
            <li><strong className="text-white/70">Edge</strong>: Configuració → Cookies i permisos del lloc</li>
          </ul>
        </Section>

        <Section title="6. Actualitzacions">
          <p>Podrem actualitzar aquesta política si introduïm nous serveis o canviem la tecnologia de la plataforma. En cas d&apos;incorporar cookies no essencials, sol·licitarem el teu consentiment explícit prèviament.</p>
        </Section>

        <Section title="7. Contacte">
          <p>Per a qualsevol consulta sobre l&apos;ús de cookies: <a href="mailto:privacitat@factorotc.com" className="text-[#c9a84c] hover:underline">privacitat@factorotc.com</a></p>
          <p className="mt-2">Consulta també la nostra <Link href="/privacitat" className="text-[#c9a84c] hover:underline">Política de Privacitat</Link> per a informació completa sobre el tractament de dades.</p>
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
