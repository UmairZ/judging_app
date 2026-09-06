import { describe, it, expect } from 'vitest';
import { parsePortalRoute } from './routes';

describe('parsePortalRoute', () => {
  it('parses /portal as home', () => {
    expect(parsePortalRoute('/portal')).toEqual({ kind: 'home' });
  });

  it('parses /portal/org as org', () => {
    expect(parsePortalRoute('/portal/org')).toEqual({ kind: 'org' });
  });

  it('parses /portal/account as account', () => {
    expect(parsePortalRoute('/portal/account')).toEqual({ kind: 'account' });
  });

  it('parses /portal/c/2026 as comp with overview section', () => {
    expect(parsePortalRoute('/portal/c/2026')).toEqual({ kind: 'comp', compId: '2026', section: 'overview' });
  });

  it('parses /portal/c/2026/scoring as comp with scoring section', () => {
    expect(parsePortalRoute('/portal/c/2026/scoring')).toEqual({ kind: 'comp', compId: '2026', section: 'scoring' });
  });

  it('returns null for invalid section', () => {
    expect(parsePortalRoute('/portal/c/2026/bogus')).toBeNull();
  });

  it('returns null for non-portal routes', () => {
    expect(parsePortalRoute('/about')).toBeNull();
  });

  it('returns null for a non-portal path that merely starts with "/portal"', () => {
    expect(parsePortalRoute('/portalfoo')).toBeNull();
    expect(parsePortalRoute('/portalfoo/c/2026')).toBeNull();
  });
});
