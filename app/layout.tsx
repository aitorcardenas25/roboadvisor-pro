import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProviderWrapper } from '@/components/SessionProviderWrapper';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Factor OTC — RoboAdvisor',
  description: 'Eina de suport a la decisió d\'inversió per a clients de Factor OTC',
  robots: 'noindex, nofollow',
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
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then(reg => {
              reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                      window.location.reload();
                    }, { once: true });
                  }
                });
              });
            });
          }
        `}} />
      </body>
    </html>
  );
}
