import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Where is the .env file? It lives at the REPO ROOT, two folders above this file's
// folder: server/src/config/env.ts -> server/src/config -> server/src -> server -> root.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, '../../../.env');

// In production (Fly.io/Render, Docker) there is no .env file: the platform injects
// variables directly. So we only load the file if it exists.
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  // REQUIRED since Phase 6: documents are stored in Postgres.
  DATABASE_URL: z.string().url(),
  // REQUIRED since Phase 7: the secret that signs login tokens. Anyone who knows it can
  // forge a login, so it must be long, random, and never committed to git.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\nInvalid or missing environment variables:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\nCheck your .env file at the repo root (see .env.example).\n');
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
