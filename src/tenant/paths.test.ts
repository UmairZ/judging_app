import { describe, expect, it } from 'vitest';
import { parseTenantPath, compBasePath } from './paths';

describe('parseTenantPath', () => {
  it('parses /{orgId}/{compId}', () => {
    expect(parseTenantPath('/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('ignores trailing slashes and extra segments', () => {
    expect(parseTenantPath('/demo/2026/')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(parseTenantPath('/demo/2026/leaderboard')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('returns null for root, single segment, or empty', () => {
    expect(parseTenantPath('/')).toBeNull();
    expect(parseTenantPath('/demo')).toBeNull();
    expect(parseTenantPath('')).toBeNull();
  });
  it('rejects segments outside the safe charset', () => {
    expect(parseTenantPath('/de mo/2026')).toBeNull();
    expect(parseTenantPath('/demo/20%26')).toBeNull();
    expect(parseTenantPath('/a.b/2026')).toBeNull();
  });
});

describe('compBasePath', () => {
  it('builds the nested competition path', () => {
    expect(compBasePath('demo', '2026')).toBe('orgs/demo/competitions/2026');
  });
});
