import slugify from 'slugify';
import { prisma } from './prisma.js';

/**
 * Generate a URL-friendly slug from a title string.
 *
 * @param title The title string to slugify
 * @returns Clean lowercase kebab-case slug
 */
export function generateSlug(title: string): string {
  const base = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
  return base || 'entry';
}

/**
 * Generate a unique slug for a ContentEntry.
 * If slug already exists, appends a numeric suffix.
 *
 * @param title Title to generate slug from
 * @param currentId Optional entry ID to exclude from collision check
 * @returns Unique slug string
 */
export async function generateUniqueSlug(title: string, currentId?: string): Promise<string> {
  const base = generateSlug(title);
  let slug = base;
  let counter = 1;

  while (true) {
    const existing = await prisma.contentEntry.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (currentId && existing.id === currentId)) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter++;
  }
}
