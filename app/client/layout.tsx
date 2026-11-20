import ConsentGate from '@/components/beta/ConsentGate';
import ClientPreviewProvider from '@/components/client/ClientPreview';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientPreviewProvider><ConsentGate>{children}</ConsentGate></ClientPreviewProvider>;
}
