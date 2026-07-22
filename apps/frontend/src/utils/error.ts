import { AxiosError } from 'axios';
import type { ApiErrorBody, NormalizedError } from '@/types/api.types.js';

/**
 * Turns anything thrown by the network layer into ONE predictable shape.
 * Without this every component invents its own error handling; with it,
 * the UI reads `.message` and `.details` and is done.
 */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof AxiosError) {
    // No response → the request never reached the server.
    if (!error.response) {
      return {
        status: 0,
        code: 'NETWORK_ERROR',
        message: navigator.onLine
          ? "Couldn't reach the server. Try again in a moment."
          : "You're offline. Reconnect to continue.",
        isNetworkError: true,
      };
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined;
    return {
      status: error.response.status,
      code: body?.error?.code ?? 'UNKNOWN_ERROR',
      message: body?.error?.message ?? fallbackMessage(error.response.status),
      details: body?.error?.details,
      isNetworkError: false,
    };
  }
  if (error instanceof Error) {
    return { status: 0, code: 'CLIENT_ERROR', message: error.message, isNetworkError: false };
  }
  return {
    status: 0,
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong.',
    isNetworkError: false,
  };
}

/** Errors state what happened and what to do — never a bare status code. */
function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session expired. Sign in to continue.';
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return "That doesn't exist, or it moved.";
  if (status === 409) return 'That conflicts with something that already exists.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The server ran into a problem. Try again shortly.';
  return 'Something went wrong.';
}

/**
 * Maps server field errors onto react-hook-form. Returns the entries the
 * caller should pass to setError, so validation surfaces on the field
 * that caused it rather than as a generic banner.
 */
export function toFieldErrors(error: NormalizedError): [string, string][] {
  if (!error.details) return [];
  return Object.entries(error.details).map(([field, messages]) => [
    field,
    messages[0] ?? 'Invalid value',
  ]);
}
