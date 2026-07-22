import { useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks.js';
import { notify } from '@/store/slices/notification-slice.js';
import { NotificationVariant } from '@/types/ui.types.js';

/**
 * Toast helper with the variants pre-bound, so call sites read as
 * `toast.success('Signed in')` rather than assembling an action.
 */
export function useNotify() {
  const dispatch = useAppDispatch();

  const make = useCallback(
    (variant: NotificationVariant) => (title: string, description?: string) =>
      dispatch(notify({ variant, title, description })),
    [dispatch],
  );

  return {
    success: make(NotificationVariant.SUCCESS),
    error: make(NotificationVariant.ERROR),
    info: make(NotificationVariant.INFO),
    warning: make(NotificationVariant.WARNING),
  };
}
