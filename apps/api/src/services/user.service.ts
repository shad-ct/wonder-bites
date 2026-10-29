import argon2 from 'argon2';
import { prisma } from '../lib/prisma.js';

let cachedDefaultUserId: string | null = null;

/**
 * Resolves the default user ID for headless or MCP operations when no HTTP session exists.
 * If no user exists yet, automatically provisions the initial user.
 */
export async function getDefaultUserId(): Promise<string> {
  if (cachedDefaultUserId) {
    const exists = await prisma.user.findUnique({
      where: { id: cachedDefaultUserId },
      select: { id: true },
    });
    if (exists) return cachedDefaultUserId;
  }

  const preferredUsername = process.env.INITIAL_USERNAME || 'admin';
  let user = await prisma.user.findUnique({
    where: { username: preferredUsername },
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    const password = process.env.INITIAL_USER_PASSWORD || 'changeme123';
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    user = await prisma.user.create({
      data: {
        username: preferredUsername,
        passwordHash,
        timezone: 'Asia/Kolkata',
        preferences: {},
      },
    });
  }

  cachedDefaultUserId = user.id;
  return user.id;
}
