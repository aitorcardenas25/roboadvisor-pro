'use client';

import { useRouter } from 'next/navigation';
import RoboAdvisorApp from '@/components/RoboAdvisorApp';

export default function RoboAdvisorPage() {
  const router = useRouter();
  return (
    <RoboAdvisorApp onBack={() => router.push('/client/cartera')} />
  );
}
