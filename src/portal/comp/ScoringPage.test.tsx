// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, cleanup, waitFor, within } from '@testing-library/react';
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

const DOC_PATH = 'orgs/ik/competitions/2026/config/scoring';

function seededBackend(doc: Record<string, unknown> = DEFAULT_SCORING_CONFIG as unknown as Record<string, unknown>) {
  const backend = new InMemoryBackend();
  backend.seed(DOC_PATH, doc);
  return backend;
}

function renderPage(backend: DbBackend) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="ik" compId="2026">
        <ScoringPage />
      </TenantProvider>
    </DbProvider>,
  );
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
  // (f) loading gate + seed-once.
  it('gates the form (and Save) behind the config load, and seeds from the resolved doc — never from defaults', async () => {
    const seededConfig = {
      ...DEFAULT_SCORING_CONFIG,
      percent: { ...DEFAULT_SCORING_CONFIG.percent, weights: { hifz: 55, tajweed: 40, voice: 5 } },
    };
    const inner = new InMemoryBackend();
    inner.seed(DOC_PATH, seededConfig);
    const backend = new DelayedDocBackend(inner, DOC_PATH);

    renderPage(backend);

    // Still loading: heading renders, but the form (incl. Save, and any input) is absent —
    // a click during this window must not be possible, since it would write
    // DEFAULT_SCORING_CONFIG over the real (not-yet-loaded) config.
    expect(screen.getByRole('heading', { name: 'Scoring' })).toBeTruthy();
    expect(screen.getByText('Loading config…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz))).toBeNull();
    expect(screen.queryByDisplayValue(String(seededConfig.percent.weights.hifz))).toBeNull();

    // Doc resolves: the form appears, seeded with the SEEDED config, not the defaults.
    act(() => backend.release());

    expect(await screen.findByDisplayValue(String(seededConfig.percent.weights.hifz))).toBeTruthy();
    expect(screen.queryByText('Loading config…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  // (a) three radio cards render; seeded escalating-v3 shows the third checked.
  it('renders all three scoring-system cards, with the seeded model checked', async () => {
    const backend = seededBackend({ ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' });
    renderPage(backend);
    await screen.findByRole('radio', { name: /raw deductions/i });

    expect(screen.getByText('Raw deductions')).toBeTruthy();
    expect(screen.getByText('Percentage weights')).toBeTruthy();
    expect(screen.getByText('Percentage weights + escalating penalties')).toBeTruthy();

    const radios = screen.getAllByRole('radio');
    const radioFor = (title: string) => radios.find((r) => within(r).queryByText(title));
    expect(radioFor('Raw deductions')?.getAttribute('aria-checked')).toBe('false');
    expect(radioFor('Percentage weights')?.getAttribute('aria-checked')).toBe('false');
    expect(radioFor('Percentage weights + escalating penalties')?.getAttribute('aria-checked')).toBe('true');
  });

  // (b) knob visibility per system.
  it('shows raw knobs and hides weights when Raw deductions is selected', async () => {
    const backend = seededBackend();
    renderPage(backend);
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));

    fireEvent.click(screen.getByRole('radio', { name: /raw deductions/i }));

    expect(screen.getByLabelText('Hesitation cost')).toBeTruthy();
    expect(screen.getByLabelText(/Voice is worth/)).toBeTruthy();
    expect(screen.queryByLabelText('Hifz — memorization')).toBeNull();
    expect(screen.queryByLabelText('Tajweed — recitation')).toBeNull();
  });

  it('shows weights and the = 100 badge, and hides raw-only knobs, when Percentage weights is selected', async () => {
    const backend = seededBackend(); // default model is weighted-v3
    renderPage(backend);
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));

    expect(screen.getByLabelText('Hifz — memorization')).toBeTruthy();
    expect(screen.getByText('= 100 ✓')).toBeTruthy();
    expect(screen.queryByLabelText('Hesitation cost')).toBeNull();
    expect(screen.queryByLabelText('Each repeat costs this many more percentage points')).toBeNull();
  });

  it('shows the escalation-step knob only when escalating is selected', async () => {
    const backend = seededBackend();
    renderPage(backend);
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));

    expect(screen.queryByLabelText('Each repeat costs this many more percentage points')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /escalating penalties/i }));
    expect(screen.getByLabelText('Each repeat costs this many more percentage points')).toBeTruthy();
  });

  // (c) persists both sub-objects without clobbering the untouched one.
  it('persists an edited raw cost alongside the untouched percent config when saving under a different system', async () => {
    const backend = seededBackend();
    renderPage(backend);
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));

    fireEvent.click(screen.getByRole('radio', { name: /raw deductions/i }));
    fireEvent.change(screen.getByLabelText('Prompted cost'), { target: { value: '33' } });

    fireEvent.click(screen.getByRole('radio', { name: /escalating penalties/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writeDocSpy).toHaveBeenCalled());

    const payload = writeDocSpy.mock.calls.at(-1)![1];
    expect(payload).toMatchObject({
      model: 'escalating-v3',
      raw: { ...DEFAULT_SCORING_CONFIG.raw, costs: { ...DEFAULT_SCORING_CONFIG.raw.costs, prompted: 33 } },
      percent: DEFAULT_SCORING_CONFIG.percent,
    });
  });

  // (d) escalating caption computes live.
  it('computes the escalating caption live from the prompted cost and escalation step', async () => {
    const backend = seededBackend();
    renderPage(backend);
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));
    fireEvent.click(screen.getByRole('radio', { name: /escalating penalties/i }));

    // Defaults: prompted = 10, step = 10 → 10% + 20% = 30%.
    expect(screen.getByText(/10% \+ 20% = 30%/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Each repeat costs this many more percentage points'), {
      target: { value: '20' },
    });
    expect(await screen.findByText(/10% \+ 30% = 40%/)).toBeTruthy();
    expect(screen.queryByText(/10% \+ 20% = 30%/)).toBeNull();
  });

  // (e) legacy doc: flagged, seeded from defaults, saves a full valid v3 shape.
  it('flags a legacy doc, seeds the form from defaults, and saves a full v3 shape', async () => {
    const backend = seededBackend({ model: 'deduction-v1', hifz_base: 10 });
    renderPage(backend);

    expect(await screen.findByText(/unknown scoring system "deduction-v1"/)).toBeTruthy();
    expect(await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writeDocSpy).toHaveBeenCalled());
    expect(writeDocSpy.mock.calls.at(-1)![1]).toEqual(DEFAULT_SCORING_CONFIG);
  });

  it('shows a validateScoringConfig error when weights no longer sum to 100', async () => {
    const backend = seededBackend();
    renderPage(backend);

    const hifzInput = (await screen.findByDisplayValue(
      String(DEFAULT_SCORING_CONFIG.percent.weights.hifz),
    )) as HTMLInputElement;
    fireEvent.change(hifzInput, { target: { value: '60' } });

    expect(await screen.findByText('weights must sum to 100 (got 90)')).toBeTruthy();
  });

  // (M2 fix) only the SELECTED system's errors gate Save.
  it('hides a broken-percent-weights error and enables Save after switching to Raw deductions, then re-shows it on switching back', async () => {
    const backend = seededBackend();
    renderPage(backend);

    const hifzInput = (await screen.findByDisplayValue(
      String(DEFAULT_SCORING_CONFIG.percent.weights.hifz),
    )) as HTMLInputElement;
    fireEvent.change(hifzInput, { target: { value: '60' } });
    expect(await screen.findByText('weights must sum to 100 (got 90)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: /raw deductions/i }));

    expect(screen.queryByText('weights must sum to 100 (got 90)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);

    fireEvent.click(screen.getByRole('radio', { name: /each part of the recitation/i }));

    expect(await screen.findByText('weights must sum to 100 (got 90)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
  });

  it('explains the disqualification flag as a per-category mistake limit', async () => {
    const backend = seededBackend();
    renderPage(backend);

    expect(await screen.findByText(/mistake limit/i)).toBeTruthy();
    expect(screen.queryByText(/memorization points hit zero/)).toBeNull();
  });

  it('recomputes the cost caption from the live config when the Prompted cost changes', async () => {
    const backend = seededBackend();
    renderPage(backend);

    // Default: percent.costs.prompted = 10.
    await screen.findByDisplayValue(String(DEFAULT_SCORING_CONFIG.percent.weights.hifz));
    expect(screen.getByText(/One Prompted mistake costs 10% of that question's memorization\./)).toBeTruthy();

    // Change the Prompted cost → the sentence must recompute.
    fireEvent.change(screen.getByLabelText('Prompted cost'), { target: { value: '15' } });
    expect(await screen.findByText(/One Prompted mistake costs 15% of that question's memorization\./)).toBeTruthy();
    expect(screen.queryByText(/One Prompted mistake costs 10% of that question's memorization\./)).toBeNull();
  });
});
