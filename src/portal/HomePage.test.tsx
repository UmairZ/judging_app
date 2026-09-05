// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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
});
