import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Page transition. A short fade + 4px rise: enough to signal that the
 * view changed, not enough to make navigation feel slow.
 *
 * When the OS asks for reduced motion we render the children plainly —
 * `useReducedMotion` rather than a CSS override, so no animation frames
 * are scheduled at all.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
