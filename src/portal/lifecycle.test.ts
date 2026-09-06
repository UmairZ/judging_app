import { describe, expect, it, vi } from 'vitest';

// lifecycle.ts imports writeDoc from ../data/db, which imports the live Firestore
// bindings from ../firebase/app. That module initializes a real Firebase app at
// import time, which needs env config this test environment doesn't have. Tests
// here always pass their own stub write fn, so a bare mock keeps the import safe.
vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { setStatus, statusColor, timeOfDay } = await import('./lifecycle');

describe('statusColor', () => {
  it('maps live to lime', () => {
    expect(statusColor('live')).toBe('lime');
  });
  it('maps setup to blue', () => {
    expect(statusColor('setup')).toBe('blue');
  });
  it('maps archived to zinc', () => {
    expect(statusColor('archived')).toBe('zinc');
  });
});

describe('timeOfDay', () => {
  it('returns morning before noon', () => {
    expect(timeOfDay(new Date(2026, 0, 1, 0, 0))).toBe('morning');
    expect(timeOfDay(new Date(2026, 0, 1, 11, 59))).toBe('morning');
  });
  it('returns afternoon from noon up to 6pm', () => {
    expect(timeOfDay(new Date(2026, 0, 1, 12, 0))).toBe('afternoon');
    expect(timeOfDay(new Date(2026, 0, 1, 17, 59))).toBe('afternoon');
  });
  it('returns evening from 6pm onward', () => {
    expect(timeOfDay(new Date(2026, 0, 1, 18, 0))).toBe('evening');
    expect(timeOfDay(new Date(2026, 0, 1, 23, 0))).toBe('evening');
  });
});

describe('setStatus', () => {
  it('writes the status field to the competition doc via the given write fn', async () => {
    const calls: Array<{ path: string; data: Record<string, unknown> }> = [];
    const stub = async (path: string, data: Record<string, unknown>) => {
      calls.push({ path, data });
    };
    await setStatus(stub, 'ik', '2026', 'live');
    expect(calls).toEqual([{ path: 'orgs/ik/competitions/2026', data: { status: 'live' } }]);
  });
});
