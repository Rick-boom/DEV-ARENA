import { describe, expect, it } from 'vitest';
import {
  authReducer,
  sessionEnded,
  sessionEstablished,
  returnToSet,
} from '../slices/auth-slice.js';
import { themeReducer, themeToggled, themeSet, systemThemeChanged } from '../slices/theme-slice.js';
import { notificationReducer, notify, dismissed } from '../slices/notification-slice.js';
import { userReducer, sidebarToggled } from '../slices/user-slice.js';
import { tokenStore } from '@/services/token-store.js';
import { AuthStatus, UserRole, type User } from '@/types/auth.types.js';
import { ThemeMode, NotificationVariant } from '@/types/ui.types.js';

const user: User = {
  id: 'u1',
  email: 'ada@example.com',
  username: 'ada',
  displayName: 'Ada',
  avatarUrl: null,
  role: UserRole.USER,
  rating: 1200,
  emailVerified: true,
  createdAt: new Date().toISOString(),
};

describe('auth slice', () => {
  it('starts IDLE so guards can wait for session recovery', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state.status).toBe(AuthStatus.IDLE);
    expect(state.user).toBeNull();
  });

  it('stores the user on sessionEstablished but keeps the token out of Redux', () => {
    const state = authReducer(
      undefined,
      sessionEstablished({ user, accessToken: 'header.payload.sig', rememberMe: true }),
    );
    expect(state.status).toBe(AuthStatus.AUTHENTICATED);
    expect(state.user).toEqual(user);
    expect(state.rememberMe).toBe(true);
    // The token lives in the in-memory store, never in serializable state.
    expect(JSON.stringify(state)).not.toContain('header.payload.sig');
    expect(tokenStore.getAccessToken()).toBe('header.payload.sig');
  });

  it('clears the user and the token on sessionEnded', () => {
    const signedIn = authReducer(undefined, sessionEstablished({ user, accessToken: 'a.b.c' }));
    const state = authReducer(signedIn, sessionEnded({ reason: 'expired' }));
    expect(state.status).toBe(AuthStatus.UNAUTHENTICATED);
    expect(state.user).toBeNull();
    expect(state.error).toBe('expired');
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it('remembers where the visitor was headed', () => {
    const state = authReducer(undefined, returnToSet('/settings'));
    expect(state.returnTo).toBe('/settings');
  });
});

describe('theme slice', () => {
  it('cycles light -> dark -> system', () => {
    let state = themeReducer({ mode: ThemeMode.LIGHT, resolved: 'light' }, themeToggled());
    expect(state.mode).toBe(ThemeMode.DARK);
    state = themeReducer(state, themeToggled());
    expect(state.mode).toBe(ThemeMode.SYSTEM);
    state = themeReducer(state, themeToggled());
    expect(state.mode).toBe(ThemeMode.LIGHT);
  });

  it('resolves an explicit mode to itself', () => {
    const state = themeReducer(undefined, themeSet(ThemeMode.LIGHT));
    expect(state.resolved).toBe('light');
  });

  it('follows the OS only while on system mode', () => {
    const onSystem = themeReducer(
      { mode: ThemeMode.SYSTEM, resolved: 'dark' },
      systemThemeChanged('light'),
    );
    expect(onSystem.resolved).toBe('light');

    const onExplicit = themeReducer(
      { mode: ThemeMode.DARK, resolved: 'dark' },
      systemThemeChanged('light'),
    );
    expect(onExplicit.resolved).toBe('dark');
  });
});

describe('notification slice', () => {
  it('adds a toast with a generated id', () => {
    const state = notificationReducer(undefined, notify({ title: 'Saved' }));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.id).toBeTruthy();
    expect(state.items[0]!.variant).toBe(NotificationVariant.INFO);
  });

  it('caps the queue so failures cannot flood the screen', () => {
    let state = notificationReducer(undefined, notify({ title: '1' }));
    for (const title of ['2', '3', '4', '5', '6']) {
      state = notificationReducer(state, notify({ title }));
    }
    expect(state.items).toHaveLength(4);
    expect(state.items[3]!.title).toBe('6');
  });

  it('dismisses by id', () => {
    const added = notificationReducer(undefined, notify({ title: 'Bye' }));
    const state = notificationReducer(added, dismissed(added.items[0]!.id));
    expect(state.items).toHaveLength(0);
  });
});

describe('user slice', () => {
  it('toggles the sidebar', () => {
    const state = userReducer(undefined, sidebarToggled());
    expect(state.sidebarCollapsed).toBe(true);
  });
});
