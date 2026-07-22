import { SUPPORTED_LANGUAGES, ExecutionStatus } from '../types/execution.types.js';

/**
 * OpenAPI 3.0 spec for the execution service, served at /docs (Swagger
 * UI) and /docs.json. Hand-maintained beside the route it documents.
 */
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

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DevArena — Remote Code Execution API',
    version: '1.0.0',
    description:
      'Runs untrusted source code inside single-use, network-isolated, resource-capped Docker containers via a BullMQ work queue. Returns one of seven terminal verdicts.',
  },
  servers: [{ url: '/' }],
  components: {
    schemas: {
      ExecuteRequest: {
        type: 'object',
        required: ['language', 'code'],
        properties: {
          language: { type: 'string', enum: [...SUPPORTED_LANGUAGES] },
          code: { type: 'string', description: 'Source code (≤ 64KB)' },
          input: { type: 'string', description: 'stdin fed to the program (≤ 1MB)' },
          timeLimitMs: {
            type: 'integer',
            description: 'Overrides default; clamped to service max',
          },
          memoryLimitMb: {
            type: 'integer',
            description: 'Overrides default; clamped to service max',
          },
          priority: { type: 'integer', minimum: 1, maximum: 10, description: 'Lower runs sooner' },
        },
      },
      ExecutionResult: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: Object.values(ExecutionStatus) },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          exitCode: { type: 'integer', nullable: true },
          executionTimeMs: { type: 'integer' },
          memoryUsedMb: { type: 'number' },
          truncated: { type: 'boolean' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness + live queue depth',
        responses: {
          '200': {
            description: 'Service healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        queue: { type: 'object', additionalProperties: { type: 'integer' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/execute': {
      post: {
        tags: ['Execution'],
        summary: 'Compile & run source in a sandboxed container, return the verdict',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ExecuteRequest' } },
          },
        },
        responses: {
          '200': {
            description:
              'Job completed. `status` distinguishes ACCEPTED from COMPILATION_ERROR, RUNTIME_ERROR, TIME/MEMORY/OUTPUT limits, or INTERNAL_ERROR.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/ExecutionResult' },
                  },
                },
              },
            },
          },
          '422': errorResponse('VALIDATION_ERROR', 'Invalid body (bad language, empty code, …)'),
          '503': errorResponse('QUEUE_FULL', 'Queue at capacity — retry shortly'),
          '500': errorResponse('INTERNAL_ERROR', 'Unexpected server error'),
        },
      },
    },
  },
} as const;
