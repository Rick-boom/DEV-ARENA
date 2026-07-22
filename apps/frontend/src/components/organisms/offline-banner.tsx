import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnline } from '@/hooks/use-online.js';

/**
 * Offline notice. Pinned to the top and announced politely — it explains
 * the state and what the app will do about it ("we'll reconnect"), so a
 * user who suddenly sees failing actions knows why.
 */
export function OfflineBanner() {
  const online = useOnline();

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-[var(--color-warning)] px-4 py-2 text-[13px] font-medium text-black"
        >
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          You&apos;re offline. We&apos;ll reconnect automatically.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
