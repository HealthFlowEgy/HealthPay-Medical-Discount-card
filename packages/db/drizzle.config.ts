import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Prefer a direct (non-pooled) connection for DDL/migrations when available
    // (the Vercel Postgres / Neon integration exposes these names).
    url:
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      "",
  },
  verbose: true,
  strict: true,
});
