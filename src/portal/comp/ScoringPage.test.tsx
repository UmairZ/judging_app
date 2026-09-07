// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import type { DbBackend } from '../../data/backend';

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
const { writeDoc } = await import('../../data/db');
const writeDocSpy = writeDoc as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  writeDocSpy.mockClear();
});

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/config/scoring', DEFAULT_SCORING_CONFIG);
  return backend;
}

/**
 * Wraps a real InMemoryBackend but holds back the very first subscribeDoc
 * delivery for one target path, so a test can observe the `loading: true`
 * window `useDocData` sits in before the doc resolves — InMemoryBackend
 * itself calls back synchronously, which never gives Task 10's review
 * finding (the dropped loading gate) anywhere to manifest.
 */
type DocCb = Parameters<DbBackend['subscribeDoc']>[1];

class DelayedDocBackend implements DbBackend {
  readonly kind = 'demo' as const;
  private pending: DocCb[] = [];
  private released = false;
  constructor(
    private inner: InstanceType<typeof InMemoryBackend>,
    private delayPath: string,
  ) {}
  subscribeDoc(path: string, cb: DocCb) {
    if (path === this.delayPath && !this.released) {
      this.pending.push(cb);
      return () => {
        this.pending = this.pending.filter((c) => c !== cb);
      };
    }
    return this.inner.subscribeDoc(path, cb);
  }
  subscribeCollection(...args: Parameters<DbBackend['subscribeCollection']>) {
    return this.inner.subscribeCollection(...args);
  }
  write(...args: Parameters<DbBackend['write']>) {
    return this.inner.write(...args);
  }
  count(...args: Parameters<DbBackend['count']>) {
    return this.inner.count(...args);
  }
  /** Let the held-back subscription resolve, as if the fetch just completed. */
  release() {
    this.released = true;
    const cbs = this.pending;
    this.pending = [];
    cbs.forEach((cb) => this.inner.subscribeDoc(this.delayPath, cb));
  }
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

    expect(screen.getByRole('heading', { name: 'Scoring' })).toBeTruthy();
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

  it('gates the form (and Save) behind the config load, and seeds from the resolved doc — never from defaults', async () => {
    const path = 'orgs/ik/competitions/2026/config/scoring';
    const seededConfig = { ...DEFAULT_SCORING_CONFIG, weights: { hifz: 55, tajweed: 40, voice: 5 } };
    const inner = new InMemoryBackend();
    inner.seed(path, seededConfig);
    const backend = new DelayedDocBackend(inner, path);

    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    // Still loading: heading renders, but the form (incl. Save, and any input) is absent —
    // a click during this window must not be possible, since it would write
    // DEFAULT_SCORING_CONFIG over the real (not-yet-loaded) config.
    expect(screen.getByRole('heading', { name: 'Scoring' })).toBeTruthy();
    expect(screen.getByText('Loading config…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz))).toBeNull();
    expect(screen.queryByDisplayValue(String(seededConfig.weights.hifz))).toBeNull();

    // Doc resolves: the form appears, seeded with the SEEDED config, not the defaults.
    act(() => backend.release());

    expect(await screen.findByDisplayValue(String(seededConfig.weights.hifz))).toBeTruthy();
    expect(screen.queryByText('Loading config…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('selects escalating penalties and persists the model on save', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz));

    fireEvent.click(await screen.findByText('Escalating penalties'));
    expect(screen.getByRole('radio', { name: /escalating penalties/i }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writeDocSpy).toHaveBeenCalled());
    expect(writeDocSpy.mock.calls.at(-1)![1]).toMatchObject({ model: 'escalating-v2' });
  });

  it('shows the escalation caption only when v2 is selected', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz));

    expect(screen.queryByText(/costs one more point than the last/)).toBeNull();
    fireEvent.click(await screen.findByText('Escalating penalties'));
    expect(screen.getByText(/costs one more point than the last/)).toBeTruthy();
  });

  it('surfaces an unknown-model error from a hand-edited doc', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/ik/competitions/2026/config/scoring', { ...DEFAULT_SCORING_CONFIG, model: 'bogus-v9' });
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(await screen.findByText(/unknown scoring system/)).toBeTruthy();
  });

  it('explains the disqualification flag as a per-category mistake limit', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(await screen.findByText(/mistake limit/i)).toBeTruthy();
    expect(screen.queryByText(/memorization points hit zero/)).toBeNull();
  });

  it('recomputes the cost caption from the live config when a weight changes', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <ScoringPage />
        </TenantProvider>
      </DbProvider>,
    );

    // Defaults: hifz weight 70, prompted cost 1, rail 10 → round(70·1/10) = 7.
    const hifzInput = (await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.weights.hifz))) as HTMLInputElement;
    expect(screen.getByText(/one Prompted mistake ≈ 7 off the final 100/)).toBeTruthy();

    // Change the hifz weight → the example must recompute: round(60·1/10) = 6.
    fireEvent.change(hifzInput, { target: { value: '60' } });
    expect(await screen.findByText(/one Prompted mistake ≈ 6 off the final 100/)).toBeTruthy();
    expect(screen.queryByText(/one Prompted mistake ≈ 7 off the final 100/)).toBeNull();
  });
});
