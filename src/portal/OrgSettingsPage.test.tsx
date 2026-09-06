// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as HomePage.test.tsx.
vi.mock('../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'x@y.z' }, signOut: vi.fn() }),
}));

const { InMemoryBackend, DbProvider } = await import('../data/backend');
const { OrgSettingsPage } = await import('./OrgSettingsPage');

afterEach(cleanup);

describe('OrgSettingsPage', () => {
  it('seeds the name input from the resolved org mirror (not the pre-subscription empty state) and stays editable', async () => {
    const backend = new InMemoryBackend();
    backend.seed('users/u1/orgs/ik', { role: 'owner', name: 'Ibn Katheer' });

    render(
      <DbProvider backend={backend}>
        <OrgSettingsPage />
      </DbProvider>,
    );

    // The subscription resolves after first render — the input must re-seed to
    // the current org name, not stay stuck on the '' the initial render saw.
    const input = (await screen.findByDisplayValue('Ibn Katheer')) as HTMLInputElement;
    expect(input.value).toBe('Ibn Katheer');

    // Still editable after seeding.
    fireEvent.change(input, { target: { value: 'Renamed Org' } });
    expect(input.value).toBe('Renamed Org');
  });

  it('shows the no-org empty state when the account has no org mirror', async () => {
    const backend = new InMemoryBackend();
    render(
      <DbProvider backend={backend}>
        <OrgSettingsPage />
      </DbProvider>,
    );

    expect(await screen.findByText("This account doesn't belong to an organization yet.")).toBeTruthy();
  });
});
