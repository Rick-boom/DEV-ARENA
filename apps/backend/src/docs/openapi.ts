/**
 * OpenAPI 3.0 specification for the Problem Management Service,
 * served at /api/v1/docs (Swagger UI) and /api/v1/docs.json.
 * Hand-maintained next to the routes it documents; the CI reviewer
 * checks both in the same diff.
 */
const problemSummary = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    slug: { type: 'string', example: 'two-sum' },
    title: { type: 'string', example: 'Two Sum' },
    difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
    tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
    companies: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
    solvedCount: { type: 'integer' },
    submissionCount: { type: 'integer' },
    acceptanceRate: { type: 'number', example: 47.3 },
    isSolved: { type: 'boolean' },
    isBookmarked: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const errorResponse = (code: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: code },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
});

const ok = (schema: unknown, description = 'Success') => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: { success: { type: 'boolean', example: true }, data: schema },
      },
    },
  },
});

const paginated = (itemRef: string) => ({
  type: 'object',
  properties: {
    items: { type: 'array', items: { $ref: itemRef } },
    page: { type: 'integer' },
    pageSize: { type: 'integer' },
    total: { type: 'integer' },
  },
});

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Problem UUID or slug',
} as const;

const listQueryParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
  {
    name: 'sortBy',
    in: 'query',
    schema: { type: 'string', enum: ['newest', 'oldest', 'acceptance', 'difficulty'] },
  },
  { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] } },
  { name: 'tags', in: 'query', schema: { type: 'string' }, description: 'CSV of tag slugs' },
  {
    name: 'companies',
    in: 'query',
    schema: { type: 'string' },
    description: 'CSV of company slugs',
  },
  { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Keyword' },
  { name: 'solved', in: 'query', schema: { type: 'boolean' }, description: 'Auth required' },
  { name: 'bookmarked', in: 'query', schema: { type: 'boolean' }, description: 'Auth required' },
] as const;

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DevArena — Problem Management API',
    version: '1.0.0',
    description:
      'CRUD, search, filtering, bookmarks, trending, versions and admin management for coding problems.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Tag: {
        type: 'object',
        properties: { name: { type: 'string' }, slug: { type: 'string' } },
      },
      ProblemSummary: problemSummary,
      ProblemDetail: {
        allOf: [
          { $ref: '#/components/schemas/ProblemSummary' },
          {
            type: 'object',
            properties: {
              statement: { type: 'string' },
              timeLimitMs: { type: 'integer' },
              memoryLimitMb: { type: 'integer' },
              examples: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    input: { type: 'string' },
                    output: { type: 'string' },
                    explanation: { type: 'string', nullable: true },
                  },
                },
              },
              constraints: { type: 'array', items: { type: 'string' } },
              hints: { type: 'array', items: { type: 'string' } },
              editorial: {
                type: 'object',
                nullable: true,
                properties: {
                  content: { type: 'string' },
                  timeComplexity: { type: 'string', nullable: true },
                  spaceComplexity: { type: 'string', nullable: true },
                },
              },
              sampleTestCases: {
                type: 'array',
                description: 'Visible test cases only — hidden cases are never exposed here.',
                items: {
                  type: 'object',
                  properties: { input: { type: 'string' }, expectedOutput: { type: 'string' } },
                },
              },
            },
          },
        ],
      },
      CreateProblemRequest: {
        type: 'object',
        required: ['title', 'statement', 'difficulty', 'examples'],
        properties: {
          title: { type: 'string' },
          slug: { type: 'string', description: 'kebab-case; generated from title when omitted' },
          statement: { type: 'string' },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
          visibility: { type: 'string', enum: ['DRAFT', 'PUBLIC', 'PREMIUM', 'ARCHIVED'] },
          timeLimitMs: { type: 'integer', default: 2000 },
          memoryLimitMb: { type: 'integer', default: 256 },
          tags: { type: 'array', items: { type: 'string' } },
          companies: { type: 'array', items: { type: 'string' } },
          examples: {
            type: 'array',
            items: {
              type: 'object',
              required: ['input', 'output'],
              properties: {
                input: { type: 'string' },
                output: { type: 'string' },
                explanation: { type: 'string' },
              },
            },
          },
          constraints: { type: 'array', items: { type: 'string' } },
          hints: { type: 'array', items: { type: 'string' } },
        },
      },
      UpdateProblemRequest: {
        allOf: [
          { $ref: '#/components/schemas/CreateProblemRequest' },
          {
            type: 'object',
            required: ['expectedVersion'],
            properties: {
              expectedVersion: {
                type: 'integer',
                description: 'Optimistic lock — the version the client last read.',
              },
            },
          },
        ],
      },
      UploadTestCasesRequest: {
        type: 'object',
        required: ['testCases'],
        properties: {
          mode: { type: 'string', enum: ['replace'], default: 'replace' },
          testCases: {
            type: 'array',
            items: {
              type: 'object',
              required: ['input', 'expectedOutput'],
              properties: {
                input: { type: 'string' },
                expectedOutput: { type: 'string' },
                isHidden: { type: 'boolean', default: true },
                weight: { type: 'integer', default: 1 },
              },
            },
          },
        },
      },
    },
  },
  paths: {
    '/problems': {
      get: {
        tags: ['Problems'],
        summary: 'List problems with pagination, filters and sorting',
        parameters: [...listQueryParams],
        responses: {
          '200': ok(paginated('#/components/schemas/ProblemSummary')),
          '422': errorResponse('VALIDATION_ERROR', 'Invalid query parameters'),
        },
      },
    },
    '/problems/search': {
      get: {
        tags: ['Problems'],
        summary: 'Keyword search across title, statement, tags and companies',
        parameters: [...listQueryParams],
        responses: {
          '200': ok(paginated('#/components/schemas/ProblemSummary')),
          '422': errorResponse('VALIDATION_ERROR', 'Missing/invalid keyword'),
        },
      },
    },
    '/problems/trending': {
      get: {
        tags: ['Problems'],
        summary: 'Most-submitted problems in the last 7 days (Redis-cached)',
        responses: {
          '200': ok({ type: 'array', items: { $ref: '#/components/schemas/ProblemSummary' } }),
        },
      },
    },
    '/problems/recently-solved': {
      get: {
        tags: ['Problems'],
        summary: "Viewer's recently solved problems",
        security: [{ bearerAuth: [] }],
        responses: {
          '200': ok({ type: 'array', items: { $ref: '#/components/schemas/ProblemSummary' } }),
          '401': errorResponse('UNAUTHORIZED', 'Missing/invalid token'),
        },
      },
    },
    '/problems/bookmarks': {
      get: {
        tags: ['Bookmarks'],
        summary: "Viewer's bookmarked problems (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [listQueryParams[0], listQueryParams[1]],
        responses: {
          '200': ok(paginated('#/components/schemas/ProblemSummary')),
          '401': errorResponse('UNAUTHORIZED', 'Missing/invalid token'),
        },
      },
    },
    '/problems/{id}': {
      get: {
        tags: ['Problems'],
        summary: 'Problem detail by UUID or slug',
        parameters: [idParam],
        responses: {
          '200': ok({ $ref: '#/components/schemas/ProblemDetail' }),
          '403': errorResponse('FORBIDDEN', 'Premium problem, non-premium viewer'),
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown, deleted, or draft problem'),
        },
      },
    },
    '/problems/{id}/bookmark': {
      post: {
        tags: ['Bookmarks'],
        summary: 'Bookmark a problem (idempotent)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          '201': ok({ type: 'object', properties: { bookmarked: { type: 'boolean' } } }),
          '401': errorResponse('UNAUTHORIZED', 'Missing/invalid token'),
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown problem'),
        },
      },
      delete: {
        tags: ['Bookmarks'],
        summary: 'Remove a bookmark',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          '200': ok({ type: 'object', properties: { bookmarked: { type: 'boolean' } } }),
          '401': errorResponse('UNAUTHORIZED', 'Missing/invalid token'),
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown problem'),
        },
      },
    },
    '/tags': {
      get: {
        tags: ['Taxonomy'],
        summary: 'List all tags',
        responses: { '200': ok({ type: 'array', items: { $ref: '#/components/schemas/Tag' } }) },
      },
    },
    '/companies': {
      get: {
        tags: ['Taxonomy'],
        summary: 'List all companies',
        responses: { '200': ok({ type: 'array', items: { $ref: '#/components/schemas/Tag' } }) },
      },
    },
    '/admin/problems': {
      post: {
        tags: ['Admin'],
        summary: 'Create a problem (ADMIN/MODERATOR)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateProblemRequest' } },
          },
        },
        responses: {
          '201': ok({ $ref: '#/components/schemas/ProblemDetail' }, 'Created'),
          '401': errorResponse('UNAUTHORIZED', 'Missing/invalid token'),
          '403': errorResponse('FORBIDDEN', 'Not an admin/moderator'),
          '409': errorResponse('DUPLICATE_PROBLEM', 'Slug already exists'),
          '422': errorResponse('VALIDATION_ERROR', 'Invalid body'),
        },
      },
    },
    '/admin/problems/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Admin detail incl. hidden test cases and drafts',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          '200': ok({ $ref: '#/components/schemas/ProblemDetail' }),
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown problem'),
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Update a problem (optimistic-locked, snapshots previous version)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateProblemRequest' } },
          },
        },
        responses: {
          '200': ok({ $ref: '#/components/schemas/ProblemDetail' }),
          '409': errorResponse('VERSION_CONFLICT', 'Someone updated the problem first'),
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown problem'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Soft-delete a problem',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          '204': { description: 'Soft-deleted' },
          '404': errorResponse('PROBLEM_NOT_FOUND', 'Unknown problem'),
        },
      },
    },
    '/admin/problems/{id}/publish': {
      post: {
        tags: ['Admin'],
        summary: 'Publish a draft (visibility → PUBLIC)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { '200': ok({ $ref: '#/components/schemas/ProblemDetail' }) },
      },
    },
    '/admin/problems/{id}/archive': {
      post: {
        tags: ['Admin'],
        summary: 'Archive a problem (visibility → ARCHIVED)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { '200': ok({ $ref: '#/components/schemas/ProblemDetail' }) },
      },
    },
    '/admin/problems/{id}/test-cases': {
      put: {
        tags: ['Admin'],
        summary: 'Replace the full test-case set (visible + hidden)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UploadTestCasesRequest' } },
          },
        },
        responses: {
          '201': ok({
            type: 'object',
            properties: { replaced: { type: 'boolean' }, count: { type: 'integer' } },
          }),
        },
      },
    },
    '/admin/problems/{id}/editorial': {
      put: {
        tags: ['Admin'],
        summary: 'Create or update the editorial',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { '200': ok({ $ref: '#/components/schemas/ProblemDetail' }) },
      },
    },
    '/admin/problems/{id}/hints': {
      put: {
        tags: ['Admin'],
        summary: 'Replace the ordered hint list',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { '200': ok({ $ref: '#/components/schemas/ProblemDetail' }) },
      },
    },
    '/admin/problems/{id}/versions': {
      get: {
        tags: ['Admin'],
        summary: 'List version history',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { '200': ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/admin/problems/{id}/versions/{version}': {
      get: {
        tags: ['Admin'],
        summary: 'Fetch one archived snapshot',
        security: [{ bearerAuth: [] }],
        parameters: [
          idParam,
          { name: 'version', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { '200': ok({ type: 'object' }) },
      },
    },
    '/admin/tags': {
      post: {
        tags: ['Admin'],
        summary: 'Create/rename a tag',
        security: [{ bearerAuth: [] }],
        responses: { '201': ok({ $ref: '#/components/schemas/Tag' }) },
      },
    },
    '/admin/companies': {
      post: {
        tags: ['Admin'],
        summary: 'Create/rename a company',
        security: [{ bearerAuth: [] }],
        responses: { '201': ok({ $ref: '#/components/schemas/Tag' }) },
      },
    },
  },
} as const;
