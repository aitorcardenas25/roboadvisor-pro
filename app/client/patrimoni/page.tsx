'use client';

import ClientNav from '@/components/client/ClientNav';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import WealthView from '@/components/wealth/WealthView';
import GoalsProgress from '@/components/goals/GoalsProgress';
import WelcomeGuide from '@/components/beta/WelcomeGuide';
import { useClientName } from '@/components/client/ClientPreview';

export default function ClientPatrimoniPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.push('/login?callbackUrl=/client/patrimoni'); }, [status, router]);
  const name = useClientName(session?.user?.name);

  return (
    <div className="theme-client min-h-screen bg-canvas">
      <ClientNav name={name} />

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-ink font-bold text-2xl mb-1">El meu patrimoni</h1>
        <p className="text-ink-muted text-sm mb-6">Tot el que tens, a tots els bancs i entitats, en una sola pantalla.</p>
        {status === 'authenticated' && <WelcomeGuide name={name} />}
        {status === 'authenticated' && <GoalsProgress />}
        {status === 'authenticated' && <WealthView endpoint="/api/client/wealth" />}
      </main>
    </div>
  );
}
