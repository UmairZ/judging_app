import { describe, expect, it } from 'vitest';
import { DEFAULT_STRUCTURE_CONFIG } from '../domain/structure';
import { buildPromotion, resolveCategories } from './promotion';

const reg = (parsedFields: Record<string, unknown>) => ({ parsedFields });

describe('buildPromotion', () => {
  it('promotes a fully-resolved gendered row', () => {
    const plan = buildPromotion(reg({ fullName: 'Fatima', gender: 'female', categories: ["1 Juz'"] }), DEFAULT_STRUCTURE_CONFIG);
    expect(plan).toEqual({ fullName: 'Fatima', gender: 'female', pairs: [{ categoryId: '1', division: 'sisters' }] });
  });
  it('refuses a gendered category without a resolvable gender (needs manual drawer)', () => {
    expect(buildPromotion(reg({ fullName: 'Jane', gender: null, categories: ["1 Juz'"] }), DEFAULT_STRUCTURE_CONFIG)).toBeNull();
    expect(buildPromotion(reg({ fullName: 'Jane', categories: ["1 Juz'"] }), DEFAULT_STRUCTURE_CONFIG)).toBeNull();
  });
  it('promotes a single-division category regardless of gender', () => {
    const plan = buildPromotion(reg({ fullName: 'Omar', categories: ["15 Ajzā'"] }), DEFAULT_STRUCTURE_CONFIG);
    expect(plan?.pairs).toEqual([{ categoryId: '15', division: 'combined' }]);
  });
  it('refuses unmapped categories and missing names', () => {
    expect(buildPromotion(reg({ fullName: 'X', categories: ['Nonsense'] }), DEFAULT_STRUCTURE_CONFIG)).toBeNull();
    expect(buildPromotion(reg({ fullName: '', categories: ["1 Juz'"] }), DEFAULT_STRUCTURE_CONFIG)).toBeNull();
    expect(buildPromotion(reg({ fullName: 'X', categories: [] }), DEFAULT_STRUCTURE_CONFIG)).toBeNull();
  });
  it('matches categories by label and id, not just zeffy labels', () => {
    expect(resolveCategories(['1'], DEFAULT_STRUCTURE_CONFIG)[0].unmapped).toBe(false);
    expect(resolveCategories(["1 Juz'"], DEFAULT_STRUCTURE_CONFIG)[0].unmapped).toBe(false);
  });
});
