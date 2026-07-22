/**
 * Minimal JWT payload reader. Used ONLY to learn when the access token
 * expires so we can refresh proactively — never for authorization
 * decisions, which stay on the server.
 */
interface JwtPayload {
  exp?: number;
  sub?: string;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Expiry as epoch ms, or a short default when the token is opaque. */
export function expiryOf(token: string, fallbackMs = 15 * 60_000): number {
  const payload = decodeJwt(token);
  return payload?.exp ? payload.exp * 1000 : Date.now() + fallbackMs;
}
