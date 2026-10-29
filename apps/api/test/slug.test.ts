import { describe, it, expect } from 'vitest';
import { generateSlug } from '../src/lib/slug.js';

describe('Slug Generator', () => {
  it('converts titles to lowercase kebab-case', () => {
    expect(generateSlug('Weekly Coding Challenge #1')).toBe('weekly-coding-challenge-1');
    expect(generateSlug('Quantum Superposition & Entanglement!')).toBe('quantum-superposition-and-entanglement');
    expect(generateSlug('   Leading and Trailing Spaces   ')).toBe('leading-and-trailing-spaces');
  });

  it('falls back to "entry" when title contains only stripped special characters', () => {
    expect(generateSlug('???!!!:::')).toBe('entry');
    expect(generateSlug('')).toBe('entry');
  });
});
