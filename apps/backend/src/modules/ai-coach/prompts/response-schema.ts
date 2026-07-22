/**
 * The JSON schema handed to Gemini for structured output. Constraining
 * the model to this shape is both a UX win (predictable contract) and a
 * safety win: there's no free-form field big enough to dump a full
 * solution into, and every field has a described, bounded purpose.
 */
export const COACH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Short focused guidance. Never a full solution.' },
    points: { type: 'array', items: { type: 'string' }, description: 'Hints/review points/notes.' },
    complexity: {
      type: 'object',
      properties: {
        time: { type: 'string' },
        space: { type: 'string' },
        explanation: { type: 'string' },
      },
    },
    questions: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          topic: { type: 'string' },
          problemId: { type: 'string' },
        },
        required: ['title', 'reason'],
      },
    },
    hintLevel: { type: 'number' },
  },
  required: ['summary', 'points'],
} as const;
