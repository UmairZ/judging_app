// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CompShell.test.tsx / OverviewPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// Headless UI's anchored DropdownMenu measures its trigger with ResizeObserver,
// which jsdom does not implement — a no-op stub is enough for these tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

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

    // Default (Registrations) view — the full interactive intake experience:
    // both seeded registrations, their source column, promote status badges,
    // and the Import menu (CSV import now lives behind the dropdown).
    expect(await screen.findByText('Aisha Siddiqua')).toBeTruthy();
    expect(screen.getByText('Yusuf Rahman')).toBeTruthy();
    expect(screen.getByText('Zeffy')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
    expect(screen.getByText('Promoted')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText('Import CSV…')).toBeTruthy();
    expect(screen.getByText('Zeffy integration…')).toBeTruthy();
    // Clicking the CSV item routes to the same hidden file input as before and
    // closes the menu (the open menu marks the rest of the page inert).
    fireEvent.click(screen.getByText('Import CSV…'));

    // Switch to the roster view (the contestant-roster master-detail panel
    // ported from src/admin/Contestants.tsx — and nothing else).
    fireEvent.click(await screen.findByRole('button', { name: 'Contestants' }));

    // Contestant roster panel: one roster row (the seeded contestant doc) +
    // one roster action control ("+ New", from handleNewContestant). The
    // registrations machinery is gone from this tab.
    expect(await screen.findByText('Aisha Siddiqua')).toBeTruthy();
    expect(screen.queryByText('Yusuf Rahman')).toBeNull();
    expect(screen.getByText('1 total')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ New' })).toBeTruthy();
  });

  it('opens the Zeffy integration dialog from the Import menu', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ContestantsPage />
        </TenantProvider>
      </DbProvider>,
    );

    await screen.findByText('Aisha Siddiqua');

    // The Zeffy config is no longer in the tab's top-level flow.
    expect(screen.queryByText('Zeffy event filter')).toBeNull();
    expect(screen.queryByText('Zeffy webhook')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    fireEvent.click(screen.getByText('Zeffy integration…'));

    // Dialog renders both moved sections; the event-filter input is inside it.
    expect(await screen.findByText('Zeffy integration')).toBeTruthy();
    expect(screen.getByText('Zeffy event filter')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. 2026 Ibn Katheer Quran Competition')).toBeTruthy();
    expect(screen.getByText('Zeffy webhook')).toBeTruthy();
  });
});
