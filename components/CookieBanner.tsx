'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem('cookie-consent', 'true');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1f1a] border-t border-white/10 px-4 py-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-white/50 text-xs leading-relaxed flex-1">
          Usem cookies tècniques essencials per al funcionament de la plataforma. No usem cookies de seguiment ni publicitàries.{' '}
          <Link href="/cookies" className="text-[#c9a84c]/70 hover:text-[#c9a84c] underline transition-colors">
            Més informació
          </Link>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-semibold text-xs rounded-lg transition-colors">
          Acceptar
        </button>
      </div>
    </div>
  );
}
