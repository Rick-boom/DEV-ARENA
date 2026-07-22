/**
 * Cross-service enums. Kept as const objects (not TS enums) so they
 * erase cleanly, tree-shake, and stay JSON-serializable.
 */
export const UserRole = {
  GUEST: 'GUEST',
  USER: 'USER',
  PREMIUM: 'PREMIUM',
  MODERATOR: 'MODERATOR',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SupportedLanguage = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  CPP: 'cpp',
  JAVA: 'java',
} as const;
export type SupportedLanguage = (typeof SupportedLanguage)[keyof typeof SupportedLanguage];
