'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LandingPage    from '@/components/LandingPage';
import RoboAdvisorApp from '@/components/RoboAdvisorApp';

export type AppView = 'landing' | 'roboadvisor' | 'admin';

export default function Home() {
  const [view, setView] = useState<AppView>('landing');
  const router = useRouter();

  const handleNavigate = (v: AppView) => {
    if (v === 'admin') {
      router.push('/admin');
      return;
    }
    setView(v);
  };

  if (view === 'roboadvisor') {
    return <RoboAdvisorApp onBack={() => setView('landing')} />;
  }

  return <LandingPage onNavigate={handleNavigate} />;
}