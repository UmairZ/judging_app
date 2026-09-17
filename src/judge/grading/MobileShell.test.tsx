// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

vi.mock('../../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { DbProvider, InMemoryBackend } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { default: GradingScreen } = await import('../GradingScreen');

const realMatchMedia = window.matchMedia;
afterEach(() => { cleanup(); localStorage.clear(); window.matchMedia = realMatchMedia; });

/** Narrow viewport: useIsPhone's query matches (shape satisfies its addEventListener usage). */
function mockPhone() {
  window.matchMedia = ((q: string) => ({
    matches: q === '(max-width: 700px)',
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Wide viewport: same mock shape, nothing matches → desktop shell. */
function mockDesktop() {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

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

describe('MobileShell (phone viewport)', () => {
  it('renders question chips + "+ Add" instead of the side rail', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    expect(await screen.findByText('Q1')).toBeTruthy();
    expect(screen.getByText('Q2')).toBeTruthy();
    expect(screen.getByText('Q3')).toBeTruthy();
    expect(screen.getByText('+ Add')).toBeTruthy();
    // the desktop rail header must NOT render
    expect(screen.queryByText('3 questions')).toBeNull();
  });

  it('tapping "+ Add" creates Q4 and makes it active', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    fireEvent.click(await screen.findByText('+ Add'));
    expect(screen.getByText('Q4')).toBeTruthy();
    expect(screen.getByText('Question 4')).toBeTruthy(); // active-question line
    expect(screen.getByText('Added question')).toBeTruthy();
  });

  it('bottom-bar Finish with unrated voice shows the voice-nudge banner', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    fireEvent.click(await screen.findByText('Finish'));
    expect(await screen.findByText(/Rate voice on every question/)).toBeTruthy();
  });

  it('a Prompted tap at limit 1 raises the DQ overlay', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Call it?')).toBeTruthy();
  });

  it('shows a back arrow in the header with the backToQueue aria-label', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    await screen.findByText('Q1');
    expect(screen.getByLabelText('Back to queue')).toBeTruthy();
  });

  it('clicking the back arrow calls onEnd', async () => {
    mockPhone();
    const onEnd = vi.fn();
    renderScreen(new InMemoryBackend(), 5, onEnd);
    await screen.findByText('Q1');
    fireEvent.click(screen.getByLabelText('Back to queue'));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('bottom bar has only Finish — no Save & exit, Cancel or Back to queue pill', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    await screen.findByText('Q1');
    expect(screen.getByText('Finish')).toBeTruthy();
    expect(screen.queryByText('Save & exit')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.queryByText('Back to queue')).toBeNull();
  });
});

describe('shell picker (desktop viewport)', () => {
  it('still renders the side rail when the phone query does not match', async () => {
    mockDesktop();
    renderScreen(new InMemoryBackend(), 5);
    expect(await screen.findByText('3 questions')).toBeTruthy(); // rail header
    expect(screen.queryByText('Q1')).toBeNull(); // no chips
  });
});
