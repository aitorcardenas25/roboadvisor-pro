import ConsentGate from '@/components/beta/ConsentGate';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ConsentGate>{children}</ConsentGate>;
}
