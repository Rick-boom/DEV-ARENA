/** OpenAPI for the tiny HTTP surface (health only). */
export const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'DevArena Socket Service - HTTP', version: '1.0.0' },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness + local socket count on this node',
        responses: {
          '200': {
            description: 'OK',
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
                        node: { type: 'integer' },
                        localConnections: { type: 'integer' },
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
  },
} as const;
