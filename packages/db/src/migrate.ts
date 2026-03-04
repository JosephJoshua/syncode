import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle/' });

await client.end();
console.log('Migrations complete');
