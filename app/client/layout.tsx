import ConsentGate from '@/components/beta/ConsentGate';
import ClientPreviewProvider from '@/components/client/ClientPreview';
import ReleaseGate from '@/components/client/ReleaseGate';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientPreviewProvider>
      <ConsentGate><ReleaseGate>{children}</ReleaseGate></ConsentGate>
    </ClientPreviewProvider>
  );
}
