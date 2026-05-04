'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function AccesRestringitPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg w-full">

        <div className="w-20 h-20 border border-[#c9a84c]/30 rounded-2xl flex items-center justify-center mx-auto mb-8 bg-[#c9a84c]/5">
          <svg className="w-10 h-10 text-[#c9a84c]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <p className="text-[#c9a84c] text-xs uppercase tracking-[0.3em] mb-3">Accés restringit</p>
        <h1 className="text-white font-black text-3xl mb-4">Zona de clients</h1>
        <p className="text-white/50 mb-2 leading-relaxed">
          Aquesta secció és exclusiva per a clients autoritzats de <span className="text-white/70">Factor OTC</span>.
        </p>
        <p className="text-white/40 text-sm mb-10 leading-relaxed">
          Inclou: seguiment d&apos;accions, carteres personalitzades i informes d&apos;inversió.
          Per sol·licitar accés, contacta amb el teu assessor.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] rounded-xl hover:bg-[#c9a84c]/20 transition-colors text-sm font-medium">
            Iniciar sessió
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white/60 rounded-xl hover:bg-white/10 transition-colors text-sm">
            ← Tornar a l&apos;inici
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
