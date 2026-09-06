// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

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

describe('CategoriesPage', () => {
  it('renders the heading and both seeded category rows, plus an add-category control', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <CategoriesPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Categories & divisions' })).toBeTruthy();

    expect(await screen.findByDisplayValue("1 Juz'")).toBeTruthy();
    expect(screen.getByDisplayValue("5 Ajza'")).toBeTruthy();

    expect(screen.getByRole('button', { name: '+ Add category' })).toBeTruthy();
  });

  it('renders fine with no config/structure doc (falls back to the default structure)', async () => {
    const backend = new InMemoryBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <CategoriesPage />
        </TenantProvider>
      </DbProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Categories & divisions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Add category' })).toBeTruthy();
  });

  it('never commits a blank/whitespace division label, and commits the trimmed value otherwise', async () => {
    const backend = seededBackend();
    render(
      <DbProvider backend={backend}>
        <TenantProvider orgId="ik" compId="2026">
          <CategoriesPage />
        </TenantProvider>
      </DbProvider>,
    );

    const input = (await screen.findByDisplayValue('Brothers')) as HTMLInputElement;
    const saveBtn = screen.getByRole('button', { name: 'Save Structure' });

    // Whitespace-only: blur reverts the input (edited.divisions is untouched), and a
    // subsequent save persists the prior label unchanged.
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(input.value).toBe('Brothers');

    fireEvent.click(saveBtn);
    await screen.findByText('✓ Saved');
    const firstWrite = writeDocMock.mock.calls.at(-1)?.[1] as { divisions: { id: string; label: string }[] };
    expect(firstWrite.divisions.find((d) => d.id === 'brothers')?.label).toBe('Brothers');

    // Padded text: blur commits the TRIMMED value, and save persists that.
    fireEvent.change(input, { target: { value: '  Siblings  ' } });
    fireEvent.blur(input);
    expect(input.value).toBe('Siblings');

    fireEvent.click(saveBtn);
    await screen.findByText('✓ Saved');
    const secondWrite = writeDocMock.mock.calls.at(-1)?.[1] as { divisions: { id: string; label: string }[] };
    expect(secondWrite.divisions.find((d) => d.id === 'brothers')?.label).toBe('Siblings');
  });
});
