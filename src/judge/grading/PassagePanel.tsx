import { useEffect, useMemo, useState } from 'react';
import { C, serif } from '../../ui/theme';
import { L, t, type JudgeLang } from '../labels';
import { useLocalPref } from '../useJudgeLang';
import { loadDataset, getPassage, type MushafLine, type QuranDataset } from '../../quran';
import type { PoolRow } from '../../intake/questionBank';

/** Quran text stack (transcribed from the steering mock — the mock file is throwaway). */
export const QURAN_FONT = "'KFGQPC Uthmanic Script HAFS', 'Scheherazade New', 'Amiri Quran', serif";

/** Quran text sizes the A−/A+ header controls step through (px; 22 = the original fixed size). */
export const QURAN_SIZES = [18, 22, 26, 30, 34];

/** 'page 3' / 'صفحة 3' — or 'page 3 → 4' when the passage crosses a page turn. */
export function pageText(lang: JudgeLang, startPage: number, endPage: number): string {
  const n = endPage > startPage ? `${startPage} → ${endPage}` : String(startPage);
  return t('pageN', lang).replace('{n}', n);
}

type Passage = { startPage: number; endPage: number; lines: MushafLine[] };

/**
 * Lazy passage lookup: the 2MB dataset chunk is only pulled in once a non-null
 * row is asked for (loadDataset is memoized module-wide, so panel + pill share
 * one load). Returns null while there is no row, 'loading' while the dataset is
 * in flight, 'invalid' when the ref isn't in the dataset (portal validates refs
 * at assignment time, so this is belt-and-braces, not an expected state).
 */
export function usePassage(
  row: Pick<PoolRow, 'surah' | 'ayah'> | null,
  lineCount: number,
): Passage | 'loading' | 'invalid' | null {
  const [ds, setDs] = useState<QuranDataset | null>(null);
  const want = row != null;
  useEffect(() => {
    if (!want) return;
    let on = true;
    void loadDataset().then((d) => { if (on) setDs(d); });
    return () => { on = false; };
  }, [want]);
  return useMemo(() => {
    if (!row) return null;
    if (!ds) return 'loading';
    try {
      return getPassage(ds, row.surah, row.ayah, lineCount);
    } catch {
      return 'invalid';
    }
  }, [row, ds, lineCount]);
}

const sizeBtnStyle = (enabled: boolean): React.CSSProperties => ({
  width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: '#fff', border: `1px solid ${C.line}`, borderRadius: 7, padding: 0,
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, lineHeight: 1,
  color: enabled ? C.sub : C.line, cursor: enabled ? 'pointer' : 'default',
});

/** Header bar over the Quran text: small-caps ref/page meta + A−/A+ size stepper.
 * A bottom rule visually separates the heading from the passage itself. */
function MetaHeader({ meta, lang, sizeIdx, setSizeIdx }: {
  meta: string;
  lang: JudgeLang;
  sizeIdx: number;
  setSizeIdx: (i: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${C.line}`, paddingBottom: 9, marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, minWidth: 0 }}>
        {meta}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flex: 'none' }}>
        <button
          aria-label={t('textSmaller', lang)}
          title={t('textSmaller', lang)}
          disabled={sizeIdx === 0}
          onClick={() => setSizeIdx(sizeIdx - 1)}
          style={sizeBtnStyle(sizeIdx > 0)}
        >
          A−
        </button>
        <button
          aria-label={t('textLarger', lang)}
          title={t('textLarger', lang)}
          disabled={sizeIdx === QURAN_SIZES.length - 1}
          onClick={() => setSizeIdx(sizeIdx + 1)}
          style={sizeBtnStyle(sizeIdx < QURAN_SIZES.length - 1)}
        >
          A+
        </button>
      </div>
    </div>
  );
}

const lineStyle = (highlight: boolean, fontSize: number): React.CSSProperties => ({
  fontFamily: QURAN_FONT, fontSize, lineHeight: 2, textAlign: 'right', color: C.ink,
  background: highlight ? C.pill : 'transparent', borderRadius: 6, padding: '1px 8px',
});

/**
 * The revealed passage (spec §5): ref + page + `passageLines` Madani mushaf lines
 * rendered rtl, the bank's starting-ayah line (always index 0 — getPassage starts
 * the slice on it) highlighted. `row === null` (added/tie-break question) renders
 * the own-question copy instead of a passage.
 *
 * Variants (signature consumed by Task 6 — keep EXACT):
 *  - 'pane':    plain card, no close chrome — mounted inside the desktop layout.
 *  - 'overlay': full-screen dimmed modal (RulesModal pattern) — ×, Escape and
 *               backdrop click all fire `onClose`.
 */
export default function PassagePanel({ row, passageLines, lang, variant, onClose }: {
  row: PoolRow | null;
  passageLines: number;
  lang: JudgeLang;
  variant: 'pane' | 'overlay';
  onClose?: () => void;
}) {
  const passage = usePassage(row, passageLines);

  // Quran text size — per-device preference (like judge-lang / judge-rail),
  // shared by the desktop pane and the mobile overlay.
  const [sizePref, setSizePref] = useLocalPref('judge-passage-size', '22');
  const storedIdx = QURAN_SIZES.indexOf(Number(sizePref));
  const sizeIdx = storedIdx === -1 ? QURAN_SIZES.indexOf(22) : storedIdx;
  const setSizeIdx = (i: number) => setSizePref(String(QURAN_SIZES[i]));
  const fontSize = QURAN_SIZES[sizeIdx];

  useEffect(() => {
    if (variant !== 'overlay' || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [variant, onClose]);

  const ownQuestionBody = <div style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.55 }}><L k="ownQuestion" lang={lang} /></div>;

  const body = row == null ? (
    ownQuestionBody
  ) : passage == null || passage === 'loading' ? (
    <div style={{ fontSize: 13.5, color: C.muted }}><L k="loadingPassage" lang={lang} /></div>
  ) : passage === 'invalid' ? (
    // Ref not in the dataset — never crash the grading screen; fall back to the bank's
    // own cell text, or (when that too is blank) the own-question copy, never an empty line.
    row.text ? (
      <>
        <MetaHeader meta={row.ref} lang={lang} sizeIdx={sizeIdx} setSizeIdx={setSizeIdx} />
        <div dir="rtl" style={lineStyle(true, fontSize)}>{row.text}</div>
      </>
    ) : (
      ownQuestionBody
    )
  ) : (
    <>
      <MetaHeader
        meta={`${row.ref} · ${pageText(lang, passage.startPage, passage.endPage)}`}
        lang={lang}
        sizeIdx={sizeIdx}
        setSizeIdx={setSizeIdx}
      />
      <div dir="rtl">
        {passage.lines.map((line, i) => (
          <div key={i} style={lineStyle(i === 0, fontSize)}>{line.text}</div>
        ))}
      </div>
    </>
  );

  if (variant === 'pane') {
    // No close chrome — the desktop layout (Task 6) owns this card's placement.
    return (
      <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px', overflow: 'auto' }}>
        {body}
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 620, maxHeight: '82vh', overflow: 'auto', position: 'relative', background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 24px 60px rgba(20,40,36,.32)' }}
      >
        <button
          onClick={onClose}
          aria-label={t('close', lang)}
          style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: C.muted }}
        >
          ×
        </button>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 12 }}>
          <L k="passage" lang={lang} />
        </div>
        {body}
      </div>
    </div>
  );
}
