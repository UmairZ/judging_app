// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { DbBackend } from '../data/backend';

// PortalRoot (via HomePage -> ../data/db and ../firebase/app) initializes a real
// Firebase app at import time, which needs env config this test environment
// doesn't have. InMemoryBackend never touches `db`/`auth`/`app`, so a bare mock
// keeps the import safe — same pattern as src/data/backend.test.ts.
vi.mock('../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'x@y.z' }, signOut: vi.fn() }),
}));

const { InMemoryBackend, DbProvider } = await import('../data/backend');
const { PortalRoot } = await import('./PortalRoot');

/** Wraps a backend, recording every path passed to subscribeDoc/subscribeCollection/
 * count — used to prove no hook ever requests a sentinel/reserved-looking path. */
function spyBackend(inner: InstanceType<typeof InMemoryBackend>) {
  const paths: string[] = [];
  const wrapped: DbBackend = {
    kind: inner.kind,
    subscribeDoc: (path, cb) => {
      paths.push(path);
      return inner.subscribeDoc(path, cb);
    },
    subscribeCollection: (path, cb) => {
      paths.push(path);
      return inner.subscribeCollection(path, cb);
    },
    write: (path, data, merge) => inner.write(path, data, merge),
    count: (path, presentField) => {
      paths.push(path);
      return inner.count(path, presentField);
    },
  };
  return { wrapped, paths };
}

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('users/u1/orgs/ik', { role: 'owner', name: 'Ibn Katheer' });

  backend.seed('orgs/ik/competitions/2026', { name: '2026 Ramadan Contest', status: 'live' });
  backend.seed('orgs/ik/competitions/2025', { name: '2025 Ramadan Contest', status: 'archived' });

  backend.seed('orgs/ik/competitions/2026/registrations/r1', { name: 'A' });
  backend.seed('orgs/ik/competitions/2026/registrations/r2', { name: 'B' });
  backend.seed('orgs/ik/competitions/2026/registrations/r3', { name: 'C' });

  backend.seed('orgs/ik/competitions/2026/sessions/s1', { finalizedAt: 111 });
  backend.seed('orgs/ik/competitions/2026/sessions/s2', { finalizedAt: 222 });
  backend.seed('orgs/ik/competitions/2026/sessions/s3', { finalizedAt: null });

  backend.seed('orgs/ik/competitions/2026/judges/j1', {});
  backend.seed('orgs/ik/competitions/2026/judges/j2', {});
  backend.seed('orgs/ik/competitions/2026/judges/j3', {});
  backend.seed('orgs/ik/competitions/2026/judges/j4', {});

  backend.seed('orgs/ik/competitions/2026/config/structure', { categories: [1, 2, 3, 4, 5] });
  return backend;
}

describe('org home (PortalRoot + HomePage)', () => {
  it('renders the org name, both competition cards, status chips and live stats', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <PortalRoot />
      </DbProvider>,
    );

    // Org name (sidebar header).
    expect(await screen.findByText('Ibn Katheer')).toBeTruthy();

    // Both competition cards.
    expect(await screen.findByText('2026 Ramadan Contest')).toBeTruthy();
    expect(screen.getByText('2025 Ramadan Contest')).toBeTruthy();

    // Status chips.
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();

    // Stat labels.
    expect(screen.getByText('Registrations')).toBeTruthy();
    expect(screen.getByText('Sessions graded')).toBeTruthy();
    expect(screen.getByText('Judges')).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();

    // Stat values, resolved from InMemoryBackend.count.
    expect(await screen.findByText('3')).toBeTruthy(); // registrations
    expect(await screen.findByText('2')).toBeTruthy(); // sessions graded (finalizedAt present)
    expect(await screen.findByText('4')).toBeTruthy(); // judges
    expect(await screen.findByText('5')).toBeTruthy(); // categories
  });

  it('falls back to the true newest competition by createdAt when none are live', async () => {
    const backend = new InMemoryBackend();
    backend.seed('users/u1/orgs/ik', { role: 'owner', name: 'Ibn Katheer' });

    // Neither competition is live. Seeded OUT of chronological order — 'newer'
    // (createdAt 2000) is inserted before 'older' (createdAt 1000) — so a naive
    // "last element of the collection" pick would land on 'older' (wrong).
    // Sorting by createdAt descending must pick 'newer'.
    backend.seed('orgs/ik/competitions/newer', { name: 'Newer Contest', status: 'setup', createdAt: 2000 });
    backend.seed('orgs/ik/competitions/older', { name: 'Older Contest', status: 'setup', createdAt: 1000 });

    for (let i = 1; i <= 7; i += 1) {
      backend.seed(`orgs/ik/competitions/newer/registrations/r${i}`, {});
    }
    for (let i = 1; i <= 2; i += 1) {
      backend.seed(`orgs/ik/competitions/older/registrations/r${i}`, {});
    }

    render(
      <DbProvider backend={backend}>
        <PortalRoot />
      </DbProvider>,
    );

    // Registrations stat must reflect 'newer' (7), never 'older' (2).
    expect(await screen.findByText('7')).toBeTruthy();
    expect(screen.queryByText('2')).toBeNull();
  });

  describe('no-org account (e.g. a judge with no users/{uid}/orgs docs)', () => {
    it('still renders the sidebar with Sign out, plus a clear empty state — no New-competition button', async () => {
      // No users/u1/orgs docs seeded at all.
      const backend = new InMemoryBackend();
      render(
        <DbProvider backend={backend}>
          <PortalRoot />
        </DbProvider>,
      );

      // Sidebar still renders: product-name header (no org name) and Sign out.
      expect(await screen.findByText('Ubayy')).toBeTruthy();
      expect(screen.getByText('Sign out')).toBeTruthy();
      expect(screen.getByText('Home')).toBeTruthy();
      expect(screen.getByText('Organization')).toBeTruthy();
      expect(screen.getByText('Account')).toBeTruthy();

      // Main content: clear empty state, no org-scoped actions.
      expect(screen.getByText("This account doesn't belong to an organization yet.")).toBeTruthy();
      expect(screen.queryByText('New competition')).toBeNull();
    });

    it('never subscribes to a sentinel/reserved Firestore path', async () => {
      // No users/u1/orgs docs seeded — the exact no-org shape live Firestore hit.
      const { wrapped, paths } = spyBackend(new InMemoryBackend());
      render(
        <DbProvider backend={wrapped}>
          <PortalRoot />
        </DbProvider>,
      );

      // Let effects settle before inspecting what was subscribed.
      expect(await screen.findByText('Ubayy')).toBeTruthy();

      expect(paths.length).toBeGreaterThan(0);
      // Firestore rejects any collection/document id shaped like `__foo__` as
      // reserved — assert no subscription ever built a path containing one,
      // not just the specific '__no_org__' string this bug shipped with.
      for (const path of paths) {
        expect(path).not.toMatch(/__[^/]*__/);
      }
    });
  });
});
