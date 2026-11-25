'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('cookie-consent')) setVisible(true);
    } catch {
      // Safari Private mode: localStorage may throw QuotaExceededError
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem('cookie-consent', 'true');
    } catch {
      // Safari Private mode: ignore write failure
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 print:hidden theme-client bg-surface border-t border-line shadow-[0_-1px_8px_rgba(0,0,0,0.04)] px-4 py-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-ink-soft text-xs leading-relaxed flex-1">
          Usem cookies tècniques essencials per al funcionament de la plataforma. No usem cookies de seguiment ni publicitàries.{' '}
          <Link href="/cookies" className="text-accent hover:text-accent-hover underline transition-colors">
            Més informació
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-4 py-2 bg-accent hover:bg-accent-hover text-accent-ink font-semibold text-xs rounded-lg transition-colors">
          Acceptar
        </button>
      </div>
    </div>
  );
}
