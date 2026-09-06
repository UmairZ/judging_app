// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// Same import-safety + auth-mock pattern as HomePage.test.tsx: InMemoryBackend
// never touches db/auth/app, so bare mocks keep the imports safe.
vi.mock('../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'x@y.z' }, signOut: vi.fn() }),
}));

const { InMemoryBackend, DbProvider } = await import('../data/backend');
const { PortalRoot } = await import('./PortalRoot');
const { DEFAULT_SCORING_CONFIG } = await import('../scoring');

beforeEach(() => {
  // jsdom's scrollTo is "not implemented" — stub it so usePortalPath's
  // scroll-to-top on navigation is a silent no-op here.
  window.scrollTo = vi.fn();
});

afterEach(cleanup);

function seededBackend() {
  const backend = new InMemoryBackend();
  backend.seed('users/u1/orgs/ik', { role: 'owner', name: 'Ibn Katheer' });
  backend.seed('orgs/ik', { name: 'Ibn Katheer' });
  backend.seed('orgs/ik/competitions/2026', { name: '2026 Ramadan Contest', status: 'live' });
  backend.seed('orgs/ik/competitions/2026/config/scoring', DEFAULT_SCORING_CONFIG);
  return backend;
}

describe('portal client-side router (PortalRoot + vendor Link + nav)', () => {
  it('swaps comp sections in place on a sidebar click — history entry pushed, no document load', async () => {
    window.history.replaceState({}, '', '/portal/c/2026');
    const pushSpy = vi.spyOn(window.history, 'pushState');

    render(
      <DbProvider backend={seededBackend()}>
        <PortalRoot />
      </DbProvider>,
    );

    // Overview section renders first (comp name doubles as its heading, and
    // also appears in the sidebar header — hence findAll).
    expect((await screen.findAllByText('2026 Ramadan Contest')).length).toBeGreaterThan(0);

    // Click the Scoring section link in the comp sidebar. jsdom throws on any
    // real navigation, so this whole test doubles as proof the Link handler
    // preventDefault-ed and swapped the section in place instead.
    fireEvent.click(screen.getByText('Scoring'));

    // (a) The new section's heading renders.
    expect(await screen.findByText('Scoring config')).toBeTruthy();

    // (b) history.pushState was called and the location actually changed.
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/portal/c/2026/scoring');
    expect(window.location.pathname).toBe('/portal/c/2026/scoring');

    // (c) In-place swap: the same render tree now shows the new section (the
    // pathname-swap happened without a load; the old section's page is gone),
    // and the sidebar highlight followed.
    expect(screen.getByText('Scoring').closest('[data-current]')).toBeTruthy();
  });

  it('leaves non-portal links native (no pushState, no in-place swap)', async () => {
    window.history.replaceState({}, '', '/portal/c/2026');
    const pushSpy = vi.spyOn(window.history, 'pushState');

    const { Link } = await import('./vendor/link');
    const { container } = render(<Link href="/ik/2026">judge world</Link>);
    const anchor = container.querySelector('a')!;

    // Block jsdom's own (unimplemented) navigation at the document level —
    // React's delegated handler (on the render root) runs first, so the Link
    // handler still sees an un-prevented event and must decline to claim it.
    const blocker = (e: Event) => e.preventDefault();
    document.addEventListener('click', blocker);
    fireEvent.click(anchor);
    document.removeEventListener('click', blocker);

    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/portal/c/2026');
  });
});
