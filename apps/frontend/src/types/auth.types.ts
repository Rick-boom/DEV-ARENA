/** Authentication + session domain types shared across the app. */

export const UserRole = {
  USER: 'USER',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  rating: number;
  emailVerified: boolean;
  createdAt: string;
}

/** Access token is kept in memory; the refresh token lives in an httpOnly cookie. */
export interface AuthTokens {
  accessToken: string;
  /** epoch ms when the access token stops being valid */
  expiresAt: number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

export const AuthStatus = {
  /** app has not yet tried to recover a session */
  IDLE: 'idle',
  /** session recovery / login in flight */
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
} as const;
export type AuthStatus = (typeof AuthStatus)[keyof typeof AuthStatus];

// ── request payloads ───────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export const OAuthProvider = {
  GOOGLE: 'google',
  GITHUB: 'github',
} as const;
export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];
