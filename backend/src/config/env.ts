import { z } from 'zod';

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    PORT: z.string().regex(/^\d+$/).default('3001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
  })
  .refine((e) => e.JWT_SECRET !== e.JWT_REFRESH_SECRET, {
    message: 'JWT_SECRET and JWT_REFRESH_SECRET must differ',
    path: ['JWT_REFRESH_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

/** Pure parse, for tests: returns the env or the list of offending keys. */
export function parseEnv(
  source: Record<string, string | undefined>
): { ok: true; env: Env } | { ok: false; errors: Record<string, string[] | undefined> } {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, errors: parsed.error.flatten().fieldErrors };
}

const result = parseEnv(process.env);

if (!result.ok) {
  // Names only — never print the values.
  console.error('Invalid environment variables:', result.errors);
  process.exit(1);
}

/** Validated at import time: a bad or missing secret stops the process at boot. */
export const env: Env = result.env;
