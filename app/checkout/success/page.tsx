'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }
    fetch(`/api/checkout/verify?session_id=${sessionId}`)
      .then(r => r.ok ? setStatus('success') : setStatus('error'))
      .catch(() => setStatus('error'));
  }, [sessionId]);

  return (
    <>
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="w-12 h-12 border-2 border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin mx-auto" />
          <p className="text-white/40 text-sm">Verificant el pagament...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-6">
          <div className="w-16 h-16 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl mb-2">Pagament completat</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Hem rebut el teu pagament correctament. En breu rebràs un correu electrònic de confirmació i l&apos;assessor es posarà en contacte amb tu.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Pròxims passos</p>
            <ul className="space-y-2">
              {[
                'Revisa el teu correu — et hem enviat la confirmació',
                "L'assessor prepararà el teu informe personalitzat",
                'Podràs accedir a la plataforma un cop activat el teu compte',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <span className="text-[#c9a84c] font-bold mt-0.5">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#c9a84c] hover:bg-[#b8963f] text-[#0d1f1a] font-semibold text-sm rounded-xl transition-colors">
            Tornar a l&apos;inici
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl mb-2">No s&apos;ha pogut verificar</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              No hem pogut verificar el pagament. Si has completat el pagament i veus aquest missatge, contacta amb nosaltres a{' '}
              <a href="mailto:hola@factorotc.com" className="text-[#c9a84c] hover:underline">hola@factorotc.com</a>.
            </p>
          </div>
          <Link
            href="/"
            className="inline-block px-6 py-3 border border-white/20 hover:border-white/40 text-white/60 hover:text-white font-semibold text-sm rounded-xl transition-colors">
            Tornar a l&apos;inici
          </Link>
        </div>
      )}
    </>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-12">
          <span className="text-white font-black text-lg tracking-wider">FACTOR</span>
          <span className="text-[#c9a84c] font-light text-lg tracking-widest">OTC</span>
        </Link>
        <Suspense fallback={
          <div className="space-y-4">
            <div className="w-12 h-12 border-2 border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin mx-auto" />
            <p className="text-white/40 text-sm">Carregant...</p>
          </div>
        }>
          <CheckoutSuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
