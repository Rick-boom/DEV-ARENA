/** OpenAPI fragment for the AI Coach, merged into the backend spec. */
export const aiCoachOpenApiPaths = {
  '/ai/hint': {
    post: {
      tags: ['AI Coach'],
      summary: 'Escalating hint (never the full solution)',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Hint' },
        '429': { description: 'RATE_LIMIT_EXCEEDED' },
        '400': { description: 'PROMPT_INJECTION_DETECTED | CONTENT_BLOCKED' },
        '503': { description: 'AI_UNAVAILABLE' },
      },
    },
  },
  '/ai/review': {
    post: {
      tags: ['AI Coach'],
      summary: 'Code-quality review: smells, bugs, edge cases, naming',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Review' },
        '413': { description: 'PROMPT_TOO_LARGE' },
        '422': { description: 'INVALID_LANGUAGE' },
      },
    },
  },
  '/ai/complexity': {
    post: {
      tags: ['AI Coach'],
      summary: 'Time/space complexity analysis of the user code',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Complexity' } },
    },
  },
  '/ai/interview': {
    post: {
      tags: ['AI Coach'],
      summary: 'Interviewer follow-up questions on the topic',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Interview questions' } },
    },
  },
  '/ai/learning': {
    post: {
      tags: ['AI Coach'],
      summary: 'Study recommendations from weak topics',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Learning plan' } },
    },
  },
  '/ai/recommend': {
    post: {
      tags: ['AI Coach'],
      summary: 'Next problems to attempt (grounded in real ids)',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Recommendations' } },
    },
  },
  '/ai/history': {
    get: {
      tags: ['AI Coach'],
      summary: 'Recent AI interactions for the user',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'History' } },
    },
  },
} as const;
