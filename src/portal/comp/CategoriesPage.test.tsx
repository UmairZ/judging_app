// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Same import-safety pattern as CompShell.test.tsx / ContestantsPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { CategoriesPage } = await import('./CategoriesPage');

afterEach(cleanup);

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
});
