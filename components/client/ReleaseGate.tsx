'use client';

// Fins que l'assessor aprova l'informe inicial, el client només veu una pantalla
// d'espera i "Les meves finances" (i la guia). Després, tot el portal.
// L'admin el veu igual en la vista del client; fora d'aquesta vista, no se li aplica.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { usePreview, useClientName } from './ClientPreview';

const OPEN_PATHS = ['/client/finances', '/client/guia'];

export default function ReleaseGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const preview = usePreview();
  const pathname = usePathname() ?? '';
  const name = useClientName(session?.user?.name);
  const [released, setReleased] = useState<boolean | null>(null);
  const [hasData, setHasData] = useState(false);

  const applies = status === 'authenticated' && (role === 'client' || !!preview);

  useEffect(() => {
    if (!applies) return;
    fetch('/api/client/onboarding', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        // Si no es pot saber, no es bloqueja (millor que deixar el client sense res)
        setReleased(j ? j.released !== false : true);
        setHasData(!!j?.steps?.some((s: { id: string; state: string }) => s.id === 'dades' && s.state === 'fet'));
      })
      .catch(() => setReleased(true));
  }, [applies, preview?.id]);

  if (!applies || OPEN_PATHS.some(p => pathname.startsWith(p))) return <>{children}</>;
  if (released === null) return (
    <div className="theme-client min-h-screen bg-canvas flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (released) return <>{children}</>;

  const first = name.split(' ')[0];
  return (
    <div className="theme-client min-h-screen bg-canvas">
      <main className="max-w-xl mx-auto px-4 py-12 sm:py-20">
        <div className="bg-surface border border-line rounded-xl p-6 sm:p-8">
          <p className="text-ink-muted text-xs">Factor OTC</p>
          <h1 className="text-ink font-bold text-xl mt-1">{first ? `Hola, ${first}` : 'Hola'}</h1>
          <p className="text-ink-soft text-sm leading-relaxed mt-3">
            El teu assessor està preparant el teu informe inicial: la foto de la teva situació, els teus objectius
            i una proposta de cartera. Quan el tingui llest, aquí veuràs l&apos;informe i tot el teu portal.
          </p>

          <ol className="mt-6 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${hasData ? 'bg-positive/15 text-positive' : 'bg-accent-soft text-accent font-semibold'}`}>{hasData ? '✓' : '1'}</span>
              <div>
                <p className="text-ink font-medium">Explica&apos;ns la teva situació</p>
                <p className="text-ink-muted text-xs mt-0.5">
                  {hasData ? 'Ja tenim les teves dades. Les pots revisar o completar quan vulguis.'
                    : 'Omple «Les meves finances» o envia l\'Excel al teu assessor. Si no saps una dada, deixa-la en blanc.'}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${hasData ? 'bg-accent-soft text-accent font-semibold' : 'bg-subtle text-ink-muted'}`}>2</span>
              <div>
                <p className="text-ink font-medium">El teu assessor prepara l&apos;informe</p>
                <p className="text-ink-muted text-xs mt-0.5">Te l&apos;explicarà abans que decideixis res.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 bg-subtle text-ink-muted">3</span>
              <div>
                <p className="text-ink font-medium">Veus l&apos;informe i el teu portal</p>
                <p className="text-ink-muted text-xs mt-0.5">Patrimoni, cartera, informes mensuals i la teva evolució.</p>
              </div>
            </li>
          </ol>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/client/finances" className="px-4 py-2 rounded-lg bg-accent text-accent-ink font-semibold text-sm">
              {hasData ? 'Revisar les meves finances' : 'Omplir les meves finances'}
            </Link>
            <a href="/api/client/template" className="px-4 py-2 rounded-lg border border-line text-ink text-sm hover:bg-subtle">
              Descarregar la plantilla Excel
            </a>
          </div>
          <div className="mt-6 pt-4 border-t border-line flex flex-wrap justify-between gap-2 text-xs">
            <Link href="/client/guia" className="text-accent hover:underline">Com funciona Factor OTC</Link>
            {!preview && <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="text-ink-muted hover:text-ink">Tancar sessió</button>}
          </div>
        </div>
      </main>
    </div>
  );
}
