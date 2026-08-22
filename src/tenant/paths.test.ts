import { describe, expect, it } from 'vitest';
import { parseTenantPath, compBasePath } from './paths';
import { parseRoute } from '../onboarding/logic';

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

describe('parseRoute', () => {
  it('root for /, single segment, invalid ids', () => {
    expect(parseRoute('/')).toEqual({ kind: 'root' });
    expect(parseRoute('/demo')).toEqual({ kind: 'root' });
  });
  it('tenant for /{org}/{comp} and deeper non-join paths', () => {
    expect(parseRoute('/demo/2026')).toEqual({ kind: 'tenant', orgId: 'demo', compId: '2026' });
    expect(parseRoute('/demo/2026/leaderboard')).toEqual({ kind: 'tenant', orgId: 'demo', compId: '2026' });
  });
  it('join with and without a code', () => {
    expect(parseRoute('/demo/2026/join/JUDGE234')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: 'JUDGE234' });
    expect(parseRoute('/demo/2026/join')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: null });
    expect(parseRoute('/demo/2026/join/bad-code!')).toEqual({ kind: 'join', orgId: 'demo', compId: '2026', code: null });
  });
});
