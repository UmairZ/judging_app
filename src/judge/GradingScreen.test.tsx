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

afterEach(() => { cleanup(); localStorage.clear(); });

function renderScreen(backend: InstanceType<typeof InMemoryBackend>, mistakeLimit: number, onEnd: () => void = () => {}) {
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
          onEnd={onEnd}
        />
      </TenantProvider>
    </DbProvider>,
  );
}

describe('GradingScreen live config', () => {
  // Re-anchored off the removed score-breakdown panel (which used to assert on
  // 'Hifz · 55%'). The voice scale's 0..voice_max button row is still rendered
  // straight from the live tenant config, so a non-default voice_max still proves
  // the config subscription is wired up — and still fails if it breaks.
  it('renders the tenant voice_max, not the default', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', {
      ...DEFAULT_SCORING_CONFIG,
      voice_max: 8,
    });
    renderScreen(backend, 5);
    expect(await screen.findByText(/0–8/)).toBeTruthy();
    expect(screen.queryByText(/0–5/)).toBeNull(); // default voice_max would show this
  });
});

describe('flagDismissed persistence (D1 parked fix)', () => {
  it('persists Keep-it on the question and never re-prompts after reload', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(await screen.findByText('Keep question'));
    expect(screen.queryByText('Hifz mistake limit reached')).toBeNull();
    // reload: fresh mount against the same backend — dismissal survives
    cleanup();
    renderScreen(backend, 1);
    await screen.findByText('Prompted');
    expect(screen.queryByText('Hifz mistake limit reached')).toBeNull();
  });
  it('Reset scores clears the dismissal', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(await screen.findByText('Keep question'));
    fireEvent.click(screen.getByText('Reset scores'));
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Hifz mistake limit reached')).toBeTruthy();
  });

  it('Disqualify-then-Restore does not immediately re-prompt', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(await screen.findByText('Score as zero'));
    fireEvent.click(await screen.findByText('Restore question'));
    // still at the limit, but the judge already ruled — no re-interrogation
    expect(screen.queryByText('Hifz mistake limit reached')).toBeNull();
  });
});

describe('Disqualify button hidden on an already-disqualified question', () => {
  it('hides "Score question as zero" once scored, restores it after Restore question', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 5);
    await screen.findByText('Prompted');
    expect(screen.getByText('Score question as zero')).toBeTruthy();
    fireEvent.click(screen.getByText('Score question as zero'));
    expect(await screen.findByText('Restore question')).toBeTruthy();
    expect(screen.queryByText('Score question as zero')).toBeNull();
    fireEvent.click(screen.getByText('Restore question'));
    expect(await screen.findByText('Score question as zero')).toBeTruthy();
  });
});

describe('back arrow replaces Save & exit (desktop header)', () => {
  it('renders a back arrow with the backToQueue aria-label, and no "Save & exit" pill', async () => {
    renderScreen(new InMemoryBackend(), 5);
    const arrow = await screen.findByLabelText('Back to queue');
    expect(arrow).toBeTruthy();
    expect(screen.queryByText('Save & exit')).toBeNull();
  });

  it('clicking the back arrow calls onEnd', async () => {
    const onEnd = vi.fn();
    renderScreen(new InMemoryBackend(), 5, onEnd);
    fireEvent.click(await screen.findByLabelText('Back to queue'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps the language toggle out of the green header (moved to the utility strip below)', async () => {
    renderScreen(new InMemoryBackend(), 5);
    // Back arrow and Finish are both direct children of the green header row —
    // their common parent is the header, which must not also contain the EN toggle.
    const arrow = await screen.findByLabelText('Back to queue');
    const finish = await screen.findByText('Finish');
    const header = arrow.parentElement as HTMLElement;
    expect(header.contains(finish)).toBe(true);
    expect(within(header).queryByRole('button', { name: 'EN' })).toBeNull();
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy(); // exists elsewhere, in the strip below
  });
});

it('rail header shows the "Questions" label with no count and no "min N"', async () => {
  const backend = new InMemoryBackend();
  renderScreen(backend, 5); // minQuestions=3 in the harness
  expect(await screen.findByText('Questions')).toBeTruthy();
  expect(screen.queryByText('3 questions')).toBeNull();
  expect(screen.queryByText(/min 3/)).toBeNull();
});

describe('language toggle', () => {
  it('renders English by default with no Arabic visible', async () => {
    renderScreen(new InMemoryBackend(), 5);
    expect(await screen.findByText('Prompted')).toBeTruthy();
    expect(screen.queryByText('لُقِّن')).toBeNull();
  });
  it('switches the screen to Arabic and persists across remount', async () => {
    renderScreen(new InMemoryBackend(), 5);
    fireEvent.click(await screen.findByRole('button', { name: 'ع' }));
    expect(await screen.findByText('لُقِّن')).toBeTruthy();
    expect(screen.queryByText('Prompted')).toBeNull();
    cleanup();
    renderScreen(new InMemoryBackend(), 5);
    expect(await screen.findByText('لُقِّن')).toBeTruthy();
  });
});

describe('Rules modal', () => {
  it('shows a Rules button when policies are seeded; opens both paragraphs; × closes it', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/policies', { rulesText: 'Rule one.\n\nRule two.' });
    renderScreen(backend, 5);

    const button = await screen.findByText('Rules');
    fireEvent.click(button);
    expect(await screen.findByText('Rule one.')).toBeTruthy();
    expect(screen.getByText('Rule two.')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('Rule one.')).toBeNull();
  });

  it('hides the Rules affordance entirely when no policies doc exists', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 5);
    await screen.findByText('Prompted');
    expect(screen.queryByText('Rules')).toBeNull();
  });
});

describe('count-based auto-flag', () => {
  it('prompts at the mistake limit, not before', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 2);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(screen.queryByText('Hifz mistake limit reached')).toBeNull();
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Hifz mistake limit reached')).toBeTruthy();
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

describe('per-system session scoring (task 4 integration sweep)', () => {
  // Fixed replayed interaction, identical across all three systems: two Prompted
  // taps on Q1 (the harness seeds minQuestions=3, so Q1/Q2/Q3 exist from mount),
  // then voice rated 5 on every question. Only the live config's model changes.
  async function playFixedSession() {
    const promptedLabel = await screen.findByText('Prompted');
    const card = promptedLabel.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(within(card).getByTitle('Add one'));

    // Voice bars render a bare "5" text node (voice_max defaults to 5 and is
    // untouched by these configs) — scoped queries aren't needed since no other
    // element on the screen has that exact text at any point in this sequence.
    const rail = screen.getByText('Questions').parentElement!.parentElement as HTMLElement;
    fireEvent.click(screen.getByText('5', { exact: true })); // rate Q1
    fireEvent.click(within(rail).getByText(/Question 2/));
    fireEvent.click(screen.getByText('5', { exact: true })); // rate Q2
    fireEvent.click(within(rail).getByText(/Question 3/));
    fireEvent.click(screen.getByText('5', { exact: true })); // rate Q3
  }

  it('weighted-v3 defaults: header average matches the hand-computed session score', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', { ...DEFAULT_SCORING_CONFIG, model: 'weighted-v3' });
    renderScreen(backend, 5);
    await playFixedSession();
    // Q1 hifz = (100 − 2·10)/100 = 0.8 → 70·0.8 + 25·1 + 5·1 = 56 + 25 + 5 = 86
    // Q2 = Q3 (no mistakes) = 70·1 + 25·1 + 5·1 = 100
    // avg = (86 + 100 + 100) / 3 = 95.333... → '95.3'
    expect(await screen.findByText('95.3')).toBeTruthy();
  });

  it('escalating-v3 (step 10): header average matches the hand-computed session score', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', { ...DEFAULT_SCORING_CONFIG, model: 'escalating-v3' });
    renderScreen(backend, 5);
    await playFixedSession();
    // Q1 hifz deduction = 2·10 + escalation_step·K(K−1)/2 = 20 + 10·(2·1/2) = 30
    //   → (100 − 30)/100 = 0.7 → 70·0.7 + 25·1 + 5·1 = 49 + 25 + 5 = 79
    // Q2 = Q3 (no mistakes, no escalation) = 100
    // avg = (79 + 100 + 100) / 3 = 279 / 3 = 93.0
    expect(await screen.findByText('93.0')).toBeTruthy();
  });

  it('raw-v3 defaults (voice_worth 5, prompted 10): header average matches the hand-computed session score', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', { ...DEFAULT_SCORING_CONFIG, model: 'raw-v3' });
    renderScreen(backend, 5);
    await playFixedSession();
    // Q1 = max(0, (100 − voice_worth 5) − 2·10) + voice_worth·(5/5) = max(0, 75) + 5 = 80
    // Q2 = Q3 (no mistakes) = (100 − 5) − 0 + 5·(5/5) = 95 + 5 = 100
    // avg = (80 + 100 + 100) / 3 = 280 / 3 = 93.333... → '93.3'
    expect(await screen.findByText('93.3')).toBeTruthy();
  });
});
