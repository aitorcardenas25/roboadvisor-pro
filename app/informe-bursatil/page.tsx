'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const EXAMPLES = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'META', 'ASML'];

function Nav() {
  return (
    <nav className="border-b border-[#1a3a2a]/70 px-6 py-4 sticky top-0 z-20 bg-[#080e0b]/92 backdrop-blur"
      style={{ boxShadow: '0 1px 0 rgba(26,58,42,0.3)' }}>
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-5 h-5 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded flex items-center justify-center">
            <span className="text-[#c9a84c] font-black text-[10px] leading-none">F</span>
          </div>
          <span className="text-white font-black text-sm tracking-wider">FACTOR</span>
          <span className="text-[#2d6a4f] font-light text-sm tracking-widest">OTC</span>
        </Link>
        <div className="flex items-center gap-5 text-xs uppercase tracking-widest">
          <Link href="/comparador" className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Comparador</Link>
          <Link href="/accions"    className="text-[#2d6a4f]/70 hover:text-[#c9a84c] transition-colors">Accions</Link>
          <Link href="/informe-bursatil" className="text-[#c9a84c] font-semibold">Informe</Link>
        </div>
      </div>
    </nav>
  );
}

export default function InformeBursatilPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [ticker,   setTicker]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [htmlBlob, setHtmlBlob] = useState<string | null>(null);  // blob URL
  const [lastTicker, setLastTicker] = useState('');

  const generate = useCallback(async (sym?: string) => {
    const t = (sym ?? ticker).trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    setHtmlBlob(null);

    try {
      const res = await fetch(`/api/stock-analysis?ticker=${encodeURIComponent(t)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const html = await res.text();
      // Create blob URL for opening in new tab
      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      setHtmlBlob(url);
      setLastTicker(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  const handleQuick = (sym: string) => {
    setTicker(sym);
    generate(sym);
  };

  const download = () => {
    if (!htmlBlob) return;
    const a = document.createElement('a');
    a.href     = htmlBlob;
    a.download = `factor-otc-informe-${lastTicker}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
  };

  // Auth states
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#080e0b] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#080e0b] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 bg-[#1a3a2a] border border-[#2d6a4f]/40 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-7 h-7 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-3">Accés restringit</p>
        <h1 className="text-white font-black text-2xl mb-4">Inicia sessió per accedir</h1>
        <p className="text-white/40 text-sm mb-8 max-w-sm">
          Aquesta funcionalitat és exclusiva per a clients autoritzats de Factor OTC.
        </p>
        <button
          onClick={() => router.push('/acces-restringit')}
          className="px-6 py-2.5 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] text-sm font-semibold rounded-sm hover:bg-[#1f4432] transition-colors">
          Iniciar sessió
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080e0b]">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-[#2d6a4f] text-xs uppercase tracking-[0.3em] mb-2">Factor OTC — Zona clients</p>
          <h1 className="text-white font-black text-4xl mb-2 tracking-tight">Informe Bursàtil</h1>
          <p className="text-white/40 text-sm">Introdueix un ticker dels EUA i genera un informe HTML professional descarregable.</p>
        </div>

        {/* Input panel */}
        <div className="bg-white/[0.025] border border-[#1a3a2a]/60 rounded-2xl p-6 mb-6"
          style={{ boxShadow: 'inset 0 1px 0 rgba(45,106,79,0.1)' }}>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="AAPL, MSFT, NVDA, SAN.MC..."
              maxLength={15}
              className="flex-1 bg-[#0d1a14] border border-[#1a3a2a] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm font-mono tracking-widest focus:outline-none focus:border-[#2d6a4f]/70 transition-colors"
              style={{ letterSpacing: '0.15em' }}
            />
            <button
              onClick={() => generate()}
              disabled={loading || !ticker.trim()}
              className="px-6 py-3 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] font-semibold text-sm tracking-wide rounded-xl hover:bg-[#1f4432] disabled:opacity-40 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#c9a84c]/20 border-t-[#c9a84c] rounded-full animate-spin" />
                  Generant...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generar informe
                </>
              )}
            </button>
          </div>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2">
            <span className="text-white/20 text-xs self-center mr-1">Suggerits:</span>
            {EXAMPLES.map(s => (
              <button key={s} onClick={() => handleQuick(s)}
                className="px-3 py-1 text-xs bg-white/3 text-white/40 hover:text-[#c9a84c] rounded-lg border border-[#1a3a2a] hover:border-[#2d6a4f]/40 transition-all font-mono">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-5 py-4 mb-6">
            <div className="flex gap-3 items-start">
              <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-400 text-sm font-medium">Error en generar l'informe</p>
                <p className="text-red-400/70 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-white/[0.02] border border-[#1a3a2a]/40 rounded-2xl p-10 text-center">
            <div className="w-10 h-10 border-2 border-[#1a3a2a] border-t-[#c9a84c] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/50 text-sm">Obtenint dades de Yahoo Finance...</p>
            <p className="text-white/25 text-xs mt-1">Normalment tarda 3–8 segons</p>
          </div>
        )}

        {/* Result */}
        {htmlBlob && !loading && (
          <div className="bg-white/[0.025] border border-[#2d6a4f]/30 rounded-2xl p-6"
            style={{ boxShadow: '0 0 32px rgba(45,106,79,0.08)' }}>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a3a2a] border border-[#2d6a4f]/50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#c9a84c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-bold text-base">Informe generat</p>
                  <p className="text-white/40 text-xs font-mono">{lastTicker} · Factor OTC</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={htmlBlob}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#c9a84c] text-[#080e0b] font-bold text-sm rounded-xl hover:bg-[#e8d5a3] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Obrir informe
                </a>
                <button
                  onClick={download}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3a2a] border border-[#2d6a4f]/50 text-[#c9a84c] font-semibold text-sm rounded-xl hover:bg-[#1f4432] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descarregar HTML
                </button>
              </div>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/5">
              {[
                ['Descripció empresa', 'Sector, activitat, país'],
                ['Posició competitiva', 'Anàlisi sectorial'],
                ['Dades fonamentals', 'PE, EPS, Revenue, ROE'],
                ['Gràfic TradingView', 'Chart interactiu'],
              ].map(([title, sub]) => (
                <div key={title} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2d6a4f] flex-shrink-0" />
                  <div>
                    <p className="text-white/60 text-xs font-medium">{title}</p>
                    <p className="text-white/25 text-[10px]">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {!htmlBlob && !loading && !error && (
          <div className="border border-[#1a3a2a]/40 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-[#1a3a2a]/50 border border-[#2d6a4f]/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-white/50 font-medium mb-1">Introdueix un ticker per generar l'informe</p>
            <p className="text-white/25 text-sm">L'informe inclou: descripció, posició competitiva, dades fonamentals, anàlisi tècnica i gràfic interactiu.</p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-white/15 text-xs text-center mt-8 leading-relaxed">
          Eina de suport a la decisió · Fonts: Yahoo Finance, TradingView · No constitueix assessorament financer regulat
        </p>
      </main>
    </div>
  );
}
