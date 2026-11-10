import { z } from 'zod';

const configSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url().refine(
    value => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    { message: 'Must be a PostgreSQL connection URL' }
  )
});

export type ApiConfig = z.infer<typeof configSchema>;

/** Never include configuration values (especially the DB password) in errors. */
export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map(issue => issue.path.join('.') || 'configuration'))];
    throw new Error(`Invalid API environment fields: ${fields.join(', ')}`);
  }
  return parsed.data;
}
