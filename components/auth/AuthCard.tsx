// Marc comú de les pantalles d'accés (login, crear contrasenya, recuperar-la).
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="theme-client min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="w-8 h-8 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center">
              <span className="text-accent font-semibold text-sm leading-none">F</span>
            </span>
            <span className="text-ink font-semibold text-xl">FACTOR</span>
            <span className="text-accent font-light text-xl">OTC</span>
          </Link>
        </div>
        <div className="bg-surface border border-line rounded-lg p-6 sm:p-8">
          <h1 className="text-ink font-bold text-xl mb-1">{title}</h1>
          {subtitle && <div className="text-ink-muted text-sm mb-6">{subtitle}</div>}
          {children}
        </div>
        {footer && <div className="text-center text-ink-muted text-xs mt-4">{footer}</div>}
      </div>
    </div>
  );
}

export const inputCls = 'w-full bg-surface border border-line-strong rounded-lg px-4 py-3 text-ink text-base sm:text-sm focus:outline-none focus:border-accent/70';
export const buttonCls = 'w-full py-3 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-sm rounded-lg disabled:opacity-40 transition-colors';
