import { sql } from '@finora/core';
import { env } from './config/env';
import { db } from './config/db';
import { createApp } from './app';

async function main() {
  await sql`SELECT 1`.execute(db); // fail fast if the database is unreachable
  const server = createApp().listen(env.PORT, () => {
    console.log(`🚀 API ready at http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await db.destroy();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('❌ Failed to start server:', err instanceof Error ? err.message : err);
  await db.destroy().catch(() => undefined);
  process.exit(1);
});
