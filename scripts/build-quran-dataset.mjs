#!/usr/bin/env node
/**
 * build-quran-dataset.mjs — builds src/quran/madani15.json
 * (KFGQPC Madani mushaf, V1 / 1405H print, 604 pages x 15 lines).
 *
 * Sources (all cached under scripts/.cache/quran-dataset/ — delete to re-download;
 * output is deterministic, no timestamps):
 *
 *  1. LINE LAYOUT + JUZ: Quran Foundation Content API v4 (api.quran.com),
 *     `verses/by_page/{1..604}?...&mushaf=2` — mushaf=2 is the QPC V1 (1405H) 15-line
 *     Madani layout; every word carries its (page, line), verses carry juz_number.
 *     NOTE: requesting any text word_field silently switches the API to a different
 *     mushaf's layout, so layout and text are fetched as two separate crawls and
 *     zipped by (verse_key, word position) — per-verse token counts are asserted equal.
 *  2. TEXT: same API, `word_fields=text_uthmani` (KFGQPC Uthmani HAFS script).
 *  3. CROSS-CHECK (independent copy of the same KFGQPC V1 layout): QUL
 *     (qul.tarteel.ai/resources/mushaf-layout/15) "KFGQPC V1 layout (1405H print)"
 *     SQLite export, fetched via the public mirror
 *     github.com/blueheron786/quranic-universal-library-mushaf-layouts.
 *     Every line's word count and every line's type/position must agree, except four
 *     pinned, hand-audited discrepancies (three words that the QPC V1 glyph font
 *     splits into two glyph-words on the same line — id numbering only, text
 *     unaffected — and one word at a line boundary on page 443 whose line the two
 *     copies disagree about). Anything else fails the build.
 *
 * Usage: node scripts/build-quran-dataset.mjs
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.cache', 'quran-dataset');
const OUT = path.join(ROOT, 'src', 'quran', 'madani15.json');

const LAYOUT_ZIP_URL =
  'https://raw.githubusercontent.com/blueheron786/quranic-universal-library-mushaf-layouts/main/qpc-v1-15-lines.db.zip';
const API = 'https://api.quran.com/api/v4';
const PAGES = 604;
const VERSES = 6236;

// The four audited spots where the QUL SQLite copy differs from the API's V1 data.
// Key: `${page}:${line}` -> [qul word count, api word count].
const PINNED_LAYOUT_DIFFS = new Map([
  ['27:15', [13, 12]], // one word = two QPC glyph-words (same line; text unaffected)
  ['177:12', [9, 8]], // one word = two QPC glyph-words (same line; text unaffected)
  ['254:6', [9, 8]], // one word = two QPC glyph-words (same line; text unaffected)
  ['443:12', [11, 12]], // one word of 36:52 placed on line 12 (API) vs 13 (QUL)
  ['443:13', [7, 6]], //   ...the other half of the page-443 placement difference
]);

// ---------- fetch + cache ----------

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function cachedFetch(url, cacheName, { binary = false } = {}) {
  const file = path.join(CACHE, cacheName);
  if (await exists(file)) return readFile(file);
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'ibn-katheer-judging dataset build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (!binary) JSON.parse(buf.toString('utf8')); // validate before caching
      await writeFile(file, buf);
      return buf;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastErr;
}

/** Minimal single-entry ZIP extractor (stored or deflate). */
function unzipSingle(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP: EOCD not found');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('ZIP: bad central directory');
  const method = buf.readUInt16LE(cdOffset + 10);
  const compSize = buf.readUInt32LE(cdOffset + 20);
  const localOff = buf.readUInt32LE(cdOffset + 42);
  if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error('ZIP: bad local header');
  const nameLen = buf.readUInt16LE(localOff + 26);
  const extraLen = buf.readUInt16LE(localOff + 28);
  const dataStart = localOff + 30 + nameLen + extraLen;
  const data = buf.subarray(dataStart, dataStart + compSize);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return inflateRawSync(data);
  throw new Error(`ZIP: unsupported compression method ${method}`);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

/** Crawl all 604 pages of one by_page variant, dedupe verses, sort in mushaf order. */
async function crawlPages(queryString, cachePrefix) {
  const pageNums = Array.from({ length: PAGES }, (_, i) => i + 1);
  const results = await mapLimit(pageNums, 8, async (p) => {
    const verses = [];
    for (let apiPage = 1, totalPages = 1; apiPage <= totalPages; apiPage++) {
      const url = `${API}/verses/by_page/${p}?${queryString}&page=${apiPage}`;
      const body = JSON.parse(
        (await cachedFetch(url, `${cachePrefix}-${String(p).padStart(3, '0')}-${apiPage}.json`)).toString('utf8'),
      );
      totalPages = body.pagination.total_pages;
      verses.push(...body.verses);
    }
    return verses;
  });
  const byKey = new Map();
  for (const verses of results) {
    for (const v of verses) if (!byKey.has(v.verse_key)) byKey.set(v.verse_key, v);
  }
  const all = [...byKey.values()]
    .map((v) => {
      const [s, a] = v.verse_key.split(':').map(Number);
      v.words.sort((x, y) => x.position - y.position);
      return { surah: s, ayah: a, juz: v.juz_number, words: v.words };
    })
    .sort((x, y) => x.surah - y.surah || x.ayah - y.ayah);
  if (all.length !== VERSES) throw new Error(`${cachePrefix}: expected ${VERSES} verses, got ${all.length}`);
  return all;
}

// ---------- main ----------

async function main() {
  await mkdir(CACHE, { recursive: true });

  // 1. Layout crawl (QPC V1 / mushaf=2; no text fields or the API switches layout).
  console.log('crawling 604 pages: V1 layout (mushaf=2)...');
  const layoutVerses = await crawlPages(
    'words=true&word_fields=line_number&fields=juz_number&per_page=50&mushaf=2',
    'page-v1',
  );
  // 2. Text crawl (KFGQPC Uthmani HAFS words).
  console.log('crawling 604 pages: Uthmani HAFS text...');
  const textVerses = await crawlPages(
    'words=true&word_fields=line_number,text_uthmani&fields=juz_number&per_page=50&mushaf=2',
    'page-txt',
  );

  // 3. Zip the crawls by (verse, position) into one word list in mushaf order.
  const words = []; // { surah, ayah, page, line, text, first }
  for (let i = 0; i < VERSES; i++) {
    const lv = layoutVerses[i];
    const tv = textVerses[i];
    if (lv.surah !== tv.surah || lv.ayah !== tv.ayah || lv.words.length !== tv.words.length) {
      throw new Error(`token mismatch at ${lv.surah}:${lv.ayah} (${lv.words.length} vs ${tv.words.length})`);
    }
    for (let k = 0; k < lv.words.length; k++) {
      words.push({
        surah: lv.surah,
        ayah: lv.ayah,
        page: lv.words[k].page_number,
        line: lv.words[k].line_number,
        text: tv.words[k].text_uthmani,
        first: k === 0,
      });
    }
  }
  console.log(`words: ${words.length}`);

  // 4. QUL KFGQPC V1 layout export (independent cross-check).
  console.log('cross-checking against the QUL KFGQPC V1 15-line layout export...');
  const zip = await cachedFetch(LAYOUT_ZIP_URL, 'qpc-v1-15-lines.db.zip', { binary: true });
  const dbFile = path.join(CACHE, 'qpc-v1-15-lines.db');
  if (!(await exists(dbFile))) await writeFile(dbFile, unzipSingle(zip));
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const info = db.prepare('SELECT * FROM info').all()[0];
  if (info.number_of_pages !== PAGES || info.lines_per_page !== 15 || info.font_name !== 'v1') {
    throw new Error(`layout db is not the QPC V1 604-page/15-line export: ${JSON.stringify(info)}`);
  }
  const layoutRows = db
    .prepare('SELECT page_number, line_number, line_type, first_word_id, last_word_id, surah_number FROM pages ORDER BY page_number, line_number')
    .all();

  const apiLineCounts = new Map(); // "page:line" -> word count
  for (const w of words) {
    const k = `${w.page}:${w.line}`;
    apiLineCounts.set(k, (apiLineCounts.get(k) ?? 0) + 1);
  }
  const problems = [];
  let checkedLines = 0;
  for (const r of layoutRows) {
    if (r.line_type !== 'ayah') continue;
    const k = `${r.page_number}:${r.line_number}`;
    const qulCount = Number(r.last_word_id) - Number(r.first_word_id) + 1;
    const apiCount = apiLineCounts.get(k) ?? 0;
    checkedLines++;
    if (qulCount === apiCount) continue;
    const pinned = PINNED_LAYOUT_DIFFS.get(k);
    if (pinned && pinned[0] === qulCount && pinned[1] === apiCount) continue;
    problems.push(`${k}: QUL ${qulCount} words, API ${apiCount}`);
  }
  // every API line must exist in the QUL skeleton as an ayah line
  const qulAyahLines = new Set(
    layoutRows.filter((r) => r.line_type === 'ayah').map((r) => `${r.page_number}:${r.line_number}`),
  );
  for (const k of apiLineCounts.keys()) {
    if (!qulAyahLines.has(k)) problems.push(`${k}: API has words but QUL has no ayah line there`);
  }
  if (problems.length > 0) {
    throw new Error(`CROSS-CHECK FAILED (${problems.length}):\n${problems.slice(0, 20).join('\n')}`);
  }
  console.log(`cross-check OK: ${checkedLines} ayah lines agree (5 pinned, audited line diffs)`);

  // 5. Chapter names (for surah-header lines).
  const chapters = JSON.parse(
    (await cachedFetch(`${API}/chapters?language=en`, 'chapters.json')).toString('utf8'),
  ).chapters;
  const surahNameAr = new Map(chapters.map((c) => [c.id, c.name_arabic]));
  if (surahNameAr.size !== 114) throw new Error('expected 114 chapters');

  // 6. Assemble lines in (page, line) order from the QUL skeleton: ayah lines get the
  //    API words; surah_name/basmallah lines get generated text.
  const wordsByLine = new Map(); // "page:line" -> word[] (already in mushaf order)
  for (const w of words) {
    const k = `${w.page}:${w.line}`;
    if (!wordsByLine.has(k)) wordsByLine.set(k, []);
    wordsByLine.get(k).push(w);
  }
  const basmala = textVerses[0].words
    .filter((w) => w.char_type_name !== 'end')
    .map((w) => w.text_uthmani)
    .join(' '); // 1:1 IS the basmala in this text
  const lines = [];
  const ayahLineIndex = new Map(); // "s:a" -> index into lines[] of the ayah's FIRST word's line
  for (let i = 0; i < layoutRows.length; i++) {
    const r = layoutRows[i];
    const page = Number(r.page_number);
    const line = Number(r.line_number);
    if (r.line_type === 'surah_name') {
      const s = Number(r.surah_number);
      lines.push({ page, line, text: `سُورَةُ ${surahNameAr.get(s)}`, surah: s, ayah: 1, kind: 'surah_name' });
    } else if (r.line_type === 'basmallah') {
      const nxt = layoutRows.slice(i + 1).find((x) => x.line_type === 'ayah');
      const s = wordsByLine.get(`${nxt.page_number}:${nxt.line_number}`)[0].surah;
      lines.push({ page, line, text: basmala, surah: s, ayah: 1, kind: 'basmallah' });
    } else {
      const span = wordsByLine.get(`${page}:${line}`);
      for (const w of span) {
        if (w.first) ayahLineIndex.set(`${w.surah}:${w.ayah}`, lines.length);
      }
      lines.push({
        page,
        line,
        text: span.map((w) => w.text).join(' '),
        surah: span[0].surah,
        ayah: span[0].ayah,
      });
    }
  }
  if (ayahLineIndex.size !== VERSES) throw new Error(`ayah index incomplete: ${ayahLineIndex.size}/${VERSES}`);

  // Sanity: pages contiguous 1..604, <=15 lines each, unique line numbers per page.
  const byPage = new Map();
  for (const l of lines) {
    if (!byPage.has(l.page)) byPage.set(l.page, new Set());
    if (byPage.get(l.page).has(l.line)) throw new Error(`duplicate line ${l.page}:${l.line}`);
    byPage.get(l.page).add(l.line);
  }
  for (let p = 1; p <= PAGES; p++) {
    const s = byPage.get(p);
    if (!s) throw new Error(`page ${p} missing`);
    if (s.size > 15) throw new Error(`page ${p} has ${s.size} lines`);
  }
  if (byPage.size !== PAGES) throw new Error(`expected ${PAGES} pages, got ${byPage.size}`);

  // 7. Juz index: first verse of each juz in mushaf order.
  const juzIndex = [];
  const seen = new Set();
  for (const v of layoutVerses) {
    if (!seen.has(v.juz)) {
      seen.add(v.juz);
      juzIndex.push({ juz: v.juz, surah: v.surah, ayah: v.ayah });
    }
  }
  juzIndex.sort((a, b) => a.juz - b.juz);
  if (juzIndex.length !== 30 || juzIndex[0].surah !== 1 || juzIndex[0].ayah !== 1) {
    throw new Error(`bad juz index: ${JSON.stringify(juzIndex)}`);
  }

  // 8. Ayah index as mushaf-ordered triples [surah, ayah, lineIdx]. Needed because an
  //    ayah can begin mid-line (e.g. 2:8 begins on a line whose first word is still in
  //    2:7), so line-start keys alone cannot locate where an ayah starts.
  const ayahIndex = layoutVerses.map((v) => {
    const idx = ayahLineIndex.get(`${v.surah}:${v.ayah}`);
    if (idx === undefined) throw new Error(`no line for ${v.surah}:${v.ayah}`);
    return [v.surah, v.ayah, idx];
  });

  const dataset = {
    meta: {
      name: 'Madani mushaf, KFGQPC V1 (1405H print), 604 pages / 15 lines',
      text: 'KFGQPC Uthmani HAFS script',
      source: [
        'https://api.quran.com/api/v4 (Quran Foundation Content API: QPC V1 15-line layout via mushaf=2, Uthmani HAFS word text, juz numbers)',
        'https://qul.tarteel.ai/resources/mushaf-layout/15 (QUL KFGQPC V1 15-line layout export, via the public mirror github.com/blueheron786/quranic-universal-library-mushaf-layouts; cross-verified line-by-line at build time)',
      ],
      license:
        'Quranic text and Madani mushaf layout by the King Fahd Glorious Quran Printing Complex (KFGQPC), published for reuse with attribution; layout export by the Quranic Universal Library (QUL); bundled solely as an integral part of this application.',
      attribution:
        'Quran text and Madani Mushaf layout © King Fahd Glorious Quran Printing Complex (KFGQPC). Data provided by the Quranic Universal Library (qul.tarteel.ai) and Quran Foundation (quran.com).',
      pages: PAGES,
      linesPerPage: 15,
      words: words.length,
      verses: VERSES,
    },
    juzIndex,
    ayahIndex,
    lines,
  };

  const json = JSON.stringify(dataset);
  await writeFile(OUT, json, 'utf8');
  console.log(
    `wrote ${OUT} (${(json.length / 1024 / 1024).toFixed(2)} MB raw, ${lines.length} lines, ${juzIndex.length} juz, ${ayahIndex.length} ayat)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
