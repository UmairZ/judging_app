// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CategoriesPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// writeDoc (src/data/db.ts) always writes straight to the real Firestore SDK — it is
// NOT backend-aware, unlike useDocData/useCollection (which go through DbProvider's
// InMemoryBackend). Mock it the same way CategoriesPage.test.tsx does; useDocData keeps
// its real (backend-aware) implementation.
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()) };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { ScoringPage } = await import('./ScoringPage');
const { DEFAULT_SCORING_CONFIG } = await import('../../scoring');

afterEach(() => {
  cleanup();
});

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/config/scoring', DEFAULT_SCORING_CONFIG);
  return backend;
}

describe('ScoringPage', () => {
  it('renders the heading and a weights field with the seeded value', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Scoring config' })).toBeTruthy();
    expect(await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz))).toBeTruthy();
  });

  it('shows a validateScoringConfig error when weights no longer sum to 100', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    const hifzInput = (await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz))) as HTMLInputElement;
    fireEvent.change(hifzInput, { target: { value: '60' } });

    expect(await screen.findByText('weights must sum to 100 (got 90)')).toBeTruthy();
  });
});
