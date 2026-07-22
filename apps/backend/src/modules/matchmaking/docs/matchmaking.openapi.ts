/** OpenAPI fragment for matchmaking + leaderboards, merged into the backend spec. */
export const matchmakingOpenApiPaths = {
  '/queue/join': {
    post: {
      tags: ['Matchmaking'],
      summary: 'Join the matchmaking queue',
      security: [{ bearerAuth: [] }],
      responses: {
        '202': { description: 'Queued' },
        '409': { description: 'ALREADY_QUEUED' },
        '429': { description: 'RATE_LIMITED' },
      },
    },
  },
  '/queue/leave': {
    post: {
      tags: ['Matchmaking'],
      summary: 'Leave the queue',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Left' }, '404': { description: 'NOT_QUEUED' } },
    },
  },
  '/queue/status': {
    get: {
      tags: ['Matchmaking'],
      summary: 'Current queue ticket, if any',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'OK' } },
    },
  },
  '/queue/reconnect': {
    post: {
      tags: ['Matchmaking'],
      summary: 'Flush match handoffs missed while offline',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Pending matches delivered' } },
    },
  },
  '/leaderboard': {
    get: {
      tags: ['Leaderboard'],
      summary: 'Board by scope (global/country/college/friends) + period',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': { description: 'Page' },
        '503': { description: 'LEADERBOARD_UNAVAILABLE' },
      },
    },
  },
  '/leaderboard/global': {
    get: {
      tags: ['Leaderboard'],
      summary: 'Global board shortcut',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Page' } },
    },
  },
  '/leaderboard/friends': {
    get: {
      tags: ['Leaderboard'],
      summary: "Caller's friends board",
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Page' } },
    },
  },
  '/rating/history': {
    get: {
      tags: ['Rating'],
      summary: 'Rating stats (current/peak/streaks) + recent changes',
      security: [{ bearerAuth: [] }],
      responses: { '200': { description: 'Stats + history' } },
    },
  },
} as const;
