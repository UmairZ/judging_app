// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

vi.mock('../../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

// The quran module lazy-loads a 2MB dataset — jsdom must never touch it (only the
// question-reveal tests exercise it; the mock keeps loadDataset lazy + tiny).
vi.mock('../../quran', () => ({
  loadDataset: vi.fn(() => Promise.resolve({ fake: true })),
  getPassage: vi.fn((_d: unknown, surah: number, ayah: number, lineCount: number) => ({
    startPage: 3,
    endPage: 3,
    lines: Array.from({ length: lineCount }, (_, i) => ({ page: 3, line: i + 1, text: `LINE-${i + 1}`, surah, ayah })),
  })),
  getPage: vi.fn(() => 3),
}));

const quran = await import('../../quran');
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

function renderScreen(backend: InstanceType<typeof InMemoryBackend>, mistakeLimit: number, onEnd: () => void = () => {}, tieBreak = false) {
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
          tieBreak={tieBreak}
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
    expect(await screen.findByText(/Voice & delivery is still unrated/)).toBeTruthy();
  });

  it('a Prompted tap at limit 1 raises the DQ overlay', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 1);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Hifz mistake limit reached')).toBeTruthy();
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

  it('hides "Score question as zero" once scored, restores it after Restore question', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    await screen.findByText('Q1');
    expect(screen.getByText('Score question as zero')).toBeTruthy();
    fireEvent.click(screen.getByText('Score question as zero'));
    expect(await screen.findByText('Restore question')).toBeTruthy();
    expect(screen.queryByText('Score question as zero')).toBeNull();
    fireEvent.click(screen.getByText('Restore question'));
    expect(await screen.findByText('Score question as zero')).toBeTruthy();
  });
});

describe('shell picker (desktop viewport)', () => {
  it('still renders the desktop shell when the phone query does not match', async () => {
    mockDesktop();
    renderScreen(new InMemoryBackend(), 5);
    // Task 6: desktop's sidebar defaults to the collapsed icon rail.
    expect(await screen.findByLabelText('Expand sidebar')).toBeTruthy();
    expect(screen.queryByText('+ Add')).toBeNull(); // no mobile add chip
    fireEvent.click(screen.getByLabelText('Expand sidebar'));
    expect(screen.getByText('Questions')).toBeTruthy(); // expanded rail header
    expect(screen.queryByText('3 questions')).toBeNull(); // count dropped from the rail header
  });
});

/** T4-seed-shaped questionSets doc for enrollment e1 (rows = PoolRow + additive juz/crosses). */
function seedQuestionSet(backend: InstanceType<typeof InMemoryBackend>) {
  backend.seed('orgs/demo/competitions/demo/questionSets/e1', {
    enrollmentId: 'e1',
    begin: [
      { surah: 1, ayah: 1, ref: 'Al-Fatihah 1:1', text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', juz: 1, crosses: false },
      { surah: 2, ayah: 60, ref: 'Al-Baqarah 2:60', text: 'وَإِذِ اسْتَسْقَىٰ مُوسَىٰ', juz: 1, crosses: false },
      { surah: 2, ayah: 155, ref: 'Al-Baqarah 2:155', text: 'وَلَنَبْلُوَنَّكُم', juz: 2, crosses: false },
    ],
    end: [
      { surah: 67, ayah: 1, ref: 'Al-Mulk 67:1', text: 'تَبَارَكَ الَّذِي', juz: 29, crosses: false },
      { surah: 78, ayah: 31, ref: "An-Naba' 78:31", text: 'إِنَّ لِلْمُتَّقِينَ مَفَازًا', juz: 30, crosses: false },
      { surah: 112, ayah: 1, ref: 'Al-Ikhlas 112:1', text: 'قُلْ هُوَ اللَّهُ أَحَدٌ', juz: 30, crosses: false },
    ],
    beginLabel: 'Juz 1–5',
    endLabel: 'Juz 26–30',
    assignedAt: 1,
    assignedBy: null,
  });
}

/** InMemoryBackend has no synchronous read — a momentary doc subscription is one. */
function readDoc(backend: InstanceType<typeof InMemoryBackend>, path: string) {
  let out: Record<string, unknown> | null = null;
  const unsub = backend.subscribeDoc(path, (d) => { out = d; });
  unsub();
  return out as Record<string, unknown> | null;
}

const SESSION_PATH = 'orgs/demo/competitions/demo/sessions/e1__j1';

describe('side selector overlay (phase E, spec §4)', () => {
  it('renders on open when a questionSet exists: labels verbatim, note, both buttons', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    renderScreen(backend, 5);
    expect(await screen.findByText('Which side is the recitation from?')).toBeTruthy();
    expect(screen.getByText('Beginning')).toBeTruthy();
    expect(screen.getByText('End')).toBeTruthy();
    // set labels rendered VERBATIM (en dash), never re-derived
    expect(screen.getByText('Juz 1–5')).toBeTruthy();
    expect(screen.getByText('Juz 26–30')).toBeTruthy();
    expect(screen.getByText('Asked once per contestant — changeable until the first mark.')).toBeTruthy();
  });

  it('choosing Beginning persists side:"begin" to the session doc and dismisses the overlay', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    renderScreen(backend, 5);
    fireEvent.click(await screen.findByText('Beginning'));
    expect((readDoc(backend, SESSION_PATH) as { side?: string }).side).toBe('begin');
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    // the strip pill now shows the chosen side with the verbatim set label
    expect(screen.getByText('Beginning · Juz 1–5')).toBeTruthy();
  });

  it('is absent on reopen when the session already carries a side', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5);
    await screen.findByText('Q1');
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    expect(screen.getByText('Beginning · Juz 1–5')).toBeTruthy();
  });

  it('no questionSet: no overlay, no side pill, no View passage pill — screen exactly as today', async () => {
    mockPhone();
    renderScreen(new InMemoryBackend(), 5);
    await screen.findByText('Q1');
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    expect(screen.queryByText(/View passage/)).toBeNull();
    expect(screen.queryByText(/Beginning/)).toBeNull();
  });

  it('strip pill reopens the side selector (explicit re-choice, no direct toggle) until the first mark, then is static', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5);
    // one tap must NOT change the side — it reopens the two-button overlay instead
    fireEvent.click(await screen.findByText('Beginning · Juz 1–5'));
    expect((readDoc(backend, SESSION_PATH) as { side?: string }).side).toBe('begin');
    expect(await screen.findByText('Which side is the recitation from?')).toBeTruthy();
    fireEvent.click(screen.getByText('End'));
    expect((readDoc(backend, SESSION_PATH) as { side?: string }).side).toBe('end');
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    expect(await screen.findByText('End · Juz 26–30')).toBeTruthy();
    // first mark → sideLocked → the pill goes static: no overlay, no change
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    fireEvent.click(screen.getByText('End · Juz 26–30'));
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    expect((readDoc(backend, SESSION_PATH) as { side?: string }).side).toBe('end'); // unchanged
  });

  it('tie-break: no side pill, no side overlay — the recorded main-round side cannot be rewritten', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5, () => {}, true);
    await screen.findByText('Q1'); // the single tie-break question chip
    expect(screen.queryByText('Beginning · Juz 1–5')).toBeNull();
    expect(screen.queryByText('Which side is the recitation from?')).toBeNull();
    expect((readDoc(backend, SESSION_PATH) as { side?: string }).side).toBe('begin'); // untouched
  });

  it('tie-break: passage path shows the own-question copy, never the assigned row', async () => {
    mockPhone();
    vi.mocked(quran.loadDataset).mockClear();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5, () => {}, true);
    fireEvent.click(await screen.findByText('View passage')); // no page suffix — no row behind a tie-break question
    expect(await screen.findByText("Judge's own question")).toBeTruthy();
    expect(screen.queryByText(/Al-Fatihah 1:1/)).toBeNull();
    expect(vi.mocked(quran.loadDataset)).not.toHaveBeenCalled(); // dataset never pulled for a null row
  });

  it('Arabic smoke: البداية renders under ع', async () => {
    mockPhone();
    localStorage.setItem('judge-lang', 'ar');
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    renderScreen(backend, 5);
    expect(await screen.findByText('البداية')).toBeTruthy();
    expect(screen.getByText('من أي جهة ستكون التلاوة؟')).toBeTruthy();
  });
});

describe('mobile view-passage pill + overlay (phase E)', () => {
  it('pill beside the question heading shows the page and opens the overlay with ref + page + lines', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5);
    const pill = await screen.findByText('View passage · page 3');
    fireEvent.click(pill);
    expect(await screen.findByText('Al-Fatihah 1:1 · page 3')).toBeTruthy();
    expect(screen.getByText('LINE-1')).toBeTruthy();
    // passage_lines default 7 flows through to getPassage
    expect(vi.mocked(quran.getPassage)).toHaveBeenCalledWith(expect.anything(), 1, 1, 7);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByText('LINE-1')).toBeNull();
  });

  it('added question beyond the set → own-question copy instead of a passage', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    seedQuestionSet(backend);
    backend.seed(SESSION_PATH, { enrollmentId: 'e1', judgeId: 'j1', questions: [], side: 'begin' });
    renderScreen(backend, 5);
    await screen.findByText('Q1');
    fireEvent.click(screen.getByText('+ Add')); // Q4 becomes active — no assigned row
    fireEvent.click(await screen.findByText('View passage'));
    expect(await screen.findByText("Judge's own question")).toBeTruthy();
  });
});

describe('mobile header vs. utility strip split', () => {
  it('keeps the language toggle and Rules pill out of the green header, moving them to the strip below it', async () => {
    mockPhone();
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/policies', { rulesText: 'Rule one.\n\nRule two.' });
    renderScreen(backend, 5);
    await screen.findByText('Q1');

    // back arrow -> header row -> green header div (structural, not style-string matching —
    // jsdom re-serializes inline colors, so it can't be relied on to still read "#16413B").
    const header = screen.getByLabelText('Back to queue').parentElement!.parentElement as HTMLElement;
    expect(within(header).queryByRole('button', { name: 'ع' })).toBeNull();
    expect(within(header).queryByText('Rules')).toBeNull();

    const strip = header.nextElementSibling as HTMLElement;
    expect(strip).toBeTruthy();
    expect(within(strip).getByRole('button', { name: 'ع' })).toBeTruthy();
    expect(within(strip).getByText('Rules')).toBeTruthy();
  });
});
