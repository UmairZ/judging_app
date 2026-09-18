/**
 * Offline Madani 15-line mushaf dataset (KFGQPC V1, 1405H print, 604 pages).
 *
 * The dataset (`madani15.json`, built by `scripts/build-quran-dataset.mjs`) is
 * lazy-loaded via dynamic import so the portal/marketing bundles pay nothing for it;
 * only the judge reveal (and assignment) pull it in.
 *
 * Line semantics: each MushafLine carries the (surah, ayah) of the ayah in which the
 * line STARTS (i.e. the ayah of its first word). Because an ayah can begin mid-line
 * (e.g. 2:8 begins at the end of a line whose first word is still in 2:7), the dataset
 * also carries `ayahIndex`, mapping every ayah to the line that contains its first
 * word — `getPage`/`getPassage` resolve through it, so a passage for 2:8 starts on the
 * physical line where وَمِنَ ٱلنَّاسِ appears.
 */

export interface MushafLine {
  page: number;
  line: number;
  text: string;
  surah: number;
  ayah: number;
  /** Absent for ordinary ayah-text lines. */
  kind?: 'surah_name' | 'basmallah';
}

export interface JuzEntry {
  juz: number;
  surah: number;
  ayah: number;
}

export interface QuranDataset {
  meta: {
    name: string;
    text: string;
    source: string[];
    license: string;
    attribution: string;
    pages: number;
    linesPerPage: number;
    words: number;
    verses: number;
  };
  /** First ayah of each juz, 30 entries, mushaf order. */
  juzIndex: JuzEntry[];
  /** [surah, ayah, lineIdx] per ayah (6236), mushaf order; lineIdx into `lines`. */
  ayahIndex: [number, number, number][];
  /** All mushaf lines sorted by (page, line). */
  lines: MushafLine[];
}

let cached: Promise<QuranDataset> | null = null;

/** Lazy-load the bundled dataset (own chunk via dynamic import); memoized. */
export function loadDataset(): Promise<QuranDataset> {
  cached ??= import('./madani15.json').then((m) => m.default as unknown as QuranDataset);
  return cached;
}

/** Mushaf-order comparison of (surah, ayah) pairs. */
function cmp(s1: number, a1: number, s2: number, a2: number): number {
  return s1 - s2 || a1 - a2;
}

/** Juz (1..30) containing the given ayah. */
export function getJuz(d: QuranDataset, surah: number, ayah: number): number {
  // last juzIndex entry whose start <= (surah, ayah)
  let lo = 0;
  let hi = d.juzIndex.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = d.juzIndex[mid];
    if (cmp(e.surah, e.ayah, surah, ayah) <= 0) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return d.juzIndex[ans].juz;
}

/** Index into d.lines of the line containing the ayah's first word. */
function ayahLineIndex(d: QuranDataset, surah: number, ayah: number): number {
  let lo = 0;
  let hi = d.ayahIndex.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, a, idx] = d.ayahIndex[mid];
    const c = cmp(s, a, surah, ayah);
    if (c === 0) return idx;
    if (c < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  throw new Error(`No such ayah in dataset: ${surah}:${ayah}`);
}

/** Madani 15-line mushaf page (1..604) on which the ayah begins. */
export function getPage(d: QuranDataset, surah: number, ayah: number): number {
  return d.lines[ayahLineIndex(d, surah, ayah)].page;
}

/**
 * The passage shown to the judge: the physical mushaf line on which the ayah begins,
 * continued for `lineCount` lines total (clamped at the end of the mushaf), exactly as
 * line-broken in the printed Madani mushaf. Surah-header/basmala lines that fall
 * inside the span are included (marked via `kind`).
 */
export function getPassage(
  d: QuranDataset,
  surah: number,
  ayah: number,
  lineCount: number,
): { startPage: number; endPage: number; lines: MushafLine[] } {
  if (lineCount < 1) throw new Error(`lineCount must be >= 1, got ${lineCount}`);
  const start = ayahLineIndex(d, surah, ayah);
  const lines = d.lines.slice(start, start + lineCount);
  return { startPage: lines[0].page, endPage: lines[lines.length - 1].page, lines };
}

/**
 * Normalization for text comparison against the Uthmani script (NOT for display):
 * strips tashkeel, quranic annotation marks and tatweel, unifies alef and yaa
 * variants, and collapses whitespace. Documented ranges:
 *   U+0610–061A, U+064B–065F, U+0670 (harakat & Quranic marks above/below)
 *   U+06D6–06ED (Quranic annotation signs: waqf marks, sajdah, small high letters)
 *   U+08D3–08FF (Arabic Extended-A annotation marks)
 *   U+0640 (tatweel)
 *   ٱ أ إ آ -> ا ; ى -> ي ; ة -> ه is NOT applied (taa marbuta is meaningful)
 */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g, '')
    .replace(/[ٱآأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}
