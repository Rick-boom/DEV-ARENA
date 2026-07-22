import { motion } from 'framer-motion';
import { Logo } from '@/components/molecules/logo.js';

/**
 * Boot / route-transition splash. Shown while session recovery decides
 * whether the visitor is signed in. The brand mark pulses rather than a
 * generic spinner so the wait reads as "the app is starting", not "the
 * page is broken".
 */
export function FullScreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-screen place-items-center bg-[var(--color-canvas)]"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo showWordmark={false} />
        </motion.div>
        <p className="font-mono text-[11px] tracking-wide text-[var(--color-fg-subtle)] uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}
