// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CompShell.test.tsx / OverviewPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { ContestantsPage } = await import('./ContestantsPage');

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  // A promoted registration — a matching contestant doc already exists ("with slot").
  backend.seed('orgs/ik/competitions/2026/registrations/r1', {
    source: 'manual',
    zeffyPaymentId: null,
    zeffyItemId: null,
    kind: 'ticket',
    buyer: {},
    rawItem: {},
    parsedFields: { fullName: 'Aisha Siddiqua', categories: ['1'] },
    paymentStatus: 'n/a',
    createdAt: 1000,
    promotedContestantId: null,
  });
  backend.seed('orgs/ik/competitions/2026/contestants/c1', {
    fullName: 'Aisha Siddiqua',
    gender: 'female',
    photoUrl: null,
    registrationId: 'r1',
    fields: {},
    active: true,
  });
  // A pending Zeffy registration — no contestant doc yet ("without slot").
  backend.seed('orgs/ik/competitions/2026/registrations/r2', {
    source: 'zeffy',
    zeffyPaymentId: 'pay1',
    zeffyItemId: 'item1',
    kind: 'ticket',
    buyer: {},
    rawItem: {},
    parsedFields: { fullName: 'Yusuf Rahman', categories: ['5'] },
    paymentStatus: 'paid',
    createdAt: 2000,
    promotedContestantId: null,
  });
  return backend;
}

describe('ContestantsPage', () => {
  it('renders the heading, both tabs, and a seeded name in each view', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ContestantsPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Contestants' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registrations' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contestants' })).toBeTruthy();

    // Default (ledger) view — read-only, both registrations show up.
    expect(await screen.findByText('Aisha Siddiqua')).toBeTruthy();
    expect(screen.getByText('Yusuf Rahman')).toBeTruthy();
    expect(screen.getByText('Zeffy')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();

    // Switch to the roster view (promote-registrations table + the full
    // contestant-roster management panel ported from src/admin/Contestants.tsx).
    fireEvent.click(screen.getByRole('button', { name: 'Contestants' }));

    // "Aisha Siddiqua" now legitimately renders twice — once as a row in the
    // promote-registrations table (already Promoted), once as her own entry
    // in the contestant-roster list below it.
    expect(await screen.findAllByText('Aisha Siddiqua')).toHaveLength(2);
    expect(screen.getByText('Yusuf Rahman')).toBeTruthy();
    expect(screen.getByText('Promoted')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();

    // Contestant roster panel: one roster row (the seeded contestant doc,
    // read from tp('contestants') same as the promote table) + one roster
    // action control ("+ New", from Contestants.tsx's handleNewContestant).
    expect(screen.getByText('1 total')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New' })).toBeTruthy();
  });
});
