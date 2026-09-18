import { C, serif } from '../ui/theme';
import { rulesPillStyle, LangToggle } from './useJudgeLang';

/** THROWAWAY steering mockup (?qmock=1) — deleted after the operator picks.
 * Static comparison page for the judge QUESTION REVEAL — where/how the assigned
 * passage (surah/ayah/page + Quran text) surfaces on the grading screen.
 * No hooks, no state — pure JSX built from the real DesktopShell/MobileShell
 * markup, with three placement treatments plus the separate side-selector
 * overlay swapped in. */

const NAME = 'Fatima Noor';
const CATEGORY = "5 Ajzā'";
const SIDE_LABEL = 'Beginning (Juz 1–5)';
const REF = 'Al-Baqarah 2:8';
const PAGE = 'page 3';

const QURAN_FONT = "'KFGQPC Uthmanic Script HAFS', 'Scheherazade New', 'Amiri Quran', serif";

const PASSAGE_LINES = [
  'وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ وَبِالْيَوْمِ الْآخِرِ وَمَا هُم بِمُؤْمِنِينَ',
  'يُخَٰدِعُونَ ٱللَّهَ وَٱلَّذِينَ ءَامَنُواْ وَمَا يَخۡدَعُونَ إِلَّآ أَنفُسَهُمۡ وَمَا يَشۡعُرُونَ',
  'فِي قُلُوبِهِم مَّرَضٞ فَزَادَهُمُ ٱللَّهُ مَرَضٗاۖ وَلَهُمۡ عَذَابٌ أَلِيمُۢ بِمَا كَانُواْ يَكۡذِبُونَ',
  'وَإِذَا قِيلَ لَهُمۡ لَا تُفۡسِدُواْ فِي ٱلۡأَرۡضِ قَالُوٓاْ إِنَّمَا نَحۡنُ مُصۡلِحُونَ',
  'أَلَآ إِنَّهُمۡ هُمُ ٱلۡمُفۡسِدُونَ وَلَٰكِن لَّا يَشۡعُرُونَ',
  'وَإِذَا قِيلَ لَهُمۡ ءَامِنُواْ كَمَآ ءَامَنَ ٱلنَّاسُ قَالُوٓاْ أَنُؤۡمِنُ كَمَآ ءَامَنَ ٱلسُّفَهَآءُ',
  'صُمُّۢ بُكۡمٌ عُمۡيٞ فَهُمۡ لَا يَرۡجِعُونَ',
];

/* ---------------------------------------------------------------------- */
/* Shared passage rendering                                                 */
/* ---------------------------------------------------------------------- */

/** Small-caps "Al-Baqarah 2:8 · page 3" meta row — shared by every placement. */
function PassageMeta({ size = 11 }: { size?: number }) {
  return (
    <div style={{ fontSize: size, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 10 }}>
      {REF} · {PAGE}
    </div>
  );
}

/** The seven Uthmani-ish lines, first line highlighted — the one piece of
 * content every option shares verbatim. */
function PassageLines() {
  return (
    <div dir="rtl">
      {PASSAGE_LINES.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: QURAN_FONT, fontSize: 22, lineHeight: 2, textAlign: 'right', color: C.ink,
            background: i === 0 ? C.pill : 'transparent', borderRadius: 6, padding: '1px 8px',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Shared grading-screen scaffolding (abbreviated)                         */
/* ---------------------------------------------------------------------- */

function ScoreBlock({ mobile = false }: { mobile?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: mobile ? 10 : 11, letterSpacing: '.13em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>Session Score</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: mobile ? 4 : 6, justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: serif, fontWeight: 700, fontSize: mobile ? 32 : 46, lineHeight: 1, color: C.gold }}>58.5</span>
        <span style={{ fontSize: mobile ? 13 : 16, color: '#9DBDB4' }}>/ 100</span>
      </div>
    </div>
  );
}

function FinishPill() {
  return <span style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}>Finish</span>;
}

/** Desktop green header — back arrow, name + slot pill, position line, score, Finish. */
function DesktopHeader() {
  return (
    <div style={{ height: 92, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
      <span style={{ width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DCEAE6', fontSize: 22, lineHeight: 1, marginRight: 6 }}>←</span>
      <div style={{ marginLeft: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff' }}>{NAME}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#06211C', background: C.gold, padding: '3px 10px', borderRadius: 999 }}>{CATEGORY}</span>
        </div>
        <div style={{ fontSize: 13, color: '#9DBDB4', marginTop: 3 }}>Contestant 4 of 11 · {SIDE_LABEL}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
        <ScoreBlock />
        <FinishPill />
      </div>
    </div>
  );
}

/** Cream utility strip — Saved dot left, Rules pill + language toggle right. */
function DesktopUtilityStrip() {
  return (
    <div style={{ flex: 'none', minHeight: 40, boxSizing: 'border-box', background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 30px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#4E9B72', fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: '#4E9B72', boxShadow: '0 0 8px #4E9B72', display: 'inline-block' }} />
        Saved
      </div>
      <div style={{ flex: 1 }} />
      <span style={rulesPillStyle}>Rules</span>
      <LangToggle lang="en" setLang={() => {}} />
    </div>
  );
}

/** Narrow question rail, two stub rows only — enough to read as the real rail. */
function RailLite() {
  return (
    <div style={{ width: 190, flex: 'none', borderRight: `1px solid ${C.line}`, background: C.cream, padding: '16px 12px' }}>
      <div style={{ padding: '0 6px 10px', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>Questions</div>
      <div style={{ borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${C.brass}`, background: '#FCF7E9', marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Question 1</span>
      </div>
      <div style={{ borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${C.line}`, background: '#fff' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#41504B' }}>Question 2</span>
      </div>
    </div>
  );
}

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 700, margin: '0 0 9px' }}>{children}</div>;
}

/** Stand-in for the real StepperCard — same shape, hardcoded values, no cfg/lang plumbing. */
function StepperStub({ label, desc, count, compact = false }: { label: string; desc: string; count: number; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 16, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: compact ? '10px 10px 10px 14px' : '12px 14px 12px 18px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 15 : 18, fontWeight: 600, color: C.ink }}>{label}</div>
        <div style={{ fontSize: compact ? 12 : 13, color: C.muted, marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12, flex: 'none' }}>
        <span style={{ width: 44, height: 44, borderRadius: 10, border: '1.5px solid #C9BD9E', color: C.brassDark, fontSize: compact ? 24 : 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</span>
        <span style={{ fontFamily: serif, fontSize: compact ? 24 : 30, fontWeight: 700, color: C.greenDeep, minWidth: compact ? 24 : 30, textAlign: 'center' }}>{count}</span>
        <span style={{ width: compact ? 52 : 58, height: compact ? 52 : 58, borderRadius: compact ? 12 : 13, background: C.green, color: '#fff', fontSize: compact ? 27 : 30, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 7px rgba(32,101,96,.28)' }}>+</span>
      </div>
    </div>
  );
}

/** The "Question 1 · of 7 · N points" heading row. `after` is Option C's slot for the pill. */
function QuestionHeading({ after }: { after?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep }}>Question 1</span>
      <span style={{ fontSize: 13, color: C.muted }}>of 7</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.brassDark, background: C.pill, padding: '3px 10px', borderRadius: 999 }}>2 points</span>
      {after}
    </div>
  );
}

/** Notes textarea stub + completeness box — the side panel's other resident. */
function NotesStub() {
  return (
    <>
      <div>
        <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 8 }}>Notes</div>
        <div style={{ width: '100%', minHeight: 72, boxSizing: 'border-box', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }} />
      </div>
      <div style={{ marginTop: 'auto', background: C.parchment, border: '1px solid #E0D8C6', borderRadius: 9, padding: '13px 15px' }}>
        <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 5 }}>Panel completeness</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep }}>2 / 5</span>
          <span style={{ fontSize: 12.5, color: C.muted }}>judges started</span>
        </div>
      </div>
    </>
  );
}

/* ---- mobile scaffolding ---- */

function MobileHeader() {
  return (
    <div style={{ background: C.greenDeep, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DCEAE6', fontSize: 20, lineHeight: 1 }}>←</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NAME}</div>
          <div style={{ marginTop: 4 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#06211C', background: C.gold, padding: '2px 9px', borderRadius: 999 }}>{CATEGORY}</span>
          </div>
        </div>
        <ScoreBlock mobile />
      </div>
    </div>
  );
}

function MobileUtilityStrip() {
  return (
    <div style={{ background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#4E9B72', fontWeight: 600 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#4E9B72', boxShadow: '0 0 8px #4E9B72', display: 'inline-block' }} />
        Saved
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={rulesPillStyle}>Rules</span>
        <LangToggle lang="en" setLang={() => {}} />
      </div>
    </div>
  );
}

function MobileChips() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 4px' }}>
      <span style={{ borderRadius: 999, padding: '9px 14px', border: `1.5px solid ${C.brass}`, background: '#FCF7E9', fontSize: 13.5, fontWeight: 600, color: C.ink }}>Q1</span>
      <span style={{ borderRadius: 999, padding: '9px 14px', border: `1.5px solid ${C.line}`, background: '#fff', fontSize: 13.5, fontWeight: 600, color: '#41504B' }}>Q2</span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option A — reveal in the side panel / accordion                         */
/* ---------------------------------------------------------------------- */

function OptionADesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex' }}>
        <RailLite />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 30px' }}>
          <QuestionHeading />
          <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StepperStub label="Self-corrected" desc="Caught and fixed without help." count={0} />
            <StepperStub label="Prompted — fixed" desc="Needed a cue, then continued." count={1} />
          </div>
        </div>
        <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '14px 16px' }}>
            <PassageMeta />
            <PassageLines />
          </div>
          <NotesStub />
        </div>
      </div>
    </div>
  );
}

function OptionAMobile() {
  return (
    <div>
      <MobileHeader />
      <MobileUtilityStrip />
      <MobileChips />
      {/* accordion, shown expanded */}
      <div style={{ margin: '10px 14px 0', border: `1px solid ${C.line}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', fontSize: 13, fontWeight: 600, color: C.greenDeep, background: C.cream }}>
          <span>القراءة · {REF} · {PAGE}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.muted }}>▾</span>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <PassageLines />
        </div>
      </div>
      <div style={{ padding: '14px 14px 20px' }}>
        <QuestionHeading />
        <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
        <StepperStub compact label="Self-corrected" desc="Caught and fixed without help." count={0} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option B — full-width passage band                                      */
/* ---------------------------------------------------------------------- */

function PassageBand({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: compact ? '14px 16px' : '18px 22px', marginBottom: compact ? 14 : 20 }}>
      <PassageMeta />
      <PassageLines />
    </div>
  );
}

function OptionBDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex' }}>
        <RailLite />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 30px' }}>
          <QuestionHeading />
          <PassageBand />
          <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StepperStub label="Self-corrected" desc="Caught and fixed without help." count={0} />
            <StepperStub label="Prompted — fixed" desc="Needed a cue, then continued." count={1} />
          </div>
        </div>
        <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <NotesStub />
        </div>
      </div>
    </div>
  );
}

function OptionBMobile() {
  return (
    <div>
      <MobileHeader />
      <MobileUtilityStrip />
      <MobileChips />
      <div style={{ padding: '10px 14px 20px' }}>
        <PassageBand compact />
        <QuestionHeading />
        <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
        <StepperStub compact label="Self-corrected" desc="Caught and fixed without help." count={0} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option C — on-demand overlay                                            */
/* ---------------------------------------------------------------------- */

/** Bordered pill affordance — zero layout cost when the overlay is closed. */
function ViewPassagePill() {
  return <span style={rulesPillStyle}>View passage · صفحة 3</span>;
}

/** The overlay, shown OPEN — absolutely positioned over its frame (the real
 * component uses position:fixed against the viewport; a contained mockup
 * frame needs position:absolute against its own relatively-positioned box). */
function PassageOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ width: '86%', maxWidth: 620, maxHeight: '82%', overflow: 'auto', position: 'relative', background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 24px 60px rgba(20,40,36,.32)' }}>
        <span style={{ position: 'absolute', top: 14, right: 16, fontSize: 22, lineHeight: 1, color: C.muted }}>×</span>
        <PassageMeta size={12} />
        <div style={{ marginTop: 4 }}>
          <PassageLines />
        </div>
      </div>
    </div>
  );
}

function OptionCDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex' }}>
        <RailLite />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 30px' }}>
          <QuestionHeading after={<ViewPassagePill />} />
          <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StepperStub label="Self-corrected" desc="Caught and fixed without help." count={0} />
            <StepperStub label="Prompted — fixed" desc="Needed a cue, then continued." count={1} />
          </div>
        </div>
        <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <NotesStub />
        </div>
      </div>
      <PassageOverlay />
    </div>
  );
}

function OptionCMobile() {
  return (
    <div style={{ position: 'relative' }}>
      <MobileHeader />
      <MobileUtilityStrip />
      <MobileChips />
      <div style={{ padding: '14px 14px 20px' }}>
        <QuestionHeading after={<ViewPassagePill />} />
        <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
        <StepperStub compact label="Self-corrected" desc="Caught and fixed without help." count={0} />
      </div>
      <PassageOverlay />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option D — split screen                                                 */
/* ---------------------------------------------------------------------- */

/** Small-caps collapsible section header for Option D's rail — chevron shows
 * expanded (▾) or collapsed (▸). Static, like everything else here. */
function RailSectionHeader({ label, open }: { label: string; open: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 6px 8px', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, cursor: 'pointer' }}>
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{open ? '▾' : '▸'}</span>
    </div>
  );
}

/** Option D's wider rail — the question cards on top, then Notes (expanded)
 * and Panel completeness (collapsed) folded in below. No right side panel in
 * this option; both residents live here instead. A « chevron at the top
 * collapses it back down to the icon rail. */
function RailWithPanels() {
  return (
    <div style={{ width: 250, flex: 'none', borderRight: `1px solid ${C.line}`, background: C.cream, padding: '16px 12px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px 10px' }}>
        <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>Questions</span>
        <span title="Collapse sidebar" style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: C.muted }}>«</span>
      </div>
      <div style={{ borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${C.brass}`, background: '#FCF7E9', marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>Question 1</span>
      </div>
      <div style={{ borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${C.line}`, background: '#fff', marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#41504B' }}>Question 2</span>
      </div>
      <div style={{ borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${C.line}`, background: '#fff' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#41504B' }}>Question 3</span>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16 }}>
        <RailSectionHeader label="Notes" open />
        <div style={{ padding: '0 6px 12px' }}>
          <div style={{ width: '100%', minHeight: 72, boxSizing: 'border-box', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }} />
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.line}` }}>
        <RailSectionHeader label="Panel completeness" open={false} />
      </div>
    </div>
  );
}

/** Small circular item for the collapsed icon rail — question chip, add
 * button, or notes glyph. Static, like everything else here. */
function RailIconCircle({
  children, active = false, dashed = false, dot = false, title,
}: { children: React.ReactNode; active?: boolean; dashed?: boolean; dot?: boolean; title?: string }) {
  return (
    <span
      title={title}
      style={{
        position: 'relative', width: 40, height: 40, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        border: dashed ? `1.5px dashed ${C.line}` : `1.5px solid ${active ? C.brass : C.line}`,
        background: active ? '#FCF7E9' : '#fff',
        color: active ? C.ink : '#41504B',
      }}
    >
      {children}
      {dot && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 999, background: '#C0392B' }} />}
    </span>
  );
}

/** Option D's DEFAULT working state — the sidebar collapsed horizontally into
 * a narrow VS Code-style icon rail: expand chevron, question circles, add,
 * notes glyph, and a tiny completeness count at the bottom. */
function CollapsedIconRail() {
  return (
    <div style={{ width: 56, flex: 'none', boxSizing: 'border-box', borderRight: `1px solid ${C.line}`, background: C.cream, padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span title="Expand sidebar" style={{ cursor: 'pointer', fontSize: 15, lineHeight: 1, color: C.muted, padding: '2px 0 4px' }}>»</span>
      <RailIconCircle active title="Question 1">Q1</RailIconCircle>
      <RailIconCircle dot title="Question 2">Q2</RailIconCircle>
      <RailIconCircle title="Question 3">Q3</RailIconCircle>
      <RailIconCircle dashed title="Add question">+</RailIconCircle>
      <div style={{ width: 28, height: 1, background: C.line, margin: '2px 0' }} />
      <RailIconCircle title="Notes — opens the sidebar">✎</RailIconCircle>
      <span title="Panel completeness" style={{ marginTop: 'auto', fontSize: 10.5, fontWeight: 600, color: C.muted }}>3/4</span>
    </div>
  );
}

/** Voice & delivery row stub — section label + 0..5 rating buttons, "3" filled. */
function VoiceRowStub() {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionLabel color={C.greenDeep}>Sawt wal-Adā' · Voice &amp; Delivery</SectionLabel>
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{
              width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 600,
              border: n === 3 ? 'none' : `1.5px solid ${C.line}`,
              background: n === 3 ? C.green : '#fff', color: n === 3 ? '#fff' : '#41504B',
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The 55/45 scoring|passage panes — identical in both Option D frames; the
 * collapsed rail just hands them more width. */
function SplitPanes() {
  return (
    <>
      {/* left pane — scoring content, ~55% */}
      <div style={{ flex: '1 1 55%', minWidth: 0, padding: '24px 30px' }}>
        <QuestionHeading />
        <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StepperStub label="Self-corrected" desc="Caught and fixed without help." count={0} />
          <StepperStub label="Prompted — fixed" desc="Needed a cue, then continued." count={1} />
        </div>
        <VoiceRowStub />
      </div>
      {/* thin vertical divider */}
      <div style={{ width: 1, flex: 'none', background: C.line }} />
      {/* right pane — the passage, ~45%, filling the pane height */}
      <div style={{ flex: '1 1 45%', minWidth: 0, padding: '20px 22px', display: 'flex' }}>
        <div style={{ flex: 1, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '16px 18px' }}>
          <PassageMeta />
          <PassageLines />
        </div>
      </div>
    </>
  );
}

/** D1 — sidebar collapsed into the icon rail; the split gets the reclaimed width. */
function OptionDCollapsedDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <CollapsedIconRail />
        <SplitPanes />
      </div>
    </div>
  );
}

/** D2 — sidebar expanded on demand: full question cards, Notes, completeness. */
function OptionDDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <RailWithPanels />
        <SplitPanes />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Fourth block — side selector overlay                                    */
/* ---------------------------------------------------------------------- */

/** The one-time "which side?" prompt — asked before any question reveal exists.
 * Single treatment shown over an abbreviated grading screen, both frames. */
function SideSelectorOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ width: '88%', maxWidth: 380, background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '26px 24px', boxShadow: '0 24px 60px rgba(20,40,36,.32)', textAlign: 'center' }}>
        <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 600, color: C.greenDeep, marginBottom: 2 }}>Which side is Fatima reciting?</div>
        <div dir="rtl" style={{ fontSize: 15, color: C.sub, marginBottom: 20 }}>من أي جهة تقرأ فاطمة؟</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ cursor: 'pointer', background: C.green, color: '#fff', borderRadius: 8, padding: '14px 16px', fontSize: 15, fontWeight: 700 }}>
            Beginning — Juz 1–5 / البداية
          </div>
          <div style={{ cursor: 'pointer', background: 'transparent', color: C.greenDeep, border: `1.5px solid ${C.greenDeep}`, borderRadius: 8, padding: '14px 16px', fontSize: 15, fontWeight: 700 }}>
            End — Juz 26–30 / النهاية
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>Asked once per contestant — changeable until the first mark.</div>
      </div>
    </div>
  );
}

function SideSelectorDesktop() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <DesktopHeader />
      <DesktopUtilityStrip />
      <div style={{ display: 'flex' }}>
        <RailLite />
        <div style={{ flex: 1, minWidth: 0, padding: '24px 30px' }}>
          <QuestionHeading />
          <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <StepperStub label="Self-corrected" desc="Caught and fixed without help." count={0} />
            <StepperStub label="Prompted — fixed" desc="Needed a cue, then continued." count={0} />
          </div>
        </div>
        <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <NotesStub />
        </div>
      </div>
      <SideSelectorOverlay />
    </div>
  );
}

function SideSelectorMobile() {
  return (
    <div style={{ position: 'relative' }}>
      <MobileHeader />
      <MobileUtilityStrip />
      <MobileChips />
      <div style={{ padding: '14px 14px 20px' }}>
        <QuestionHeading />
        <SectionLabel color={C.brassDark}>Hifz · Memorization</SectionLabel>
        <StepperStub compact label="Self-corrected" desc="Caught and fixed without help." count={0} />
      </div>
      <SideSelectorOverlay />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Layout scaffolding                                                       */
/* ---------------------------------------------------------------------- */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, flex: 'none', border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', position: 'relative' }}>
      {children}
    </div>
  );
}

function OptionBlock({
  label, description, desktop, mobile,
}: { label: string; description: string; desktop: React.ReactNode; mobile: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18, maxWidth: 900 }}>{description}</div>
      <div style={{ maxWidth: 1100, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)', marginBottom: 20, position: 'relative' }}>
        {desktop}
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <PhoneFrame>{mobile}</PhoneFrame>
      </div>
    </div>
  );
}

/** Static comparison page — no hooks, no state, no persistence. */
export default function MockQuestions() {
  return (
    <div style={{ minHeight: '100vh', background: C.parchment, color: C.ink, fontFamily: serif, padding: '40px 30px 80px' }}>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.greenDeep, marginBottom: 6 }}>Question-reveal mockups</div>
      <div style={{ fontSize: 14, color: C.sub, marginBottom: 40, maxWidth: 900 }}>
        Static comparison behind <code>?qmock=1</code>. Where the assigned passage (surah/ayah/page + Quran text) surfaces on the
        judge grading screen, plus the separate one-time side-selector prompt. Throwaway — deleted after the operator picks.
      </div>

      <OptionBlock
        label="Option A — reveal in the side panel / accordion"
        description="Desktop: the passage card sits in the right side panel, above Notes — a title row (ref + page) and the seven lines, glanceable reference next to the grading controls. Mobile: a collapsible accordion bar directly under the question chips, shown here expanded. Grading buttons stay primary; the passage never competes with them."
        desktop={<OptionADesktop />}
        mobile={<OptionAMobile />}
      />

      <OptionBlock
        label="Option B — full-width passage band"
        description="Desktop: the passage card spans the full main column, above Hifz · Memorization — a cream card with the ref + page line on top. Mobile: the same band sits under the chips, always visible. The passage becomes the primary object on screen; the deduction steppers scroll below it."
        desktop={<OptionBDesktop />}
        mobile={<OptionBMobile />}
      />

      <OptionBlock
        label="Option C — on-demand overlay"
        description="A bordered pill — “View passage · صفحة 3” — sits beside the question heading on both desktop and mobile. Shown here with the overlay open: a dimmed backdrop, a centered parchment card with ref + page + the seven lines at a larger size, and a × close (RulesModal's pattern). Zero layout cost when it's closed."
        desktop={<OptionCDesktop />}
        mobile={<OptionCMobile />}
      />

      <div style={{ marginBottom: 56 }}>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Option D — split screen</div>
        <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18, maxWidth: 900 }}>
          Desktop: the main area splits side by side — scoring controls on the left (~55%), the passage card on the right (~45%)
          filling the pane height, a thin divider between them. No right side panel: Notes and Panel completeness live in the
          left sidebar, which itself collapses horizontally into a narrow icon rail (VS Code activity-bar style).
        </div>

        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>D1 — sidebar collapsed (icon rail)</div>
        <div style={{ maxWidth: 1100, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)', marginBottom: 8, position: 'relative' }}>
          <OptionDCollapsedDesktop />
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 24 }}>
          Default state — the rail is icons; tapping ✎ (or ») expands the sidebar.
        </div>

        <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>D2 — sidebar expanded</div>
        <div style={{ maxWidth: 1100, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)', marginBottom: 8, position: 'relative' }}>
          <OptionDDesktop />
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
          Expanded on demand — full question cards, Notes, panel completeness.
        </div>

        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 4 }}>
          Passage anchored right (Arabic reads right-to-left); flip is a one-line change if you prefer scoring on the right.
        </div>
        <div style={{ fontSize: 12.5, color: C.muted }}>Mobile treatment TBD — operator deciding after seeing desktop.</div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Side selector overlay</div>
        <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 18, maxWidth: 900 }}>
          Single treatment, shown over an abbreviated grading screen on both frames — asked once per contestant, before any
          question reveal exists. A dimmed backdrop, a centered card with the bilingual question, a green-filled primary
          button for Beginning and an outlined button for End, and a muted note that it stays changeable until the first mark.
        </div>
        <div style={{ maxWidth: 1100, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)', marginBottom: 20, position: 'relative' }}>
          <SideSelectorDesktop />
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <PhoneFrame>
            <SideSelectorMobile />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
}
