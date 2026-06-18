import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STRUCTURE_CONFIG,
  generateSlots,
  slotId,
  defaultDivisionForCategory,
} from './structure';

describe('generateSlots', () => {
  it('produces the cross-product of each category with its own divisions (6 for the default)', () => {
    const slots = generateSlots(DEFAULT_STRUCTURE_CONFIG);
    expect(slots).toHaveLength(6);
    expect(slots).toContainEqual({ category: '1', division: 'brothers' });
    expect(slots).toContainEqual({ category: '15', division: 'combined' });
    expect(slots.filter((s) => s.category === '30')).toEqual([{ category: '30', division: 'combined' }]);
  });
});

describe('slotId', () => {
  it('joins category and division', () => {
    expect(slotId({ category: '5', division: 'sisters' })).toBe('5_sisters');
  });
});

describe('defaultDivisionForCategory', () => {
  const cat = (id: string) => DEFAULT_STRUCTURE_CONFIG.categories.find((c) => c.id === id)!;

  it('returns the only division for a single-division category', () => {
    expect(defaultDivisionForCategory(cat('15'))).toBe('combined');
  });

  it('maps gender to brothers/sisters for a gendered category', () => {
    expect(defaultDivisionForCategory(cat('1'), 'male')).toBe('brothers');
    expect(defaultDivisionForCategory(cat('1'), 'female')).toBe('sisters');
  });

  it('returns null for a gendered category with unknown gender', () => {
    expect(defaultDivisionForCategory(cat('1'), null)).toBeNull();
  });
});
