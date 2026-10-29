import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance for database access.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Handle process shutdown with clean disconnection
let isDisconnecting = false;

async function handleShutdown(): Promise<void> {
  if (isDisconnecting) return;
  isDisconnecting = true;
  try {
    await prisma.$disconnect();
  } catch {
    // Ignore error during process termination
  }
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('beforeExit', handleShutdown);
