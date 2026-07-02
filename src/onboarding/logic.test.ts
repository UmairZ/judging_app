import { describe, expect, it } from 'vitest';
import { JOIN_CODE_RE, generateJoinCode, slugifyOrgId, validateIds, provisionedUid, validateRedeem } from './logic';

describe('generateJoinCode', () => {
  it('produces 8 chars from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) expect(generateJoinCode()).toMatch(JOIN_CODE_RE);
  });
  it('does not repeat across a small sample', () => {
    const s = new Set(Array.from({ length: 50 }, generateJoinCode));
    expect(s.size).toBe(50);
  });
});

describe('slugifyOrgId', () => {
  it('lowercases, hyphenates spaces, strips unsafe chars', () => {
    expect(slugifyOrgId('Ibn Katheer Masjid!')).toBe('ibn-katheer-masjid');
    expect(slugifyOrgId('  Al-Noor  Center  ')).toBe('al-noor-center');
  });
  it('caps at 128 and never returns empty for weird input', () => {
    expect(slugifyOrgId('ب').length).toBeGreaterThan(0);
    expect(slugifyOrgId('x'.repeat(300)).length).toBeLessThanOrEqual(128);
  });
});

describe('validateIds / provisionedUid', () => {
  it('accepts safe ids, rejects unsafe', () => {
    expect(validateIds('demo', '2026', 'j1')).toBe(true);
    expect(validateIds('de mo')).toBe(false);
    expect(validateIds('')).toBe(false);
  });
  it('builds the tenant-qualified uid', () => {
    expect(provisionedUid('demo', '2026', 'j1')).toBe('demo__2026__j1');
  });
  it('throws when the uid would exceed 128 chars', () => {
    expect(() => provisionedUid('a'.repeat(60), 'b'.repeat(60), 'c'.repeat(20))).toThrow('uid too long');
  });
});

describe('validateRedeem', () => {
  it('accepts an unredeemed judge code', () => {
    expect(validateRedeem({ role: 'judge', judgeId: 'j1', redeemedBy: null })).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('accepts an unredeemed display code', () => {
    expect(validateRedeem({ role: 'display', redeemedBy: null })).toEqual({ role: 'display', judgeId: null });
  });
  it('rejects missing, redeemed, and corrupt codes', () => {
    expect(() => validateRedeem(null)).toThrow('not-found');
    expect(() => validateRedeem({ role: 'judge', judgeId: 'j1', redeemedBy: 'u9' })).toThrow('already-redeemed');
    expect(() => validateRedeem({ role: 'judge', redeemedBy: null })).toThrow('corrupt-code');
    expect(() => validateRedeem({ role: 'weird', redeemedBy: null })).toThrow('corrupt-code');
  });
});
