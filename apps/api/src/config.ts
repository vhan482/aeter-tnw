import { z } from 'zod';

const configSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.string().url().default('http://127.0.0.1:5173'),
  DATABASE_URL: z.string().url().refine(
    value => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    { message: 'Must be a PostgreSQL connection URL' }
  )
}).superRefine((data, context) => {
  if (data.NODE_ENV === 'production' && !data.APP_ORIGIN.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['APP_ORIGIN'], message: 'HTTPS required in production' });
  }
});

export type ApiConfig = z.infer<typeof configSchema>;

/** Never print supplied env values, especially DB passwords or tokens. */
export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.') || 'configuration'))];
    throw new Error(`Invalid API environment fields: ${fields.join(', ')}`);
  }
  return parsed.data;
}
