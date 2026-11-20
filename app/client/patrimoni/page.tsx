'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      <nav className="border-b border-line bg-surface sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-accent font-semibold text-[9px] leading-none">F</span>
            </div>
            <span className="text-ink-muted text-sm hidden sm:inline">Factor OTC</span>
            <span className="text-ink-muted text-sm hidden sm:inline">/</span>
            <span className="text-ink-soft text-sm truncate">El meu patrimoni</span>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 text-xs">
            <Link href="/client/cartera" className="text-ink-muted hover:text-accent transition-colors">La meva cartera</Link>
            <Link href="/client/finances" className="text-ink-muted hover:text-accent transition-colors">Les meves finances</Link>
            <Link href="/client/guia" className="text-ink-muted hover:text-accent transition-colors">Guia</Link>
            {name && <span className="text-ink-muted hidden md:inline">{name}</span>}
          </div>
        </div>
      </nav>

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
