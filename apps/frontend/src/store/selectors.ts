import { createSelector } from '@reduxjs/toolkit';
import { AuthStatus, UserRole } from '@/types/auth.types.js';
import type { RootState } from './index.js';

/** Derived reads live here so components stay declarative. */
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectAuthStatus = (state: RootState) => state.auth.status;

export const selectIsAuthenticated = createSelector(
  selectAuthStatus,
  (status) => status === AuthStatus.AUTHENTICATED,
);

/** True until session recovery has resolved — guards render a splash. */
export const selectIsBootstrapping = createSelector(
  selectAuthStatus,
  (status) => status === AuthStatus.IDLE || status === AuthStatus.LOADING,
);

export const selectIsAdmin = createSelector(selectUser, (user) => user?.role === UserRole.ADMIN);

export const selectTheme = (state: RootState) => state.theme;
export const selectNotifications = (state: RootState) => state.notification.items;
export const selectSidebarCollapsed = (state: RootState) => state.user.sidebarCollapsed;

// ── workspace ──────────────────────────────────────────────────────
export const selectEditor = (state: RootState) => state.editor;
export const selectEditorPreferences = (state: RootState) => state.editor.preferences;
export const selectLanguage = (state: RootState) => state.editor.language;
export const selectWorkspace = (state: RootState) => state.workspace;
export const selectProblemQuery = (state: RootState) => state.problem.query;
export const selectSubmissionState = (state: RootState) => state.submission;

/** The source currently in the editor for this problem + language. */
export const selectDraft = (problemId: string) =>
  createSelector(
    [selectEditor],
    (editor) => editor.drafts[`${problemId}:${editor.language}`] ?? '',
  );

/** How many filters are active — drives the "clear filters" affordance. */
export const selectActiveFilterCount = createSelector(selectProblemQuery, (query) => {
  return (
    query.difficulties.length +
    query.tags.length +
    query.companies.length +
    (query.status === 'all' ? 0 : 1) +
    (query.search ? 1 : 0)
  );
});
