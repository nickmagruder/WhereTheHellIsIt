import { defineConfig } from 'drizzle-kit';

// DATABASE_URL must be set in .env or environment before running drizzle-kit commands.
// For local dev: postgres://dev:dev@localhost:5432/wherethehellistit
// For Lambda: this file is not used — the Lambda connects via RDS Proxy using credentials
// fetched from Secrets Manager at runtime.
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://dev:dev@localhost:5432/wherethehellistit',
  },
});
