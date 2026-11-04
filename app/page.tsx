'use client';

import { useRouter } from 'next/navigation';
import LandingPage from '@/components/LandingPage';

export type AppView = 'landing' | 'roboadvisor' | 'admin';

export default function Home() {
  const router = useRouter();

  const handleNavigate = (v: AppView) => {
    if (v === 'admin')       { router.push('/admin'); return; }
    if (v === 'roboadvisor') { router.push('/client/roboadvisor'); return; }
  };

  return <LandingPage onNavigate={handleNavigate} />;
}
