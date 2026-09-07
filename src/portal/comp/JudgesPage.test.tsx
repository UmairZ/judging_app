// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CategoriesPage.test.tsx / ContestantsPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// writeDoc (src/data/db.ts) always writes straight to the real Firestore SDK — it is
// NOT backend-aware (unlike useDocData/useCollection). Rename commits and addJudge
// writes can only be observed by spying on writeDoc itself; letting the real one run
// against the `{}` firebase/app mock throws.
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()) };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { JudgesPage } = await import('./JudgesPage');
const { writeDoc } = await import('../../data/db');
const writeDocMock = vi.mocked(writeDoc);

afterEach(() => {
  cleanup();
  writeDocMock.mockClear();
});

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('orgs/ik/competitions/2026/judges/j1', { name: 'Amina Yusuf', active: true });
  backend.seed('orgs/ik/competitions/2026/judges/j2', { name: 'Bilal Karim', active: false });
  backend.seed('orgs/ik/competitions/2026/panels/p1', { name: 'Panel A', judgeIds: ['j1'] });
  return backend;
}

function renderPage(backend = seededBackend()) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="ik" compId="2026">
        <JudgesPage />
      </TenantProvider>
    </DbProvider>,
  );
}

describe('JudgesPage', () => {
  it('renders judge and panel names as TEXT (click-to-edit), not permanent inputs', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Judges & panels' })).toBeTruthy();

    // Names are text now — no input pre-filled with a persisted name.
    expect(await screen.findByText('Amina Yusuf')).toBeTruthy();
    expect(screen.getByText('Bilal Karim')).toBeTruthy();
    expect(screen.getByText('Panel A')).toBeTruthy();
    expect(screen.queryByDisplayValue('Amina Yusuf')).toBeNull();
    expect(screen.queryByDisplayValue('Panel A')).toBeNull();
  });

  it('puts the Panels & assignment section ABOVE the Judges roster', async () => {
    renderPage();
    await screen.findByText('Amina Yusuf');

    const panelsHeading = screen.getByRole('heading', { name: 'Panels & assignment' });
    const judgesHeading = screen.getByRole('heading', { name: 'Judges' });
    // DOCUMENT_POSITION_FOLLOWING (4): judgesHeading comes after panelsHeading.
    expect(panelsHeading.compareDocumentPosition(judgesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows NO active/inactive indicator for judges (state without a function)', async () => {
    renderPage();
    await screen.findByText('Amina Yusuf');

    expect(screen.queryByTitle('Active')).toBeNull();
    expect(screen.queryByTitle('Inactive')).toBeNull();
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.queryByText('Inactive')).toBeNull();
  });

  it('panel name: pencil reveals the input, change + blur commits via the existing rename write', async () => {
    renderPage();
    await screen.findByText('Panel A');

    fireEvent.click(screen.getByRole('button', { name: 'Rename Panel A' }));
    const input = screen.getByRole('textbox', { name: 'Panel name' });
    fireEvent.change(input, { target: { value: '  Panel Alpha  ' } });
    fireEvent.blur(input);

    expect(writeDocMock).toHaveBeenCalledWith('orgs/ik/competitions/2026/panels/p1', { name: 'Panel Alpha' }, true);
    // Input gives way to text again (name still Panel A — writeDoc is mocked).
    expect(screen.queryByRole('textbox', { name: 'Panel name' })).toBeNull();
  });

  it('panel name: Enter commits, Escape reverts without a write', async () => {
    renderPage();
    await screen.findByText('Panel A');

    // Escape: draft dropped, no write.
    fireEvent.click(screen.getByRole('button', { name: 'Rename Panel A' }));
    let input = screen.getByRole('textbox', { name: 'Panel name' });
    fireEvent.change(input, { target: { value: 'Discarded' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(writeDocMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Panel name' })).toBeNull();

    // Enter: commits.
    fireEvent.click(screen.getByRole('button', { name: 'Rename Panel A' }));
    input = screen.getByRole('textbox', { name: 'Panel name' });
    fireEvent.change(input, { target: { value: 'Panel B' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(writeDocMock).toHaveBeenCalledWith('orgs/ik/competitions/2026/panels/p1', { name: 'Panel B' }, true);
  });

  it('judge name: pencil → input → change + blur commits via the existing rename write', async () => {
    renderPage();
    await screen.findByText('Amina Yusuf');

    fireEvent.click(screen.getByRole('button', { name: 'Rename Amina Yusuf' }));
    const input = screen.getByRole('textbox', { name: 'Judge name' });
    fireEvent.change(input, { target: { value: 'Amina Y.' } });
    fireEvent.blur(input);

    expect(writeDocMock).toHaveBeenCalledWith('orgs/ik/competitions/2026/judges/j1', { name: 'Amina Y.' }, true);
    expect(screen.queryByRole('textbox', { name: 'Judge name' })).toBeNull();
  });

  it('opens a confirm Dialog from the judge pill × before removing (window.confirm -> Dialog)', async () => {
    renderPage();
    await screen.findByText('Amina Yusuf');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Amina Yusuf' }));

    expect(await screen.findByText('Remove this judge?')).toBeTruthy();
  });

  it('opens a confirm Dialog from the row × before deleting a panel', async () => {
    renderPage();
    await screen.findByText('Panel A');

    fireEvent.click(screen.getByRole('button', { name: 'Delete panel' }));

    expect(await screen.findByText('Delete this panel?')).toBeTruthy();
  });

  it('adds a judge with the unchanged write shape (active: true persists, just not displayed)', async () => {
    renderPage();
    await screen.findByText('Amina Yusuf');

    fireEvent.change(screen.getByRole('textbox', { name: 'Add judge' }), { target: { value: 'Chandra Devi' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    const call = writeDocMock.mock.calls.at(-1);
    expect(call?.[0]).toMatch(/^orgs\/ik\/competitions\/2026\/judges\//);
    expect(call?.[1]).toEqual({ name: 'Chandra Devi', active: true });
  });

  it('renders a ✓ badge for an assigned slot cell and a faint — for unassigned ones', async () => {
    const backend = seededBackend();
    // Default structure config yields 6 slots; assign one to the seeded panel.
    backend.seed('orgs/ik/competitions/2026/assignments/1_brothers', { category: '1', division: 'brothers', panelId: 'p1' });
    renderPage(backend);

    expect(await screen.findByText('✓')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(5);
  });
});
