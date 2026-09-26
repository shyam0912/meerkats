import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  HOST: z.literal('127.0.0.1').default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATABASE_URL: z.url().refine(value => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  }, 'Phase 3 requires a local development database'),
  DEV_IDENTITY_ENABLED: z.literal('true'),
  DEV_USER_ID: z.uuid(), DEV_SCHOOL_ID: z.uuid(),
  ALLOWED_ORIGIN: z.url().refine(value => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.origin === value && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  }),
});
export function parseEnv(input: Record<string, string | undefined>) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map(i => i.path.join('.')).join(', ')}`);
  if (result.data.NODE_ENV === 'production') throw new Error('Development identity is forbidden in production; OIDC is not implemented');
  return result.data;
}
export type Config = ReturnType<typeof parseEnv>;
