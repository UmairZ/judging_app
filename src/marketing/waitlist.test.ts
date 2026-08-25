import { describe, expect, it, vi } from 'vitest';

// waitlist.ts imports the live Firestore SDK bindings from firebase/app for
// submitWaitlist. That module initializes a real Firebase app at import time,
// which requires env config this test environment doesn't have. validateWaitlist
// never touches `db`, so a bare mock keeps the import safe (same pattern as
// src/data/backend.test.ts and src/marketing/DemoGrading.test.tsx).
vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { validateWaitlist } = await import('./waitlist');

describe('validateWaitlist', () => {
  it('accepts a plain email and trims fields', () => {
    expect(validateWaitlist({ email: '  a@b.co ', name: ' X ', org: '' }))
      .toEqual({ ok: true, value: { email: 'a@b.co', name: 'X', org: undefined } });
  });
  it('rejects malformed emails', () => {
    expect(validateWaitlist({ email: 'not-an-email' }).ok).toBe(false);
    expect(validateWaitlist({ email: '' }).ok).toBe(false);
  });
});
