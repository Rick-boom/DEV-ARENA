import { API_BASE_URL, AUTH_ENDPOINTS } from '@/constants/api.js';
import type { OAuthProvider } from '@/types/auth.types.js';

/**
 * Starts an OAuth flow as a full-page navigation.
 *
 * Deliberately not a fetch: a provider's consent screen cannot render in
 * an XHR, and a real redirect keeps the browser in charge — the back
 * button, password managers, and any existing provider session all keep
 * working.
 */
export function startOAuth(provider: OAuthProvider): void {
  const returnTo = `${window.location.origin}/auth/callback`;
  window.location.href = `${API_BASE_URL}${AUTH_ENDPOINTS.OAUTH_START(provider)}?redirect_uri=${encodeURIComponent(returnTo)}`;
}
