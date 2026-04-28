// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RoboAdvisor Pro — Eina de suport a la decisió d\'inversió',
  description: 'Perfilació avançada d\'inversors i recomanació de carteres de fons d\'inversió personalitzades. Eina orientativa. No constitueix assessorament financer regulat.',
  keywords: ['roboadvisor', 'inversió', 'fons', 'cartera', 'perfil inversor', 'finances personals'],
  authors: [{ name: 'RoboAdvisor Pro' }],
  robots: 'noindex, nofollow',
  openGraph: {
    title: 'RoboAdvisor Pro',
    description: 'Eina de suport a la decisió d\'inversió',
    type: 'website',
    locale: 'ca_ES',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}