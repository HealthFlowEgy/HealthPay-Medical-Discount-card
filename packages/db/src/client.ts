/**
 * Database client (Drizzle + postgres-js).
 *
 * A single lazily-initialised connection is reused across the process. On Vercel
 * serverless this maps to one client per warm instance. If you later move to
 * Neon's serverless driver for edge runtimes, swap the driver here only.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbInstance: Database | null = null;

export function getDb(): Database {
  if (dbInstance) return dbInstance;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  sqlClient = postgres(url, { max: 10, prepare: false });
  dbInstance = drizzle(sqlClient, { schema });
  return dbInstance;
}

/** Close the pool (useful for scripts and tests). */
export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    dbInstance = null;
  }
}
