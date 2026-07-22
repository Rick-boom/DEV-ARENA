import { describe, expect, it, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/render.js';
import { LoginForm } from '../components/login-form.js';

/**
 * The form talks to the server through useAuth → RTK Query → axios, so
 * we stub the hook rather than the network: these tests are about the
 * form's behaviour (validation, wiring, error display), and the
 * transport has its own tests.
 */
const login = vi.fn();
vi.mock('@/hooks/use-auth.js', () => ({
  useAuth: () => ({ login, signup: vi.fn(), logout: vi.fn() }),
}));

describe('LoginForm', () => {
  beforeEach(() => login.mockReset());

  it('labels every field so the form is navigable by screen reader', () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('blocks submission and explains what is missing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before hitting the network', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/does not look like an email/i)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('submits valid credentials including the remember-me choice', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue(null);
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1');
    await user.click(screen.getByLabelText(/keep me signed in/i));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'Password1',
        rememberMe: true,
      }),
    );
  });

  it('surfaces a server error as an alert', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'That email and password do not match.',
      isNetworkError: false,
    });
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
  });

  it('maps field-level server errors onto the field that caused them', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Check your details.',
      details: { email: ['No account uses this address'] },
      isNetworkError: false,
    });
    renderWithProviders(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'ghost@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/no account uses this address/i)).toBeInTheDocument();
  });

  it('toggles password visibility with an accurate accessible name', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    const field = screen.getByLabelText(/^password/i);
    expect(field).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
