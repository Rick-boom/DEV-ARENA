import type { Language } from '../types/execution.types.js';

/**
 * Per-language execution profile. Everything the runner needs to turn
 * source text into a verdict lives in one declarative table — adding a
 * language is a data change, not a code change (Open/Closed).
 *
 * `image`   Docker image the container is built from.
 * `source`  filename written into the sandbox working dir.
 * `compile` argv run once before execution (null = interpreted).
 * `run`     argv executed with the user's stdin piped in.
 * All commands run as a non-root user inside the container.
 */
export interface LanguageProfile {
  id: Language;
  displayName: string;
  image: string;
  source: string;
  compile: string[] | null;
  run: string[];
}

export const LANGUAGE_PROFILES: Record<Language, LanguageProfile> = {
  cpp: {
    id: 'cpp',
    displayName: 'C++17',
    image: 'devarena/exec-cpp:latest',
    source: 'main.cpp',
    // -O2 optimized, static where possible; output binary is ./a.out
    compile: ['g++', '-O2', '-std=c++17', '-o', 'a.out', 'main.cpp'],
    run: ['./a.out'],
  },
  java: {
    id: 'java',
    displayName: 'Java 21',
    image: 'devarena/exec-java:latest',
    source: 'Main.java',
    compile: ['javac', 'Main.java'],
    // Cap the JVM heap so it fails as MLE inside our limit, not the host's
    run: ['java', '-XX:+UseSerialGC', 'Main'],
  },
  python: {
    id: 'python',
    displayName: 'Python 3.12',
    image: 'devarena/exec-python:latest',
    source: 'main.py',
    compile: null,
    run: ['python3', '-I', 'main.py'],
  },
  javascript: {
    id: 'javascript',
    displayName: 'Node.js 22',
    image: 'devarena/exec-node:latest',
    source: 'main.js',
    compile: null,
    run: ['node', '--max-old-space-size=240', 'main.js'],
  },
};

export function getLanguageProfile(language: Language): LanguageProfile {
  return LANGUAGE_PROFILES[language];
}
