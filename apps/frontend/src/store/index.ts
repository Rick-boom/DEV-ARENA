import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/base-api.js';
import { authReducer } from './slices/auth-slice.js';
import { userReducer } from './slices/user-slice.js';
import { themeReducer } from './slices/theme-slice.js';
import { notificationReducer } from './slices/notification-slice.js';
import { editorReducer } from './slices/editor-slice.js';
import { workspaceReducer } from './slices/workspace-slice.js';
import { problemReducer } from './slices/problem-slice.js';
import { submissionReducer } from './slices/submission-slice.js';

/**
 * Store composition root. RTK Query's reducer + middleware are wired
 * here once; feature APIs inject endpoints into `baseApi` rather than
 * registering new middleware.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    theme: themeReducer,
    notification: notificationReducer,
    editor: editorReducer,
    workspace: workspaceReducer,
    problem: problemReducer,
    submission: submissionReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});

// Enables refetchOnFocus / refetchOnReconnect behaviour.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
