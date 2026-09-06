// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CompShell.test.tsx / HomePage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { OverviewPage } = await import('./OverviewPage');

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026', { name: '2026 Ramadan Contest', status: 'live' });
  backend.seed('orgs/ik/competitions/2026/registrations/r1', { name: 'A' });
  backend.seed('orgs/ik/competitions/2026/registrations/r2', { name: 'B' });
  backend.seed('orgs/ik/competitions/2026/registrations/r3', { name: 'C' });
  backend.seed('orgs/ik/competitions/2026/sessions/s1', { finalizedAt: 111 });
  backend.seed('orgs/ik/competitions/2026/judges/j1', {});
  backend.seed('orgs/ik/competitions/2026/judges/j2', {});
  backend.seed('orgs/ik/competitions/2026/judges/j3', {});
  backend.seed('orgs/ik/competitions/2026/judges/j4', {});
  backend.seed('orgs/ik/competitions/2026/config/structure', {
    categories: [
      { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers'] },
      { id: '5', label: "5 Ajzā'", minQuestions: 4, divisions: ['brothers'] },
    ],
  });
  return backend;
}

describe('OverviewPage', () => {
  it('renders the comp name/status, the judge-welcome door, live stats, and quick facts', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <OverviewPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(await screen.findByText('2026 Ramadan Contest')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();

    const link = screen.getByText('Open judge welcome').closest('a');
    expect(link?.getAttribute('href')).toBe('/ik/2026');
    expect(link?.getAttribute('target')).toBe('_blank');

    expect(screen.getByText('Registrations')).toBeTruthy();
    expect(screen.getByText('Sessions graded')).toBeTruthy();
    expect(screen.getByText('Judges')).toBeTruthy();
    expect(await screen.findByText('3')).toBeTruthy(); // registrations
    expect(await screen.findByText('1')).toBeTruthy(); // sessions graded
    expect(await screen.findByText('4')).toBeTruthy(); // judges

    expect(await screen.findByText('Minimum questions')).toBeTruthy();
    expect(screen.getByText('3–4')).toBeTruthy();
  });
});
