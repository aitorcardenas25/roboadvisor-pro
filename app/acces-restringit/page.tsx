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
        className="text-center max-w-md">

        <div className="w-16 h-16 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V9m0 0V7m0 2h2m-2 0H10M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Accés restringit</h1>
        <p className="text-white/50 mb-8 leading-relaxed">
          Aquesta secció és exclusiva per a clients autoritzats de Factor OTC.
          Per sol·licitar accés, contacta amb el teu assessor.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-[#c9a84c] rounded-lg hover:bg-[#c9a84c]/20 transition-colors text-sm font-medium">
          ← Tornar a l&apos;inici
        </Link>
      </motion.div>
    </div>
  );
}
