// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as JudgesPage.test.tsx / CategoriesPage.test.tsx —
// ProvisioningPage imports firebase/functions + firebase/app (mintJudgeToken,
// removeMember) but never calls them during render, only from click handlers.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { ProvisioningPage } = await import('./ProvisioningPage');

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/judges/j1', { name: 'Amina Yusuf', active: true });
  backend.seed('orgs/ik/competitions/2026/judges/j2', { name: 'Bilal Karim', active: true });
  // One join-code doc, per Devices.tsx's JoinCodeDoc shape.
  backend.seed('orgs/ik/competitions/2026/joinCodes/ABC123', {
    role: 'judge',
    judgeId: 'j1',
    redeemedBy: null,
    createdAt: null,
  });
  return backend;
}

describe('ProvisioningPage', () => {
  it('renders the heading, one join-code row, and the "What the judge sees" frame', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ProvisioningPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Provisioning' })).toBeTruthy();

    // The seeded join code renders as one code row (Amina's row shows the code;
    // Bilal has none yet, so he still gets a "Generate code" button instead).
    expect(await screen.findByText('ABC123')).toBeTruthy();
    expect(screen.getAllByText('Generate code').length).toBeGreaterThan(0);

    // The boundary frame — judge hand-off framing, spec-mandated on this page only.
    expect(screen.getByText('What the judge sees')).toBeTruthy();
    expect(
      screen.getByText('Judges get the branded competition-day experience from here on.'),
    ).toBeTruthy();
  });
});
