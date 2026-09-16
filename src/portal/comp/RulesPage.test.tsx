// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import type { DbBackend } from '../../data/backend';

// Same import-safety pattern as ScoringPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// AccountFooter isn't rendered here, but RulesPage reads useAuth() directly for
// the writing uid — same auth-mock pattern as CompShell.test.tsx.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'staff1', email: 'staff@ik.org' }, signOut: vi.fn() }),
}));

// writeDoc (src/data/db.ts) always writes straight to the real Firestore SDK — not
// backend-aware, unlike useDocData (which goes through DbProvider's InMemoryBackend).
// Mock it the same way ScoringPage.test.tsx does; useDocData keeps its real impl.
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()) };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { RulesPage } = await import('./RulesPage');
const { writeDoc } = await import('../../data/db');
const writeDocSpy = writeDoc as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  cleanup();
  writeDocSpy.mockClear();
});

const PATH = 'orgs/ik/competitions/2026/config/policies';

/**
 * Wraps a real InMemoryBackend but holds back the very first subscribeDoc
 * delivery for one target path, so a test can observe the `loading: true`
 * window `useDocData` sits in before the doc resolves — same helper as
 * ScoringPage.test.tsx's DelayedDocBackend.
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
  release() {
    this.released = true;
    const cbs = this.pending;
    this.pending = [];
    cbs.forEach((cb) => this.inner.subscribeDoc(this.delayPath, cb));
  }
}

function renderPage(backend: DbBackend) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="ik" compId="2026">
        <RulesPage />
      </TenantProvider>
    </DbProvider>,
  );
}

describe('RulesPage', () => {
  it('gates the form behind the config load — no textarea while config/policies is pending', async () => {
    const inner = new InMemoryBackend();
    inner.seed(PATH, { rulesText: 'No phones on stage.' });
    const backend = new DelayedDocBackend(inner, PATH);

    renderPage(backend);

    expect(screen.getByRole('heading', { name: 'Rules' })).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();

    act(() => backend.release());

    expect(await screen.findByDisplayValue('No phones on stage.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('seeds the textarea with the resolved rulesText', async () => {
    const backend = new InMemoryBackend();
    backend.seed(PATH, { rulesText: 'Existing house rules.' });
    renderPage(backend);

    expect(await screen.findByDisplayValue('Existing house rules.')).toBeTruthy();
  });

  it('edits and saves — writeDoc gets rulesText + updatedBy at config/policies', async () => {
    const backend = new InMemoryBackend();
    backend.seed(PATH, { rulesText: '' });
    renderPage(backend);

    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'No phones on stage.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writeDocSpy).toHaveBeenCalled());
    const [path, payload, merge] = writeDocSpy.mock.calls.at(-1)!;
    expect(path).toBe(PATH);
    expect(payload).toMatchObject({ rulesText: 'No phones on stage.', updatedBy: 'staff1' });
    expect(merge).toBe(false);
  });

  it('shows the explainer telling the organizer what judges see', async () => {
    const backend = new InMemoryBackend();
    backend.seed(PATH, { rulesText: '' });
    renderPage(backend);

    expect(await screen.findByText(/appears word-for-word in the judge app/)).toBeTruthy();
  });
});
