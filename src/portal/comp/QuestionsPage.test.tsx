// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ParsedSheet, PoolRow } from '../../intake/questionBank';

// Same import-safety pattern as ScoringPage.test.tsx / JudgesPage.test.tsx.
vi.mock('../../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

// writeDoc (src/data/db.ts) writes straight to the real Firestore SDK — spy on it;
// useDocData/useCollection keep their real (backend-aware) implementations.
vi.mock('../../data/db', async () => {
  const actual = await vi.importActual<typeof import('../../data/db')>('../../data/db');
  return { ...actual, writeDoc: vi.fn(() => Promise.resolve()) };
});

// The quran module lazy-loads a 2MB dataset — jsdom must never touch it. The mock
// keeps the interface: getPage THROWS on a nonexistent ref (surah 99 here), getJuz
// maps juz = surah for deterministic spread assertions, getPassage never crosses.
vi.mock('../../quran', () => ({
  loadDataset: vi.fn(() => Promise.resolve({ fake: true })),
  getJuz: vi.fn((_d: unknown, surah: number) => surah),
  getPage: vi.fn((_d: unknown, surah: number, ayah: number) => {
    if (surah === 99) throw new Error(`No such ayah in dataset: ${surah}:${ayah}`);
    return 1;
  }),
  getPassage: vi.fn((_d: unknown, surah: number) => ({
    startPage: 1,
    endPage: 1,
    lines: [{ page: 1, line: 1, text: 'x', surah, ayah: 1 }],
  })),
}));

// Upload flow drives a real hidden file input with a fixture ArrayBuffer; only
// parseWorkbook is mocked (the intake module has its own tests) — poolId stays real.
vi.mock('../../intake/questionBank', async () => {
  const actual = await vi.importActual<typeof import('../../intake/questionBank')>('../../intake/questionBank');
  return { ...actual, parseWorkbook: vi.fn() };
});

const { InMemoryBackend, DbProvider } = await import('../../data/backend');
const { TenantProvider } = await import('../../tenant/TenantContext');
const { QuestionsPage } = await import('./QuestionsPage');
const { writeDoc } = await import('../../data/db');
const { parseWorkbook } = await import('../../intake/questionBank');
const quran = await import('../../quran');
const writeDocMock = vi.mocked(writeDoc);
const parseWorkbookMock = vi.mocked(parseWorkbook);

afterEach(() => {
  cleanup();
  writeDocMock.mockClear();
  parseWorkbookMock.mockReset();
  vi.mocked(quran.loadDataset).mockClear();
  vi.mocked(quran.getPage).mockClear();
  vi.mocked(quran.getJuz).mockClear();
  vi.mocked(quran.getPassage).mockClear();
});

const BASE = 'orgs/ik/competitions/2026';
const row = (surah: number, ayah: number): PoolRow => ({ surah, ayah, ref: `s ${surah}:${ayah}`, text: 'نص' });

const STRUCTURE = {
  divisions: [{ id: 'sisters', label: 'Sisters' }],
  categories: [{ id: '5', label: "5 Ajzā'", minQuestions: 2, divisions: ['sisters'] }],
};

function baseBackend() {
  const backend = new InMemoryBackend();
  backend.seed(`${BASE}/config/structure`, STRUCTURE);
  return backend;
}

/** Three enrollments in category 5 (needs 2 questions each), with contestant names. */
function seedEnrollments(backend: InstanceType<typeof InMemoryBackend>) {
  for (const id of ['f', 'k', 'a']) {
    backend.seed(`${BASE}/contestants/${id}`, { fullName: `Name ${id.toUpperCase()}`, active: true });
    backend.seed(`${BASE}/enrollments/${id}_5`, { contestantId: id, category: '5', division: 'sisters', round: 'main' });
  }
}

function seedPools(backend: InstanceType<typeof InMemoryBackend>, beginRows: PoolRow[], endRows: PoolRow[]) {
  backend.seed(`${BASE}/questionPools/5_begin`, { categoryId: '5', side: 'begin', range: [1, 5], rows: beginRows });
  backend.seed(`${BASE}/questionPools/5_end`, { categoryId: '5', side: 'end', range: [26, 30], rows: endRows });
}

const FULL_BEGIN = [row(1, 1), row(1, 5), row(2, 10), row(3, 5), row(4, 7), row(4, 9)];
const FULL_END = [row(26, 1), row(26, 5), row(27, 2), row(28, 3), row(29, 4), row(29, 9)];

function renderPage(backend: InstanceType<typeof InMemoryBackend>) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="ik" compId="2026">
        <QuestionsPage />
      </TenantProvider>
    </DbProvider>,
  );
}

async function uploadWorkbook() {
  const input = await screen.findByLabelText('Question workbook');
  const file = new File(['x'], 'bank.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(new ArrayBuffer(4)) });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('QuestionsPage — upload flow', () => {
  const PARSED: ParsedSheet[] = [
    {
      sheetName: 'Juz 1-5',
      range: [1, 5],
      side: 'begin',
      categoryId: '5',
      rows: [row(1, 1), row(2, 10), row(3, 5)],
      errors: [{ rowIndex: 4, cell: 'garbled', reason: 'unrecognized ayah reference (expected a trailing "surah:ayah")' }],
    },
    { sheetName: 'Juz 26-30', range: [26, 30], side: 'end', categoryId: '5', rows: [row(26, 1), row(27, 2)], errors: [] },
    { sheetName: 'Notes', range: [0, 0], side: null, categoryId: null, rows: [], errors: [] },
  ];

  it('parses the chosen file and previews sheet → category · side, flagging unmatched sheets', async () => {
    parseWorkbookMock.mockReturnValue(PARSED);
    renderPage(baseBackend());

    await uploadWorkbook();

    // parseWorkbook received the file's bytes and the live categories.
    await waitFor(() => expect(parseWorkbookMock).toHaveBeenCalledTimes(1));
    expect(parseWorkbookMock.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer);
    expect(parseWorkbookMock.mock.calls[0][1]).toEqual(STRUCTURE.categories);

    // Sheet names with their category · side matches; the unparseable sheet is flagged.
    expect(await screen.findByText('Juz 1-5')).toBeTruthy();
    expect(screen.getByText("5 Ajzā' · begin")).toBeTruthy();
    expect(screen.getByText("5 Ajzā' · end")).toBeTruthy();
    expect(screen.getByText('Notes')).toBeTruthy();
    expect(screen.getByText('Not recognized')).toBeTruthy();
  });

  it('shows parse errors with the EXCEL row number (0-based rowIndex + 1)', async () => {
    parseWorkbookMock.mockReturnValue(PARSED);
    renderPage(baseBackend());

    await uploadWorkbook();

    // rowIndex 4 → Excel row 5, never the raw array index.
    expect(await screen.findByText(/Excel row 5/)).toBeTruthy();
    expect(screen.queryByText(/Excel row 4\b/)).toBeNull();
  });

  it('Confirm writes one questionPools doc per MATCHED pool, none for unmatched sheets', async () => {
    parseWorkbookMock.mockReturnValue(PARSED);
    renderPage(baseBackend());

    await uploadWorkbook();
    fireEvent.click(await screen.findByRole('button', { name: /Import 2 pools/ }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalledTimes(2));

    const calls = writeDocMock.mock.calls;
    const beginCall = calls.find((c) => c[0] === `${BASE}/questionPools/5_begin`);
    const endCall = calls.find((c) => c[0] === `${BASE}/questionPools/5_end`);
    expect(beginCall).toBeTruthy();
    expect(endCall).toBeTruthy();
    expect(beginCall![1]).toMatchObject({ categoryId: '5', side: 'begin', range: [1, 5] });
    expect((beginCall![1] as { rows: PoolRow[] }).rows).toHaveLength(3);
    expect((endCall![1] as { rows: PoolRow[] }).rows).toHaveLength(2);
    // No doc for the unmatched sheet.
    expect(calls.every((c) => !(c[0] as string).includes('null'))).toBe(true);
  });

  it('surfaces a mid-import write failure as a red error and clears the busy state', async () => {
    parseWorkbookMock.mockReturnValue(PARSED);
    // First pool write rejects, any further writes would resolve — the loop stops
    // at the failure and names the sheet it died on.
    writeDocMock.mockRejectedValueOnce(new Error('firestore unavailable'));
    renderPage(baseBackend());

    await uploadWorkbook();
    fireEvent.click(await screen.findByRole('button', { name: /Import 2 pools/ }));

    const err = await screen.findByText(/Import failed at “Juz 1-5”/);
    expect(err.className).toMatch(/red/);
    expect(screen.getByText(/0 of 2 pools written/)).toBeTruthy();
    // Busy cleared and the preview kept — the operator can just press Import again.
    const retry = screen.getByRole('button', { name: /Import 2 pools/ });
    expect(retry).toHaveProperty('disabled', false);
  });

  it('shows a red error instead of dying silently when the workbook cannot be parsed', async () => {
    parseWorkbookMock.mockImplementation(() => {
      throw new Error('zip bomb');
    });
    renderPage(baseBackend());

    await uploadWorkbook();

    expect(await screen.findByText(/Could not read that file/)).toBeTruthy();
    expect(writeDocMock).not.toHaveBeenCalled();
  });
});

describe('QuestionsPage — pools & capacity', () => {
  it('shows needed = enrolled × minQuestions per side and flags a short pool with "short by N"', async () => {
    const backend = baseBackend();
    seedEnrollments(backend); // 3 enrolled × 2 questions = 6 needed per side
    seedPools(backend, [row(1, 1), row(2, 10), row(3, 5), row(4, 7)], [row(26, 1), row(27, 2)]);
    renderPage(backend);

    // begin: 4 of 6 → short by 2; end: 2 of 6 → short by 4. Red = problem (color-is-function).
    expect(await screen.findByText('short by 2')).toBeTruthy();
    expect(screen.getByText('short by 2').className).toMatch(/red/);
    expect(screen.getByText('short by 4')).toBeTruthy();
    expect(screen.getAllByText('6').length).toBeGreaterThan(0); // the needed column
  });

  it('marks a side with enrollments but no uploaded pool', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    renderPage(backend);

    expect((await screen.findAllByText('no pool')).length).toBe(2);
  });
});

describe('QuestionsPage — assignment', () => {
  it('assigns UNASSIGNED enrollments only: both sides in one doc, category-length arrays, juz-ascending', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    // a_5 already has a set — it must be left untouched.
    backend.seed(`${BASE}/questionSets/a_5`, {
      enrollmentId: 'a_5',
      begin: [row(1, 1)],
      end: [row(29, 4)],
      beginLabel: 'Juz 1–5',
      endLabel: 'Juz 26–30',
    });
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalledTimes(2));

    // Dataset loaded lazily inside the click; every pool row validated via getPage
    // (the function that throws on a bad ref — getJuz alone would silently accept it).
    expect(vi.mocked(quran.loadDataset)).toHaveBeenCalled();
    expect(vi.mocked(quran.getPage)).toHaveBeenCalledTimes(FULL_BEGIN.length + FULL_END.length);

    const paths = writeDocMock.mock.calls.map((c) => c[0] as string);
    expect(paths).toContain(`${BASE}/questionSets/f_5`);
    expect(paths).toContain(`${BASE}/questionSets/k_5`);
    expect(paths).not.toContain(`${BASE}/questionSets/a_5`);

    for (const call of writeDocMock.mock.calls) {
      const data = call[1] as {
        enrollmentId: string;
        begin: (PoolRow & { juz: number })[];
        end: (PoolRow & { juz: number })[];
        beginLabel: string;
        endLabel: string;
      };
      expect(data.begin).toHaveLength(2); // minQuestions for category 5
      expect(data.end).toHaveLength(2);
      // juz-ascending within each side (getJuz mock: juz = surah).
      expect(data.begin[0].juz).toBeLessThanOrEqual(data.begin[1].juz);
      expect(data.end[0].juz).toBeLessThanOrEqual(data.end[1].juz);
      // Side provenance: begin rows come from the BEGIN pool (juz 1–5) and end
      // rows from the END pool (juz 26+) — kills the swapped-sides mutant.
      expect(data.begin.every((r) => r.juz <= 5)).toBe(true);
      expect(data.end.every((r) => r.juz >= 26)).toBe(true);
      // Labels come from the pool ranges, rendered verbatim by Task 5.
      expect(data.beginLabel).toBe('Juz 1–5');
      expect(data.endLabel).toBe('Juz 26–30');
    }
  });

  it('never re-draws rows already held by existing sets of the category (incremental assign)', async () => {
    const backend = baseBackend();
    for (const id of ['a', 'f']) {
      backend.seed(`${BASE}/contestants/${id}`, { fullName: `Name ${id.toUpperCase()}`, active: true });
      backend.seed(`${BASE}/enrollments/${id}_5`, { contestantId: id, category: '5', division: 'sisters', round: 'main' });
    }
    seedPools(backend, FULL_BEGIN, FULL_END);
    const enrich = (r: PoolRow) => ({ ...r, juz: r.surah, crosses: false });
    // a_5 already holds 4 of the 6 rows on each side — only 2 remain per side.
    backend.seed(`${BASE}/questionSets/a_5`, {
      enrollmentId: 'a_5',
      begin: FULL_BEGIN.slice(0, 4).map(enrich),
      end: FULL_END.slice(0, 4).map(enrich),
      beginLabel: 'Juz 1–5',
      endLabel: 'Juz 26–30',
    });
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalledTimes(1));

    const [path, data] = writeDocMock.mock.calls[0] as [string, { begin: PoolRow[]; end: PoolRow[] }];
    expect(path).toBe(`${BASE}/questionSets/f_5`);
    // The draw is forced onto exactly the rows a_5 does NOT hold.
    expect(new Set(data.begin.map((r) => r.ref))).toEqual(new Set([FULL_BEGIN[4].ref, FULL_BEGIN[5].ref]));
    expect(new Set(data.end.map((r) => r.ref))).toEqual(new Set([FULL_END[4].ref, FULL_END[5].ref]));
  });

  it('counts only the REMAINING rows in the exhaustion check for an incremental assign', async () => {
    const backend = baseBackend();
    for (const id of ['a', 'f']) {
      backend.seed(`${BASE}/contestants/${id}`, { fullName: `Name ${id.toUpperCase()}`, active: true });
      backend.seed(`${BASE}/enrollments/${id}_5`, { contestantId: id, category: '5', division: 'sisters', round: 'main' });
    }
    seedPools(backend, FULL_BEGIN, FULL_END);
    const enrich = (r: PoolRow) => ({ ...r, juz: r.surah, crosses: false });
    // a_5 holds 5 of 6 begin rows — 1 remains, but f_5 needs 2.
    backend.seed(`${BASE}/questionSets/a_5`, {
      enrollmentId: 'a_5',
      begin: FULL_BEGIN.slice(0, 5).map(enrich),
      end: FULL_END.slice(0, 4).map(enrich),
      beginLabel: 'Juz 1–5',
      endLabel: 'Juz 26–30',
    });
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));

    expect(await screen.findByText(/· begin: pool exhausted — 2 needed, only 1 available/)).toBeTruthy();
    expect(writeDocMock.mock.calls.every((c) => !(c[0] as string).includes('questionSets/'))).toBe(true);
  });

  it('enriches crossing flags with the SAVED passage length, not unsaved field edits', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    backend.seed(`${BASE}/config/questions`, { passage_lines: 4 });
    renderPage(backend);

    const input = await screen.findByLabelText('Passage length (mushaf lines)');
    fireEvent.change(input, { target: { value: '9' } }); // edited but NOT saved
    fireEvent.click(screen.getByRole('button', { name: 'Assign questions' }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalled());

    const passageCalls = vi.mocked(quran.getPassage).mock.calls;
    expect(passageCalls.length).toBeGreaterThan(0);
    expect(passageCalls.every((c) => c[3] === 4)).toBe(true);
  });

  it('refuses to assign from a pool containing an invalid ref — red per-pool error naming the ref', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, [...FULL_BEGIN, row(99, 1)], FULL_END);
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));

    // The bad ref is named; NOTHING is written for the poisoned category.
    expect(await screen.findByText(/s 99:1/)).toBeTruthy();
    expect(writeDocMock.mock.calls.every((c) => !(c[0] as string).includes('questionSets/'))).toBe(true);
  });

  it('surfaces pool exhaustion as a red error naming the short pool, with no partial writes', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    // begin can cover 3×2=6, end has only 3 rows.
    seedPools(backend, FULL_BEGIN, [row(26, 1), row(27, 2), row(28, 3)]);
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));

    expect(await screen.findByText(/· end: pool exhausted/)).toBeTruthy();
    expect(screen.getByText(/6 needed, only 3 available/)).toBeTruthy();
    expect(writeDocMock.mock.calls.every((c) => !(c[0] as string).includes('questionSets/'))).toBe(true);
  });

  it('surfaces a mid-assign write failure as a red error and clears the busy state (remainder self-heals)', async () => {
    const backend = baseBackend();
    seedEnrollments(backend); // f, k, a — all unassigned → 3 questionSets writes
    seedPools(backend, FULL_BEGIN, FULL_END);
    // Second write rejects: one set landed, two did not.
    writeDocMock
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => Promise.reject(new Error('firestore unavailable')));
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Assign questions' }));

    const err = await screen.findByText(/Saving question sets failed after 1 of 3/);
    expect(err.className).toMatch(/red/);
    expect(screen.getByText(/Assign questions again/)).toBeTruthy(); // self-healing hint
    // Busy cleared: the assign button is live again for the incremental retry.
    expect(screen.getByRole('button', { name: 'Assign questions' })).toHaveProperty('disabled', false);
  });

  it('lists per-enrollment status with side-set lengths: assigned sets vs not-assigned', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    backend.seed(`${BASE}/questionSets/a_5`, {
      enrollmentId: 'a_5',
      begin: [row(1, 1), row(2, 10)],
      end: [row(26, 1), row(27, 2)],
      beginLabel: 'Juz 1–5',
      endLabel: 'Juz 26–30',
    });
    renderPage(backend);

    expect(await screen.findByText('Name A')).toBeTruthy();
    expect(screen.getByText('Name F')).toBeTruthy();
    expect(screen.getAllByText('Assigned')).toHaveLength(1);
    expect(screen.getAllByText('Not assigned')).toHaveLength(2);
    // Side-set lengths beside the Assigned badge (spec §2).
    expect(screen.getByText('2 + 2')).toBeTruthy();
  });
});

describe('QuestionsPage — reshuffle', () => {
  it('disables Reshuffle with an explanation once ANY session exists', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    backend.seed(`${BASE}/sessions/f_5__j1`, { enrollmentId: 'f_5', judgeId: 'j1', questions: [] });
    renderPage(backend);

    const btn = await screen.findByRole('button', { name: 'Reshuffle all questions' });
    expect(btn).toHaveProperty('disabled', true);
    expect(screen.getByText(/judging has started/i)).toBeTruthy();
  });

  it('reshuffles EVERY enrollment (assigned included) after the confirm dialog', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    backend.seed(`${BASE}/questionSets/a_5`, { enrollmentId: 'a_5', begin: [], end: [], beginLabel: '', endLabel: '' });
    renderPage(backend);

    const btn = await screen.findByRole('button', { name: 'Reshuffle all questions' });
    expect(btn).toHaveProperty('disabled', false);
    fireEvent.click(btn);
    fireEvent.click(await screen.findByRole('button', { name: 'Reshuffle everything' }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalledTimes(3));

    const paths = writeDocMock.mock.calls.map((c) => c[0] as string);
    expect(paths).toContain(`${BASE}/questionSets/f_5`);
    expect(paths).toContain(`${BASE}/questionSets/k_5`);
    expect(paths).toContain(`${BASE}/questionSets/a_5`);
  });

  it('confirm goes inert when a session appears WHILE the dialog is open — no wipe', async () => {
    const backend = baseBackend();
    seedEnrollments(backend);
    seedPools(backend, FULL_BEGIN, FULL_END);
    renderPage(backend);

    fireEvent.click(await screen.findByRole('button', { name: 'Reshuffle all questions' }));
    expect(await screen.findByRole('button', { name: 'Reshuffle everything' })).toHaveProperty('disabled', false);

    // Judging starts while the operator stares at the dialog.
    await act(async () => {
      await backend.write(`${BASE}/sessions/f_5__j1`, { enrollmentId: 'f_5', judgeId: 'j1', questions: [] }, false);
    });

    const confirm = screen.getByRole('button', { name: 'Reshuffle everything' });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(writeDocMock).not.toHaveBeenCalled();
  });
});

describe('QuestionsPage — passage length', () => {
  it('defaults to 7 mushaf lines when config/questions is absent (spec §1)', async () => {
    renderPage(baseBackend());
    const input = await screen.findByLabelText('Passage length (mushaf lines)');
    expect((input as HTMLInputElement).value).toBe('7');
  });

  it('seeds the field from config/questions and persists an edit', async () => {
    const backend = baseBackend();
    backend.seed(`${BASE}/config/questions`, { passage_lines: 4 });
    renderPage(backend);

    const input = await screen.findByLabelText('Passage length (mushaf lines)');
    expect((input as HTMLInputElement).value).toBe('4');

    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writeDocMock).toHaveBeenCalled());

    const call = writeDocMock.mock.calls.find((c) => c[0] === `${BASE}/config/questions`);
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ passage_lines: 7 });
  });
});
