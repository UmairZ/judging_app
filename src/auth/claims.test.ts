import { describe, it, expect } from 'vitest';
import { judgeClaims, adminClaims, displayClaims, roleFromClaims } from './claims';

describe('claim builders', () => {
  it('judgeClaims sets role + judgeId (uid will equal judgeId)', () => {
    expect(judgeClaims('j1')).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('adminClaims sets the admin flag the rules read', () => {
    expect(adminClaims()).toEqual({ admin: true });
  });
  it('displayClaims sets the display role', () => {
    expect(displayClaims()).toEqual({ role: 'display' });
  });
});

describe('roleFromClaims', () => {
  it('admin flag wins', () => {
    expect(roleFromClaims({ admin: true })).toBe('admin');
    expect(roleFromClaims({ admin: true, role: 'judge', judgeId: 'x' })).toBe('admin');
  });
  it('judge requires role judge AND a non-empty judgeId', () => {
    expect(roleFromClaims({ role: 'judge', judgeId: 'j1' })).toBe('judge');
    expect(roleFromClaims({ role: 'judge', judgeId: '' })).toBeNull();
    expect(roleFromClaims({ role: 'judge' })).toBeNull();
  });
  it('recognizes display', () => {
    expect(roleFromClaims({ role: 'display' })).toBe('display');
  });
  it('returns null for empty/unknown/absent claims', () => {
    expect(roleFromClaims(null)).toBeNull();
    expect(roleFromClaims(undefined)).toBeNull();
    expect(roleFromClaims({})).toBeNull();
    expect(roleFromClaims({ role: 'wizard' })).toBeNull();
  });
});
