/** OpenAPI fragment for the Battle Engine, merged into the backend spec. */
export const battleOpenApiPaths = {
  '/battle/create': {
    post: {
      tags: ['Battle'],
      summary: 'Create a battle + room, return the battle and an invite token',
      security: [{ bearerAuth: [] }],
      responses: {
        '201': { description: 'Created' },
        '403': { description: 'problemId required' },
      },
    },
  },
  '/battle/join': {
    post: {
      tags: ['Battle'],
      summary: 'Join by battleId, room code, or invite token',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Joined' },
        '403': { description: 'INVALID_INVITE' },
        '409': { description: 'ALREADY_JOINED | ROOM_FULL | ROOM_CLOSED' },
      },
    },
  },
  '/battle/start': {
    post: {
      tags: ['Battle'],
      summary: 'Host starts the countdown (WAITING→COUNTDOWN)',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Countdown started' },
        '403': { description: 'NOT_HOST' },
      },
    },
  },
  '/battle/pause': {
    post: {
      tags: ['Battle'],
      summary: 'Host pauses an active battle',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Paused' }, '409': { description: 'INVALID_TRANSITION' } },
    },
  },
  '/battle/resume': {
    post: {
      tags: ['Battle'],
      summary: 'Host resumes a paused battle (deadline extended fairly)',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Resumed' } },
    },
  },
  '/battle/finish': {
    post: {
      tags: ['Battle'],
      summary: 'Host finishes a battle; publishes a rating event',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Finished' }, '409': { description: 'BATTLE_FINISHED' } },
    },
  },
  '/battle/rematch': {
    post: {
      tags: ['Battle'],
      summary: 'Create a fresh battle reusing problem + mode',
      security: [{ bearerAuth: [] }],
      responses: { '201': { description: 'Rematch created' } },
    },
  },
  '/battle/{id}': {
    get: {
      tags: ['Battle'],
      summary: 'Battle detail (durable + live runtime state)',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'OK' }, '404': { description: 'BATTLE_NOT_FOUND' } },
    },
  },
  '/battle/history': {
    get: {
      tags: ['Battle'],
      summary: "Authenticated user's finished/aborted battles",
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Paginated history' } },
    },
  },
  '/battle/{id}/replay': {
    get: {
      tags: ['Battle'],
      summary: 'Ordered replay event timeline',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { '200': { description: 'Replay events' } },
    },
  },
} as const;
