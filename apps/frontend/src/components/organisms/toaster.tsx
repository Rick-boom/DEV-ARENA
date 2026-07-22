import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks.js';
import { selectNotifications } from '@/store/selectors.js';
import { dismissed } from '@/store/slices/notification-slice.js';
import { NotificationVariant, type Notification } from '@/types/ui.types.js';
import { cn } from '@/utils/cn.js';

const ICONS = {
  [NotificationVariant.SUCCESS]: CheckCircle2,
  [NotificationVariant.ERROR]: XCircle,
  [NotificationVariant.WARNING]: TriangleAlert,
  [NotificationVariant.INFO]: Info,
} as const;

const TONES = {
  [NotificationVariant.SUCCESS]: 'text-[var(--color-success)]',
  [NotificationVariant.ERROR]: 'text-[var(--color-danger)]',
  [NotificationVariant.WARNING]: 'text-[var(--color-warning)]',
  [NotificationVariant.INFO]: 'text-[var(--color-info)]',
} as const;

/**
 * Toaster (organism). Renders the notification slice.
 *
 * The live region is polite and the container is aria-atomic=false so
 * each toast is announced as it arrives without re-reading the others.
 * Auto-dismiss lives in the item so each toast owns its own timer and a
 * new arrival never resets an existing one.
 */
export function Toaster() {
  const items = useAppSelector(selectNotifications);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 sm:p-6"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastItem key={item.id} notification={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ notification }: { notification: Notification }) {
  const dispatch = useAppDispatch();
  const Icon = ICONS[notification.variant];

  useEffect(() => {
    if (notification.duration <= 0) return;
    const timer = setTimeout(() => dispatch(dismissed(notification.id)), notification.duration);
    return () => clearTimeout(timer);
  }, [dispatch, notification.id, notification.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto flex gap-3 rounded-xl border p-3.5',
        'border-[var(--color-border)] bg-[var(--color-elevated)] shadow-[var(--shadow-pop)]',
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', TONES[notification.variant])}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-fg)]">{notification.title}</p>
        {notification.description ? (
          <p className="mt-0.5 text-[13px] text-[var(--color-fg-muted)]">
            {notification.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dispatch(dismissed(notification.id))}
        aria-label={`Dismiss: ${notification.title}`}
        className="h-fit rounded p-0.5 text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
