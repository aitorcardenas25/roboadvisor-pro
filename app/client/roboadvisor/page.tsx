'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RoboAdvisorApp from '@/components/RoboAdvisorApp';
import { RECOMMENDATIONS_ENABLED } from '@/lib/featureFlags';

export default function RoboAdvisorPage() {
  const router = useRouter();

  // El flux qüestionari → cartera amb fons concrets (ISIN) i imports és
  // assessorament personalitzat. Desactivat fins tenir cobertura regulatòria.
  if (!RECOMMENDATIONS_ENABLED) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#0a1612] text-white">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Funcionalitat no disponible</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            La generació de carteres recomanades està desactivada. Pots consultar la teva cartera
            i la seva evolució des de l&apos;àrea de client.
          </p>
          <Link href="/client/cartera" className="inline-block text-[#c9a84c] text-sm underline">
            Anar a la meva cartera
          </Link>
        </div>
      </main>
    );
  }

  return (
    <RoboAdvisorApp onBack={() => router.push('/client/cartera')} />
  );
}
