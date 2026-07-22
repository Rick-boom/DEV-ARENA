import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import { NOTIFICATION_DEFAULT_DURATION_MS } from '@/constants/app.js';
import { NotificationVariant, type Notification } from '@/types/ui.types.js';

/**
 * Toast queue. Living in Redux (rather than a context) means any layer —
 * a route guard, an axios interceptor, a thunk — can raise a message
 * without needing to be inside a React tree. The list is capped so a
 * failing background poll can't paper the screen with toasts.
 */
const MAX_VISIBLE = 4;

export interface NotificationState {
  items: Notification[];
}

const initialState: NotificationState = { items: [] };

type NotifyInput = {
  variant?: NotificationVariant;
  title: string;
  description?: string;
  duration?: number;
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    notify: {
      reducer(state, action: PayloadAction<Notification>) {
        state.items.push(action.payload);
        if (state.items.length > MAX_VISIBLE) state.items.shift();
      },
      prepare(input: NotifyInput) {
        return {
          payload: {
            id: nanoid(),
            variant: input.variant ?? NotificationVariant.INFO,
            title: input.title,
            description: input.description,
            duration: input.duration ?? NOTIFICATION_DEFAULT_DURATION_MS,
          } satisfies Notification,
        };
      },
    },
    dismissed(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload);
    },
    allDismissed(state) {
      state.items = [];
    },
  },
});

export const { notify, dismissed, allDismissed } = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;

/** Convenience creators so callers don't repeat the variant every time. */
export const notifySuccess = (title: string, description?: string) =>
  notify({ variant: NotificationVariant.SUCCESS, title, description });
export const notifyError = (title: string, description?: string) =>
  notify({ variant: NotificationVariant.ERROR, title, description });
