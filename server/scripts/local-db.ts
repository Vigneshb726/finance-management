/**
 * Development helper: runs a real PostgreSQL server from npm (embedded-postgres),
 * for machines without a system PostgreSQL install. Connection details are read
 * from DATABASE_URL in server/.env. Data persists in server/.pgdata.
 *
 *   npm run db:local     (keep this terminal open)
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  // embedded-postgres is ESM-only
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/finance_db');
  const databaseDir = path.resolve(__dirname, '../.pgdata');
  const database = url.pathname.replace(/^\//, '') || 'finance_db';

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: decodeURIComponent(url.username || 'postgres'),
    password: decodeURIComponent(url.password || 'postgres'),
    port: Number(url.port || 5432),
    persistent: true,
    // Windows defaults to WIN1252, which cannot store ₹ or emoji
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    console.log('Initialising new PostgreSQL data directory...');
    await pg.initialise();
  }
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`Created database "${database}"`);
  } catch {
    // already exists
  }

  console.log(`✅ PostgreSQL running on port ${url.port || 5432} (database "${database}"). Press Ctrl+C to stop.`);

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
}

main().catch((err) => {
  console.error('Failed to start local PostgreSQL:', err);
  process.exit(1);
});
