import { z } from 'zod';
import { validateEnv, envField } from '@devarena/shared-utils';

const schema = z.object({
  NODE_ENV: envField.nodeEnv,
  PORT: envField.port.default(5000),
  // Optional in the foundation so the service boots without a key;
  // becomes required once AI endpoints are implemented.
  GEMINI_API_KEY: z.string().min(1).optional(),
});

export const env = validateEnv(schema, process.env);
