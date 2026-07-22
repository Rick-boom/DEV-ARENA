import type { ReactElement, ReactNode } from 'react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { baseApi } from '@/store/api/base-api.js';
import { authReducer } from '@/store/slices/auth-slice.js';
import { userReducer } from '@/store/slices/user-slice.js';
import { themeReducer } from '@/store/slices/theme-slice.js';
import { notificationReducer } from '@/store/slices/notification-slice.js';
import { editorReducer } from '@/store/slices/editor-slice.js';
import { workspaceReducer } from '@/store/slices/workspace-slice.js';
import { problemReducer } from '@/store/slices/problem-slice.js';
import { submissionReducer } from '@/store/slices/submission-slice.js';

/**
 * Test renderer that mounts components inside a REAL store and router.
 *
 * The reducer map is combined up front so `preloadedState` type-checks
 * against the resulting state shape — `configureStore` resolves to a
 * different overload when a reducer map and preloaded state are passed
 * together, which silently loses inference.
 *
 * A fresh store per test keeps cases isolated (no state leaking between
 * them), and `preloadedState` lets a test start from "signed in" without
 * driving the whole login flow first.
 */
const rootReducer = combineReducers({
  auth: authReducer,
  user: userReducer,
  theme: themeReducer,
  notification: notificationReducer,
  editor: editorReducer,
  workspace: workspaceReducer,
  problem: problemReducer,
  submission: submissionReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

export type TestState = ReturnType<typeof rootReducer>;
export type PreloadedTestState = Partial<{
  auth: Partial<TestState['auth']>;
  user: Partial<TestState['user']>;
  theme: Partial<TestState['theme']>;
  editor: Partial<TestState['editor']>;
  workspace: Partial<TestState['workspace']>;
  problem: Partial<TestState['problem']>;
  submission: Partial<TestState['submission']>;
}>;

export function makeTestStore(preloaded?: PreloadedTestState) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
    preloadedState: preloaded as Partial<TestState>,
  });
}

export type TestStore = ReturnType<typeof makeTestStore>;

interface Options extends Omit<RenderOptions, 'wrapper'> {
  store?: TestStore;
  route?: string;
}

// Explicit return type: the inferred one reaches into pretty-format's
// internals, which isn't portable across the workspace's module layout.
export function renderWithProviders(
  ui: ReactElement,
  { store = makeTestStore(), route = '/', ...options }: Options = {},
): RenderResult & { store: TestStore } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export * from '@testing-library/react';
