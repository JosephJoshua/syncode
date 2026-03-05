import { runMigrations } from './run-migrations';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

await runMigrations(databaseUrl, './drizzle/');

console.log('Migrations complete');
