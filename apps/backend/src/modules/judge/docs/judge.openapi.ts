/** OpenAPI fragment for the Judge Service, merged into the backend spec. */
export const judgeOpenApiPaths = {
  '/submission': {
    post: {
      tags: ['Judge'],
      summary: 'Create a submission and queue it for judging (async)',
      description:
        'Returns 202 with the submission id. Judging happens on the worker; follow the verdict via submission.verdict events or GET /submission/:id.',
      security: [{ bearerAuth: [] }],
      responses: {
        '202': { description: 'Submission accepted and queued' },
        '409': { description: 'DUPLICATE_SUBMISSION' },
        '422': { description: 'PROBLEM_NOT_JUDGEABLE | UNSUPPORTED_LANGUAGE' },
        '429': { description: 'RATE_LIMIT_EXCEEDED' },
      },
    },
  },
  '/submission/history': {
    get: {
      tags: ['Judge'],
      summary: "The caller's recent submissions",
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Submission history page' } },
    },
  },
  '/submission/result': {
    get: {
      tags: ['Judge'],
      summary: 'Per-test-case breakdown for a submission',
      description:
        'Hidden test cases expose only pass/fail + timing — never input, expected output, or stderr.',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Per-case results' },
        '404': { description: 'SUBMISSION_NOT_FOUND' },
      },
    },
  },
  '/submission/{id}': {
    get: {
      tags: ['Judge'],
      summary: 'Submission status + metadata',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Submission' },
        '404': { description: 'SUBMISSION_NOT_FOUND' },
      },
    },
  },
} as const;
