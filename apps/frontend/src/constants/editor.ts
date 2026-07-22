import { Language } from '@/types/problem.types.js';

/**
 * Editor configuration. Language metadata is a single table so adding a
 * language means one row here — Monaco's mode id, the display label, the
 * file extension used for downloads, and the fallback starter snippet
 * when the server doesn't supply one.
 */
export interface LanguageMeta {
  id: Language;
  label: string;
  monacoId: string;
  extension: string;
  starter: string;
}

export const LANGUAGES: LanguageMeta[] = [
  {
    id: Language.JAVASCRIPT,
    label: 'JavaScript',
    monacoId: 'javascript',
    extension: 'js',
    starter:
      '/**\n * @param {number[]} nums\n * @return {number}\n */\nfunction solve(nums) {\n  // your code here\n}\n',
  },
  {
    id: Language.TYPESCRIPT,
    label: 'TypeScript',
    monacoId: 'typescript',
    extension: 'ts',
    starter: 'function solve(nums: number[]): number {\n  // your code here\n  return 0;\n}\n',
  },
  {
    id: Language.PYTHON,
    label: 'Python',
    monacoId: 'python',
    extension: 'py',
    starter: 'def solve(nums):\n    # your code here\n    pass\n',
  },
  {
    id: Language.JAVA,
    label: 'Java',
    monacoId: 'java',
    extension: 'java',
    starter:
      'class Solution {\n    public int solve(int[] nums) {\n        // your code here\n        return 0;\n    }\n}\n',
  },
  {
    id: Language.CPP,
    label: 'C++',
    monacoId: 'cpp',
    extension: 'cpp',
    starter:
      '#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    int solve(vector<int>& nums) {\n        // your code here\n        return 0;\n    }\n};\n',
  },
];

export const LANGUAGE_BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export const EDITOR_DEFAULTS = {
  fontSize: 14,
  minFontSize: 11,
  maxFontSize: 22,
  tabSize: 2,
  minimap: false,
  wordWrap: true,
  language: Language.JAVASCRIPT,
} as const;

/**
 * Draft autosave. Keyed per (problem, language) so switching languages
 * never clobbers work in another one, and debounced so we aren't writing
 * to storage on every keystroke.
 */
export const AUTOSAVE = {
  DEBOUNCE_MS: 800,
  key: (problemId: string, language: Language) => `devarena:draft:${problemId}:${language}`,
} as const;

/** Verdict polling: submissions are judged asynchronously. */
export const SUBMISSION_POLL = {
  INTERVAL_MS: 1200,
  TIMEOUT_MS: 90_000,
} as const;

/** Monaco theme ids registered at load time. */
export const MONACO_THEME = { DARK: 'devarena-dark', LIGHT: 'devarena-light' } as const;
