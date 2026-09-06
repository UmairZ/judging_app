import { describe, expect, it, vi } from 'vitest';

// backend.tsx imports the live Firestore SDK bindings from firebase/app for its
// Firestore-backed implementation. That module initializes a real Firebase app
// at import time, which requires env config this test environment doesn't have.
// InMemoryBackend never touches `db`/`auth`, so a bare mock keeps the import safe.
vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { InMemoryBackend } = await import('./backend');

describe('InMemoryBackend', () => {
  it('notifies subscribers on write and merges by default', async () => {
    const b = new InMemoryBackend();
    const seen: unknown[] = [];
    b.subscribeDoc('sessions/s1', (d) => seen.push(d));
    expect(seen).toEqual([null]);
    await b.write('sessions/s1', { a: 1 }, true);
    await b.write('sessions/s1', { b: 2 }, true);
    expect(seen[2]).toMatchObject({ id: 's1', a: 1, b: 2 });
  });

  it('replaces instead of merging when merge=false and supports unsubscribe', async () => {
    const b = new InMemoryBackend();
    const cb = vi.fn();
    const un = b.subscribeDoc('x/y', cb);
    await b.write('x/y', { a: 1 }, true);
    await b.write('x/y', { b: 2 }, false);
    expect(cb).toHaveBeenLastCalledWith(expect.not.objectContaining({ a: 1 }));
    un();
    await b.write('x/y', { c: 3 }, true);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('resolves timestamp sentinels to a number', async () => {
    const b = new InMemoryBackend();
    let latest: Record<string, unknown> | null = null;
    b.subscribeDoc('t/1', (d) => (latest = d as Record<string, unknown> | null));
    await b.write('t/1', { startedAt: { __sentinel: 'serverTimestamp' } }, true);
    expect(typeof (latest as Record<string, unknown> | null)?.startedAt).toBe('number');
  });

  it('subscribeCollection notifies with seeded docs and later writes', async () => {
    const b = new InMemoryBackend();
    b.seed('orgs/o/competitions/c1', { name: 'A' });
    const seen: unknown[][] = [];
    const off = b.subscribeCollection('orgs/o/competitions', (docs) => seen.push(docs));
    expect(seen[0]).toHaveLength(1);
    await b.write('orgs/o/competitions/c2', { name: 'B' }, true);
    expect(seen.at(-1)).toHaveLength(2);
    off();
  });

  it('count filters by present field', async () => {
    const b = new InMemoryBackend();
    b.seed('x/y/sessions/s1', { finalizedAt: 123 });
    b.seed('x/y/sessions/s2', { finalizedAt: null });
    expect(await b.count('x/y/sessions')).toBe(2);
    expect(await b.count('x/y/sessions', 'finalizedAt')).toBe(1);
  });
});
