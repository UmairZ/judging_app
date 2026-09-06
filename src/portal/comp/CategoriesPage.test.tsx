// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import type { DbBackend } from '../../data/backend';

// Same import-safety pattern as CompShell.test.tsx / ContestantsPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// writeDoc (src/data/db.ts) always writes straight to the real Firestore SDK — it is
// NOT backend-aware, unlike useDocData/useCollection (which go through DbProvider's
// InMemoryBackend). Save Structure's actual persisted payload can only be observed by
// spying on writeDoc itself; letting the real one run against the `{}` firebase/app
// mock throws. useDocData/useCollection keep their real (backend-aware) implementation.
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()) };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { CategoriesPage } = await import('./CategoriesPage');
const { writeDoc } = await import('../../data/db');
const writeDocMock = vi.mocked(writeDoc);

afterEach(() => {
  cleanup();
  writeDocMock.mockClear();
});

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/config/structure', {
    divisions: [
      { id: 'brothers', label: 'Brothers' },
      { id: 'sisters', label: 'Sisters' },
    ],
    categories: [
      { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers', 'sisters'], zeffyLabels: ['1 Juz'] },
      { id: '5', label: "5 Ajza'", minQuestions: 4, divisions: ['brothers'], zeffyLabels: ['5 Juz'] },
    ],
  });
  return backend;
}

function renderPage(backend: InstanceType<typeof InMemoryBackend> | DbBackend) {
  return render(
    <DbProvider backend={backend as DbBackend}>
      <TenantProvider orgId="ik" compId="2026">
        <CategoriesPage />
      </TenantProvider>
    </DbProvider>,
  );
}

/** The persisted structure payload, as captured from the last Save Structure click. */
type SavedPayload = {
  divisions: { id: string; label: string }[];
  categories: { id: string; label: string; divisions: string[] }[];
};

async function saveAndGetPayload(): Promise<SavedPayload> {
  fireEvent.click(screen.getByRole('button', { name: 'Save Structure' }));
  await screen.findByText('✓ Saved');
  return writeDocMock.mock.calls.at(-1)?.[1] as SavedPayload;
}

/** Copied from ScoringPage.test.tsx: wraps a real InMemoryBackend but holds
 * back the very first subscribeDoc delivery for one target path, so a test can
 * observe the `loading: true` window `useDocData` sits in before the doc
 * resolves — InMemoryBackend itself calls back synchronously. */
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

describe('CategoriesPage', () => {
  it('renders the heading, both seeded categories in the list, and selecting one shows its fields', async () => {
    renderPage(seededBackend());

    expect(screen.getByRole('heading', { name: 'Categories & divisions' })).toBeTruthy();

    // Both categories appear as list rows; the first is selected by default,
    // so its editable fields (name input) are in the detail panel.
    expect(await screen.findByDisplayValue("1 Juz'")).toBeTruthy();
    expect(screen.getByRole('button', { name: /5 Ajza'/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy();

    // Selecting the second category swaps the detail panel to its fields.
    fireEvent.click(screen.getByRole('button', { name: /5 Ajza'/ }));
    expect(screen.getByDisplayValue("5 Ajza'")).toBeTruthy();
    expect(screen.queryByDisplayValue("1 Juz'")).toBeNull();
  });

  it('renders fine with no config/structure doc (falls back to the default structure)', async () => {
    renderPage(new InMemoryBackend());

    expect(screen.getByRole('heading', { name: 'Categories & divisions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy();
  });

  it('selecting an existing pool division in the reuse Select references it — no pool growth', async () => {
    renderPage(seededBackend());
    await screen.findByDisplayValue("1 Juz'");

    // 5 Ajza' references only brothers; the pool already holds Sisters, so the
    // reuse Select offers it.
    fireEvent.click(screen.getByRole('button', { name: /5 Ajza'/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Add a division' }), { target: { value: 'sisters' } });

    // Every pool division is now referenced — the Select gives way to the name input.
    expect(screen.queryByRole('combobox', { name: 'Add a division' })).toBeNull();
    expect(screen.getByPlaceholderText('Division name')).toBeTruthy();

    const payload = await saveAndGetPayload();
    expect(payload.divisions).toHaveLength(2); // referenced, not duplicated
    expect(payload.categories.find((c) => c.id === '5')?.divisions).toEqual(['brothers', 'sisters']);
  });

  it('"New division…" reveals the name input, and a blank/whitespace add still changes nothing', async () => {
    renderPage(seededBackend());
    await screen.findByDisplayValue("1 Juz'");

    // 5 Ajza' has an unreferenced pool division, so the Select shows first —
    // the name input only appears through the "New division…" fallback.
    fireEvent.click(screen.getByRole('button', { name: /5 Ajza'/ }));
    expect(screen.queryByPlaceholderText('Division name')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Add a division' }), { target: { value: '__new-division__' } });

    fireEvent.change(screen.getByPlaceholderText('Division name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add division' }));

    const payload = await saveAndGetPayload();
    expect(payload.divisions).toHaveLength(2);
    expect(payload.categories.find((c) => c.id === '5')?.divisions).toEqual(['brothers']);

    // Cancel hides the input again and brings the Select back.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('Division name')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Add a division' })).toBeTruthy();
  });

  it('typing an EXISTING pool label in the create fallback references it — no duplicate entry (safety path)', async () => {
    renderPage(seededBackend());
    await screen.findByDisplayValue("1 Juz'");

    fireEvent.click(screen.getByRole('button', { name: /5 Ajza'/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Add a division' }), { target: { value: '__new-division__' } });
    fireEvent.change(screen.getByPlaceholderText('Division name'), { target: { value: '  Sisters  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add division' }));

    const payload = await saveAndGetPayload();
    expect(payload.divisions).toHaveLength(2); // pool gained no duplicate
    expect(payload.categories.find((c) => c.id === '5')?.divisions).toEqual(['brothers', 'sisters']);
  });

  it('with no unreferenced pool divisions the name input shows directly, and a new unique name grows the pool + references it', async () => {
    renderPage(seededBackend());
    await screen.findByDisplayValue("1 Juz'");

    // 1 Juz' already references every pool division — nothing to reuse, so the
    // Select is skipped and the name input renders directly (no Cancel either).
    expect(screen.queryByRole('combobox', { name: 'Add a division' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Division name'), { target: { value: 'Combined' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add division' }));

    const payload = await saveAndGetPayload();
    expect(payload.divisions).toHaveLength(3);
    const combined = payload.divisions.find((d) => d.label === 'Combined');
    expect(combined).toBeTruthy();
    expect(payload.categories.find((c) => c.id === '1')?.divisions).toEqual(['brothers', 'sisters', combined?.id]);
  });

  it('removing a division from one category leaves the other category and the pool untouched', async () => {
    renderPage(seededBackend());
    await screen.findByDisplayValue("1 Juz'");

    // Divisions render as pills with per-division ×-buttons carrying an
    // accessible "Remove {label}" name.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Brothers' }));

    const payload = await saveAndGetPayload();
    expect(payload.categories.find((c) => c.id === '1')?.divisions).toEqual(['sisters']);
    expect(payload.categories.find((c) => c.id === '5')?.divisions).toEqual(['brothers']); // other category keeps its ref
    expect(payload.divisions.map((d) => d.id)).toEqual(['brothers', 'sisters']); // pool entry deliberately kept
  });

  it('gates the form (and Save) behind the config load, and seeds from the resolved doc — never from defaults', async () => {
    const path = 'orgs/ik/competitions/2026/config/structure';
    const inner = new InMemoryBackend();
    inner.seed(path, {
      divisions: [{ id: 'brothers', label: 'Brothers' }],
      categories: [{ id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers'], zeffyLabels: ['1 Juz'] }],
    });
    const backend = new DelayedDocBackend(inner, path);

    renderPage(backend);

    // Still loading: heading renders, but the form (incl. Save, and any input) is
    // absent — a click during this window must not be possible, since it would
    // write DEFAULT_STRUCTURE_CONFIG over the real (not-yet-loaded) config
    // (merge: false).
    expect(screen.getByRole('heading', { name: 'Categories & divisions' })).toBeTruthy();
    expect(screen.getByText('Loading structure…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Structure' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByDisplayValue("1 Juz'")).toBeNull();

    // Doc resolves: the form appears, seeded with the SEEDED config, not the defaults.
    act(() => backend.release());

    expect(await screen.findByDisplayValue("1 Juz'")).toBeTruthy();
    expect(screen.queryByText('Loading structure…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save Structure' })).toBeTruthy();
    expect(screen.getByText('Brothers')).toBeTruthy(); // seeded division row, not the 3-division default pool
  });
});
