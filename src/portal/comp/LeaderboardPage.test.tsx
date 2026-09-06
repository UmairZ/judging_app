// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

// Same import-safety pattern as ScoringPage.test.tsx / ContestantsPage.test.tsx —
// LeaderboardPage also pulls in GradingScreen and Projector (judge-world
// components, reused untouched), which import '../data/db' the same way.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// writeDoc/removeDoc (src/data/db.ts) write straight to the real Firestore SDK — not
// backend-aware, unlike useDocData/useCollection (which go through DbProvider's
// InMemoryBackend). Mocked the same way ScoringPage.test.tsx does; neither is invoked
// by this render-only test (no button clicks that trigger a write).
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()), removeDoc: vi.fn(() => Promise.resolve()) };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { LeaderboardPage } = await import('./LeaderboardPage');

afterEach(cleanup);

/**
 * Seeds structure config's default category '1' / division 'brothers' slot
 * (the DEFAULT_STRUCTURE_CONFIG's first generateSlots() entry, i.e. `sel = 0`)
 * with two contestants + enrollments + one finalized session each, scored
 * differently so compareForLeaderboard has a real order to compute:
 * Amina (no deductions, full voice) outscores Bilal (one prompted-failed
 * deduction, lower voice).
 */
function seededBackend() {
  const backend = new InMemoryBackend();
  const base = 'orgs/ik/competitions/2026';

  backend.seed(`${base}/contestants/c1`, {
    fullName: 'Amina Noor', gender: 'female', photoUrl: null, registrationId: null, fields: {}, active: true,
  });
  backend.seed(`${base}/contestants/c2`, {
    fullName: 'Bilal Omar', gender: 'male', photoUrl: null, registrationId: null, fields: {}, active: true,
  });
  backend.seed(`${base}/enrollments/c1_1`, { contestantId: 'c1', category: '1', division: 'brothers', round: 'main' });
  backend.seed(`${base}/enrollments/c2_1`, { contestantId: 'c2', category: '1', division: 'brothers', round: 'main' });

  backend.seed(`${base}/sessions/c1_1__j1`, {
    enrollmentId: 'c1_1', judgeId: 'j1',
    questions: [{ index: 0, events: [], voice: 5, disqualified: false }],
    finalizedAt: 1,
    updatedAt: 1,
  });
  backend.seed(`${base}/sessions/c2_1__j1`, {
    enrollmentId: 'c2_1', judgeId: 'j1',
    questions: [{ index: 0, events: [{ type: 'prompted_failed' }], voice: 3, disqualified: false }],
    finalizedAt: 1,
    updatedAt: 1,
  });

  return backend;
}

describe('LeaderboardPage', () => {
  it('renders the heading, both names, ranked per the scoring comparator, and the Projector button', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <LeaderboardPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Live Leaderboard' })).toBeTruthy();
    expect(await screen.findByText('Amina Noor')).toBeTruthy();
    expect(screen.getByText('Bilal Omar')).toBeTruthy();

    // Rank order: Amina (100) outscores Bilal (84) under DEFAULT_SCORING_CONFIG —
    // her data row must precede his.
    const rows = screen.getAllByRole('row');
    const aminaRowIdx = rows.findIndex((r) => within(r).queryByText('Amina Noor'));
    const bilalRowIdx = rows.findIndex((r) => within(r).queryByText('Bilal Omar'));
    expect(aminaRowIdx).toBeGreaterThan(-1);
    expect(bilalRowIdx).toBeGreaterThan(-1);
    expect(aminaRowIdx).toBeLessThan(bilalRowIdx);

    expect(screen.getByRole('button', { name: /Projector mode/ })).toBeTruthy();
  });
});
