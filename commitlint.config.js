/**
 * Enforces Conventional Commits so history is machine-readable
 * (changelogs, semantic release, revert tooling all depend on it).
 * Examples: feat(backend): add health route | fix(frontend): editor crash
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'root',
        'frontend',
        'backend',
        'execution-engine',
        'ai-service',
        'shared-types',
        'shared-utils',
        'eslint-config',
        'ts-config',
        'docker',
        'ci',
        'docs',
      ],
    ],
  },
};
