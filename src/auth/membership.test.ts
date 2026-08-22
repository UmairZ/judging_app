import { describe, expect, it } from 'vitest';
import { resolveMembership } from './membership';

describe('resolveMembership', () => {
  it('org owner and org admin both resolve to admin', () => {
    expect(resolveMembership({ role: 'owner' }, null)).toEqual({ role: 'admin', judgeId: null });
    expect(resolveMembership({ role: 'admin' }, null)).toEqual({ role: 'admin', judgeId: null });
  });
  it('org staff wins even when a comp member doc also exists', () => {
    expect(resolveMembership({ role: 'owner' }, { role: 'judge', judgeId: 'j1' })).toEqual({ role: 'admin', judgeId: null });
  });
  it('comp judge resolves with its judgeId', () => {
    expect(resolveMembership(null, { role: 'judge', judgeId: 'j1' })).toEqual({ role: 'judge', judgeId: 'j1' });
  });
  it('a judge member doc without judgeId resolves to no role', () => {
    expect(resolveMembership(null, { role: 'judge' })).toEqual({ role: null, judgeId: null });
  });
  it('comp display resolves to display', () => {
    expect(resolveMembership(null, { role: 'display' })).toEqual({ role: 'display', judgeId: null });
  });
  it('no member docs resolves to no role', () => {
    expect(resolveMembership(null, null)).toEqual({ role: null, judgeId: null });
  });
});
