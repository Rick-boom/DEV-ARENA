import { z, type ZodType } from 'zod';

/**
 * Validates process.env (or import.meta.env) against a Zod schema and
 * fails fast with a readable report. Every service calls this once at
 * boot so misconfiguration crashes on startup — never at 3am in a
 * request handler.
 */
export function validateEnv<TSchema extends ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`❌ Invalid environment variables:\n${report}`);
    throw new Error('Environment validation failed. See report above.');
  }
  return result.data;
}

/** Common reusable field schemas so services stay consistent. */
export const envField = {
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().min(1).max(65535),
  url: z.string().url(),
  nonEmpty: z.string().min(1),
};
