import { describe, expect, it, vi } from 'vitest';

// Mock Firebase app module
vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { renameOrg } = await import('./orgRename');

describe('renameOrg', () => {
  it('writes trimmed name to both org and user org mirror paths', async () => {
    const calls: Array<{ path: string; data: Record<string, unknown> }> = [];
    const stub = async (path: string, data: Record<string, unknown>) => {
      calls.push({ path, data });
    };

    await renameOrg(stub, 'uid123', 'org456', '  My Org  ');

    expect(calls).toEqual([
      { path: 'orgs/org456', data: { name: 'My Org' } },
      { path: 'users/uid123/orgs/org456', data: { name: 'My Org' } },
    ]);
  });

  it('rejects empty name (throws)', async () => {
    const stub = async () => {};
    await expect(renameOrg(stub, 'uid123', 'org456', '')).rejects.toThrow();
  });

  it('rejects whitespace-only name (throws)', async () => {
    const stub = async () => {};
    await expect(renameOrg(stub, 'uid123', 'org456', '   ')).rejects.toThrow();
  });
});
