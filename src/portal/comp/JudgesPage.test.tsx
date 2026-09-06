// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CategoriesPage.test.tsx / ContestantsPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { JudgesPage } = await import('./JudgesPage');

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/judges/j1', { name: 'Amina Yusuf', active: true });
  backend.seed('orgs/ik/competitions/2026/judges/j2', { name: 'Bilal Karim', active: false });
  backend.seed('orgs/ik/competitions/2026/panels/p1', { name: 'Panel A', judgeIds: ['j1'] });
  return backend;
}

describe('JudgesPage', () => {
  it('renders the heading, both seeded judge names, and the seeded panel name', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <JudgesPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Judges & panels' })).toBeTruthy();

    expect(await screen.findByDisplayValue('Amina Yusuf')).toBeTruthy();
    expect(screen.getByDisplayValue('Bilal Karim')).toBeTruthy();
    expect(screen.getByDisplayValue('Panel A')).toBeTruthy();
  });

  it('opens a confirm Dialog before removing a judge (window.confirm -> Dialog)', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <JudgesPage />
        </TenantProvider>
      </DbProvider>,
    );

    await screen.findByDisplayValue('Amina Yusuf');

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeButtons[0]);

    expect(await screen.findByText('Remove this judge?')).toBeTruthy();
  });
});
