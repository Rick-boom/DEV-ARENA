import { describe, expect, it } from 'vitest';
import { executeRequestSchema } from '../../validators/execution.schema.js';

describe('executeRequestSchema', () => {
  it('accepts a minimal valid request and defaults input to empty', () => {
    const r = executeRequestSchema.parse({ language: 'javascript', code: 'console.log(1)' });
    expect(r.input).toBe('');
  });

  it('rejects an unsupported language', () => {
    const r = executeRequestSchema.safeParse({ language: 'ruby', code: 'x' });
    expect(r.success).toBe(false);
  });

  it('rejects empty code', () => {
    const r = executeRequestSchema.safeParse({ language: 'python', code: '' });
    expect(r.success).toBe(false);
  });

  it('rejects code above the 64KB ceiling', () => {
    const r = executeRequestSchema.safeParse({ language: 'python', code: 'a'.repeat(64_001) });
    expect(r.success).toBe(false);
  });

  it('rejects a memory limit above the service maximum', () => {
    const r = executeRequestSchema.safeParse({
      language: 'python',
      code: 'x',
      memoryLimitMb: 4096,
    });
    expect(r.success).toBe(false);
  });
});
