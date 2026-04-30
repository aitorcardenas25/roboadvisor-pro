// components/animations.tsx
// Components d'animació reutilitzables amb Framer Motion

'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ReactNode } from 'react';

// ─── VARIANTS ─────────────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.3, ease: 'easeIn' } },
};

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

export const slideRight: Variants = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: -40, transition: { duration: 0.3, ease: 'easeIn' } },
};

export const slideLeft: Variants = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.3, ease: 'easeIn' } },
};

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

export const staggerContainer: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

// Wrapper genèric amb fadeUp
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?:   number;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ delay }}
      className={className}>
      {children}
    </motion.div>
  );
}

// Wrapper per a llistes amb stagger
export function StaggerList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}>
      {children}
    </motion.div>
  );
}

// Item de llista amb stagger
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// Transició entre passos del qüestionari
export function StepTransition({
  children,
  stepKey,
  direction = 'right',
}: {
  children:  ReactNode;
  stepKey:   number | string;
  direction?: 'right' | 'left';
}) {
  const variant = direction === 'right' ? slideRight : slideLeft;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        variants={variant}
        initial="hidden"
        animate="visible"
        exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Card amb hover effect
export function AnimatedCard({
  children,
  className,
  delay = 0,
}: {
  children:  ReactNode;
  className?: string;
  delay?:    number;
}) {
  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      transition={{ delay }}
      className={className}>
      {children}
    </motion.div>
  );
}

// KPI Card amb comptador animat
export function AnimatedKpi({
  children,
  className,
  index = 0,
}: {
  children:  ReactNode;
  className?: string;
  index?:    number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay:    index * 0.08,
        duration: 0.5,
        ease:     [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.02 }}
      className={className}>
      {children}
    </motion.div>
  );
}

// Tab amb indicador animat
export function AnimatedTab({
  children,
  isActive,
  onClick,
  className,
}: {
  children:  ReactNode;
  isActive:  boolean;
  onClick:   () => void;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={className}>
      {children}
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-[#c9a84c] rounded-lg -z-10"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

// Barra de progrés animada
export function AnimatedProgressBar({
  percentage,
  color,
  delay = 0,
}: {
  percentage: number;
  color:      string;
  delay?:     number;
}) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-2 rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

// Loading spinner professional
export function LoadingSpinner({ message = 'Calculant...' }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 gap-6">

      {/* Spinner */}
      <div className="relative w-16 h-16">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#c9a84c]/20"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#c9a84c]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#0d1f1a]"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Text animat */}
      <div className="text-center">
        <motion.p
          className="text-sm font-semibold text-gray-700"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}>
          {message}
        </motion.p>
        <motion.p
          className="text-xs text-gray-400 mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}>
          Generant el teu informe personalitzat...
        </motion.p>
      </div>

      {/* Dots */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Número animat (counter)
export function AnimatedNumber({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  className,
}: {
  value:     number;
  suffix?:   string;
  prefix?:   string;
  decimals?: number;
  className?: string;
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
      {prefix}{value.toFixed(decimals)}{suffix}
    </motion.span>
  );
}

// Wrapper per a seccions de resultats
export function ResultSection({
  children,
  delay = 0,
  className,
}: {
  children:  ReactNode;
  delay?:    number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}>
      {children}
    </motion.div>
  );
}

// Badge animat
export function AnimatedBadge({
  children,
  className,
}: {
  children:  ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={className}>
      {children}
    </motion.span>
  );
}

// Pulse effect per a elements importants
export function PulseHighlight({
  children,
  color = '#c9a84c',
  className,
}: {
  children:  ReactNode;
  color?:    string;
  className?: string;
}) {
  return (
    <motion.div
      className={`relative ${className ?? ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}>
      <motion.div
        className="absolute inset-0 rounded-xl opacity-20"
        style={{ backgroundColor: color }}
        animate={{ scale: [1, 1.02, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {children}
    </motion.div>
  );
}