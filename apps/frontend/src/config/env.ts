import { z } from 'zod';

/**
 * Validates Vite client env at module load. Vite only exposes vars
 * prefixed with VITE_, so nothing secret can leak here by design.
 */
const schema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4000'),
  VITE_SOCKET_URL: z.string().url().default('http://localhost:4000'),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('❌ Invalid VITE_ environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Frontend environment validation failed');
}

export const env = parsed.data;
