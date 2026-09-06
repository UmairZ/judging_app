// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// CompShell -> ../../data/db -> ../../firebase/app initializes a real Firebase app
// at import time, which needs env config this test environment doesn't have.
// InMemoryBackend never touches db/auth/app, so a bare mock keeps the import safe —
// same pattern as HomePage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));
// AccountFooter (rendered by CompShell's sidebar) reads useAuth() for the
// signed-in user + Sign out — same auth-mock pattern as HomePage.test.tsx.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'umair@humsub.co', displayName: 'Umair' }, signOut: vi.fn() }),
}));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { CompShell } = await import('./CompShell');

afterEach(cleanup);

const SECTION_LABELS = [
  'Overview',
  'Contestants',
  'Categories & Divisions',
  'Judges & Panels',
  'Scoring',
  'Leaderboard',
  'Provisioning',
];

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik', { name: 'Ibn Katheer' });
  backend.seed('orgs/ik/competitions/2026', { name: '2026 Ramadan Contest', status: 'live' });
  return backend;
}

describe('CompShell', () => {
  it('renders every section label, the comp name, the Live badge, and marks the active section current', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <CompShell compId="2026" section="scoring">
            <div>page content</div>
          </CompShell>
        </TenantProvider>
      </DbProvider>,
    );

    // Comp name + status badge.
    expect(await screen.findByText('2026 Ramadan Contest')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();

    // Back-item to the org.
    expect(await screen.findByText('Ibn Katheer')).toBeTruthy();

    // All seven section labels.
    for (const label of SECTION_LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    // The active section (scoring) carries data-current; the others don't.
    const activeLink = screen.getByText('Scoring').closest('[data-current]');
    expect(activeLink).toBeTruthy();
    expect(screen.getByText('Overview').closest('[data-current]')).toBeNull();

    // Children render inside the shell.
    expect(screen.getByText('page content')).toBeTruthy();

    // Account footer — signed-in user + Sign out must stay reachable while
    // inside any competition section, not just at /portal.
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('umair@humsub.co')).toBeTruthy();
  });
});
