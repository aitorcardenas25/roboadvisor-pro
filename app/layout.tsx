import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';
import CookieBanner from '@/components/CookieBanner';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Factor OTC — Assessorament Financer Independent',
  description: 'Assessorament financer independent per a inversors minoristes. Informe inicial, seguiment de cartera i subscripció mensual. Catalunya.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Factor OTC — Assessorament Financer Independent',
    description: 'Assessorament financer per a inversors minoristes a Catalunya. Informe inicial 20€, seguiment mensual de cartera.',
    type: 'website',
    locale: 'ca_ES',
    siteName: 'Factor OTC',
  },
  twitter: {
    card: 'summary',
    title: 'Factor OTC',
    description: 'Assessorament financer independent per a inversors minoristes.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Factor OTC',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#c9a84c',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={inter.variable}>
      <body className="font-sans antialiased">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
        <CookieBanner />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            if (!('serviceWorker' in navigator)) return;
            // Skip SW registration on localhost — avoids Safari issues with
            // cached stale HTML during development and HMR interference.
            var h = location.hostname;
            if (h === 'localhost' || h === '127.0.0.1' || /^192\\.168\\./.test(h) || /^10\\./.test(h)) return;
            navigator.serviceWorker.register('/sw.js').then(function(reg) {
              reg.addEventListener('updatefound', function() {
                var newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', function() {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    navigator.serviceWorker.addEventListener('controllerchange', function() {
                      window.location.reload();
                    }, { once: true });
                  }
                });
              });
            }).catch(function() {});
          })();
        `}} />
      </body>
    </html>
  );
}
