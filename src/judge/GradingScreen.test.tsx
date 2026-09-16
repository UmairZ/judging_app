// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen, fireEvent, within, cleanup, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { DbProvider, InMemoryBackend } = await import('../data/backend');
const { TenantProvider } = await import('../tenant/TenantContext');
const { DEFAULT_SCORING_CONFIG } = await import('../scoring');
const { default: GradingScreen } = await import('./GradingScreen');
const { useGradingSession } = await import('./useGradingSession');

afterEach(cleanup);

function renderScreen(backend: InstanceType<typeof InMemoryBackend>, mistakeLimit: number) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="demo" compId="demo">
        <GradingScreen
          contestant={{ name: 'Test Kid', slotLabel: "1 Juz' · Brothers" }}
          enrollmentId="e1"
          judgeId="j1"
          minQuestions={3}
          mistakeLimit={mistakeLimit}
          meta={{ position: 1, total: 1, panelName: '', judgeIndex: 0, panelSize: 0, startedCount: 0 }}
          onEnd={() => {}}
        />
      </TenantProvider>
    </DbProvider>,
  );
}

describe('GradingScreen live config', () => {
  it('renders the tenant scoring weights, not the defaults', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', {
      ...DEFAULT_SCORING_CONFIG,
      weights: { hifz: 55, tajweed: 40, voice: 5 },
    });
    renderScreen(backend, 5);
    expect(await screen.findByText('Hifz · 55%')).toBeTruthy();
    expect(screen.getByText('Tajweed · 40%')).toBeTruthy();
  });
});

describe('flagDismissed persistence (D1 parked fix)', () => {
  it('persists Keep-it on the question and never re-prompts after reload', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(await screen.findByText('Keep it'));
    expect(screen.queryByText('Call it?')).toBeNull();
    // reload: fresh mount against the same backend — dismissal survives
    cleanup();
    renderScreen(backend, 1);
    await screen.findByText('Prompted');
    expect(screen.queryByText('Call it?')).toBeNull();
  });
  it('Reset points clears the dismissal', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(await screen.findByText('Keep it'));
    fireEvent.click(screen.getByText('Reset points'));
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Call it?')).toBeTruthy();
  });
});

it('rail header says "{N} questions", not "min N"', async () => {
  const backend = new InMemoryBackend();
  renderScreen(backend, 5); // minQuestions=3 in the harness
  expect(await screen.findByText('3 questions')).toBeTruthy();
  expect(screen.queryByText(/min 3/)).toBeNull();
});

describe('count-based auto-flag', () => {
  it('prompts at the mistake limit, not before', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 2);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(screen.queryByText('Call it?')).toBeNull();
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Call it?')).toBeTruthy();
    // limit language, not points language
    expect(screen.getByText(/2 hifz mistakes/)).toBeTruthy();
  });
});

describe('useGradingSession hook contract (spec §7)', () => {
  // InMemoryBackend has no synchronous read — a momentary doc subscription is one
  // (subscribeDoc invokes the callback synchronously with the current snapshot).
  function readDoc(backend: InstanceType<typeof InMemoryBackend>, path: string) {
    let out: Record<string, unknown> | null = null;
    const unsub = backend.subscribeDoc(path, (d) => { out = d; });
    unsub();
    return out as Record<string, unknown> | null;
  }

  function renderHookWithProviders(backend: InstanceType<typeof InMemoryBackend>, opts: { tieBreak?: boolean } = {}) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DbProvider backend={backend}>
        <TenantProvider orgId="demo" compId="demo">{children}</TenantProvider>
      </DbProvider>
    );
    return renderHook(
      () =>
        useGradingSession({
          contestant: { name: 'Test Kid', slotLabel: "1 Juz' · Brothers" },
          enrollmentId: 'e1',
          judgeId: 'j1',
          minQuestions: 3,
          mistakeLimit: 5,
          meta: { position: 1, total: 1, panelName: '', judgeIndex: 0, panelSize: 0, startedCount: 0 },
          onEnd: () => {},
          tieBreak: opts.tieBreak,
        }),
      { wrapper },
    );
  }

  it('finalize writes finalizedAt and reopen clears it', async () => {
    const backend = new InMemoryBackend();
    const { result } = renderHookWithProviders(backend);
    await waitFor(() => expect(result.current.questions.length).toBeGreaterThan(0));
    // rate every seeded question's voice first
    for (let i = 0; i < 3; i++) {
      act(() => result.current.setActive(i));
      act(() => result.current.setVoice(3));
    }
    act(() => result.current.finalize());
    expect((readDoc(backend, 'orgs/demo/competitions/demo/sessions/e1__j1') as { finalizedAt?: unknown }).finalizedAt).toBeTruthy();
    act(() => result.current.reopen());
    expect((readDoc(backend, 'orgs/demo/competitions/demo/sessions/e1__j1') as { finalizedAt?: unknown }).finalizedAt).toBeNull();
  });

  it('tie-break submit merges the primary questions back untouched', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/sessions/e1__j1', {
      enrollmentId: 'e1', judgeId: 'j1', round: 'main',
      questions: [{ index: 0, events: [{ type: 'prompted_fixed', ts: 't' }], voice: 4, disqualified: false, isAdded: false, isTieBreak: false }],
    });
    const { result } = renderHookWithProviders(backend, { tieBreak: true });
    await waitFor(() => expect(result.current.questions.length).toBe(1)); // the one tie-break question
    act(() => result.current.setVoice(5));
    act(() => result.current.submitTieBreak());
    const doc = readDoc(backend, 'orgs/demo/competitions/demo/sessions/e1__j1') as { questions: { isTieBreak: boolean; events: unknown[] }[] };
    expect(doc.questions.some((q) => !q.isTieBreak && q.events.length === 1)).toBe(true); // primary preserved
    expect(doc.questions.some((q) => q.isTieBreak)).toBe(true);
  });
});
