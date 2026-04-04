import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runMigrations } from '@syncode/db';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import postgres from 'postgres';

export const PG_CONFIG_PATH = path.join(tmpdir(), 'syncode-test-pg.json');

let container: StartedPostgreSqlContainer;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();

  const host = container.getHost();
  const port = container.getPort();
  const user = container.getUsername();
  const password = container.getPassword();

  const adminUrl = `postgresql://${user}:${password}@${host}:${port}/postgres`;
  const adminClient = postgres(adminUrl, { max: 1 });

  try {
    await adminClient`CREATE DATABASE syncode_template`;

    const templateUrl = `postgresql://${user}:${password}@${host}:${port}/syncode_template`;
    const migrationsFolder = path.resolve(__dirname, '../../../../packages/db/drizzle');
    await runMigrations(templateUrl, migrationsFolder);

    await adminClient`ALTER DATABASE syncode_template IS_TEMPLATE true`;
  } finally {
    await adminClient.end();
  }

  writeFileSync(PG_CONFIG_PATH, JSON.stringify({ host, port, user, password }));
}

export async function teardown() {
  await container?.stop();
}
