'use client';

// Barra de navegació única del portal del client.
// Escriptori: logo + seccions + nom en una línia.
// Mòbil: logo + nom a dalt i les seccions en una segona línia que es pot
// lliscar (sense que la pàgina sencera faci scroll horitzontal).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const LINKS = [
  { href: '/client/patrimoni',       label: 'Patrimoni' },
  { href: '/client/cartera',         label: 'Cartera' },
  { href: '/client/finances',        label: 'Finances' },
  { href: '/client/informe-inicial', label: 'Informe' },
  { href: '/client/guia',            label: 'Guia' },
];

export default function ClientNav({ name, actions }: { name?: string | null; actions?: ReactNode }) {
  const path = usePathname() ?? '';
  const links = LINKS.map(l => {
    const active = path === l.href || path.startsWith(`${l.href}/`);
    return (
      <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined}
        className={`whitespace-nowrap px-2.5 py-1.5 rounded-md text-sm transition-colors ${
          active ? 'text-accent font-medium bg-accent/10' : 'text-ink-muted hover:text-ink-soft'}`}>
        {l.label}
      </Link>
    );
  });

  return (
    <nav aria-label="Seccions del portal" className="border-b border-line bg-surface sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/client/patrimoni" className="flex items-center gap-2 flex-shrink-0">
          <span className="w-6 h-6 bg-subtle-strong border border-accent/50 rounded flex items-center justify-center">
            <span className="text-accent font-semibold text-[10px] leading-none">F</span>
          </span>
          <span className="text-ink-soft text-sm font-medium">Factor OTC</span>
        </Link>
        <div className="hidden md:flex items-center gap-1 min-w-0">{links}</div>
        <div className="flex items-center gap-3 min-w-0 justify-end">
          {actions}
          {name && <span className="text-ink-muted text-xs truncate max-w-[10rem]">{name}</span>}
        </div>
      </div>
      <div className="md:hidden border-t border-line">
        <div className="max-w-5xl mx-auto px-2 py-1.5 flex gap-1 overflow-x-auto">{links}</div>
      </div>
    </nav>
  );
}
