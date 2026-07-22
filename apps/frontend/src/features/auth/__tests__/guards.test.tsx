import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router';
import { renderWithProviders, makeTestStore, screen } from '@/test/render.js';
import { ProtectedRoute } from '../guards/protected-route.js';
import { PublicOnlyRoute } from '../guards/public-route.js';
import { AuthStatus, UserRole, type User } from '@/types/auth.types.js';

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

function Protected() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Route>
      <Route path="/login" element={<h1>Sign in</h1>} />
    </Routes>
  );
}

describe('ProtectedRoute', () => {
  it('holds a splash while the session is still being recovered', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.IDLE, user: null } });
    renderWithProviders(<Protected />, { store, route: '/dashboard' });
    // Neither the page nor the login screen — we do not know yet.
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the page for an authenticated user', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.AUTHENTICATED, user } });
    renderWithProviders(<Protected />, { store, route: '/dashboard' });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.UNAUTHENTICATED, user: null } });
    renderWithProviders(<Protected />, { store, route: '/dashboard' });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('remembers the attempted path so login can return there', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.UNAUTHENTICATED, user: null } });
    renderWithProviders(<Protected />, { store, route: '/dashboard' });
    expect(store.getState().auth.returnTo).toBe('/dashboard');
  });

  it('sends a user without the required role to 403', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.AUTHENTICATED, user } });
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute roles={[UserRole.ADMIN]} />}>
          <Route path="/admin" element={<h1>Admin</h1>} />
        </Route>
        <Route path="/403" element={<h1>Forbidden</h1>} />
      </Routes>,
      { store, route: '/admin' },
    );
    expect(screen.getByRole('heading', { name: 'Forbidden' })).toBeInTheDocument();
  });
});

describe('PublicOnlyRoute', () => {
  function PublicOnly() {
    return (
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Route>
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>
    );
  }

  it('shows the login form to a signed-out visitor', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.UNAUTHENTICATED, user: null } });
    renderWithProviders(<PublicOnly />, { store, route: '/login' });
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('bounces an already-authenticated user into the app', () => {
    const store = makeTestStore({ auth: { status: AuthStatus.AUTHENTICATED, user } });
    renderWithProviders(<PublicOnly />, { store, route: '/login' });
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
