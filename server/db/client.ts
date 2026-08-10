import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

export type Database = NeonHttpDatabase<typeof schema>;

export function createDb(databaseUrl: string): Database {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  return drizzle(neon(databaseUrl), { schema });
}

/** Node/dev convenience: reads DATABASE_URL from the environment. */
export function createDbFromEnv(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add a Neon connection string to .env.',
    );
  }
  return createDb(url);
}
