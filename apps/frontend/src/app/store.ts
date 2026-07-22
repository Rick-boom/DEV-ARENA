import { configureStore } from '@reduxjs/toolkit';

/**
 * Redux Toolkit store shell. Feature slices (auth, editor, battle, ...)
 * register here in later milestones. An empty valid reducer map is
 * intentional: the wiring is the deliverable, not the state.
 */
export const store = configureStore({
  reducer: {
    // feature slices are added here as they are built
    _placeholder: (state: { ready: boolean } = { ready: true }) => state,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
