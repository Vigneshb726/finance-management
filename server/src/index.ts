import { env } from './config/env';
import { prisma } from './config/prisma';
import { createApp } from './app';

async function main() {
  await prisma.$connect();
  const server = createApp().listen(env.PORT, () => {
    console.log(`🚀 API ready at http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  console.error('❌ Failed to start server:', err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
