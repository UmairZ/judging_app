import { C, serif } from '../ui/theme';

/** THROWAWAY steering mockup (?hdrmock=1) — deleted after the operator picks.
 * Static comparison page for the judge grading-screen header treatment.
 * No hooks, no state — pure JSX built from the real DesktopShell/MobileShell
 * header markup, with three secondary-controls treatments swapped in. */

const NAME = 'Fatima Noor';
const SLOT = "5 Ajzā' · Sisters";
const SCORE = 95.4;

/* ---------------------------------------------------------------------- */
/* Shared pill families                                                    */
/* ---------------------------------------------------------------------- */

/** Option A's dark-on-green pill (desktop header). */
function PillDark({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', height: 34, boxSizing: 'border-box',
        border: '1px solid #3A6258', background: '#11332D', borderRadius: 999,
        color: '#DCEAE6', fontSize: 12.5, fontWeight: 600, padding: '0 14px', cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
}

/** Option A's light pill, for cream surfaces (mobile strip / Option C utility strip). */
function PillLight() {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', height: 34, boxSizing: 'border-box',
        border: `1px solid ${C.line}`, background: '#fff', borderRadius: 999,
        color: C.greenDeep, fontSize: 12.5, fontWeight: 600, padding: '0 14px', cursor: 'pointer',
      }}
    >
      Rules
    </span>
  );
}

/** Option A's segmented EN|ع pill — one rounded container, two halves. Dark variant for the green header. */
function SegmentedLangDark() {
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', height: 34, boxSizing: 'border-box',
        border: '1px solid #3A6258', background: '#11332D', borderRadius: 999, overflow: 'hidden',
      }}
    >
      <span style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 12.5, fontWeight: 600, background: C.cream, color: C.greenDeep }}>EN</span>
      <span style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: '#DCEAE6' }}>ع</span>
    </div>
  );
}

/** Light-surface variant of the segmented pill (mobile strip / Option C utility strip). */
function SegmentedLangLight() {
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', height: 34, boxSizing: 'border-box',
        border: `1px solid ${C.line}`, background: '#fff', borderRadius: 999, overflow: 'hidden',
      }}
    >
      <span style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 12.5, fontWeight: 600, background: C.greenDeep, color: '#fff' }}>EN</span>
      <span style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 12.5, fontWeight: 600, background: 'transparent', color: C.greenDeep }}>ع</span>
    </div>
  );
}

/** Saved status — bare dot + word, no pill chrome (unchanged from today). */
function SavedBare({ light = false }: { light?: boolean }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: light ? '#4E9B72' : '#8FD4AE', fontWeight: 600 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: light ? '#4E9B72' : '#6FCBA0', boxShadow: `0 0 8px ${light ? '#4E9B72' : '#6FCBA0'}`, display: 'inline-block' }} />
      Saved
    </span>
  );
}

/** Score block — unchanged across all options. */
function ScoreBlock({ size = 'desktop' }: { size?: 'desktop' | 'mobile' }) {
  const big = size === 'desktop';
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: big ? 11 : 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>Session Score</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: big ? 6 : 4, justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: serif, fontWeight: 700, fontSize: big ? 46 : 32, lineHeight: 1, color: C.gold }}>{SCORE.toFixed(1)}</span>
        <span style={{ fontSize: big ? 16 : 13, color: '#9DBDB4' }}>/ 100</span>
      </div>
    </div>
  );
}

/** Gold Finish pill — unchanged. */
function FinishPill() {
  return (
    <span style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}>
      Finish
    </span>
  );
}

/** Name + slot pill + back arrow block — unchanged, shared by every desktop option. */
function NameBlock() {
  return (
    <>
      <span style={{ width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DCEAE6', fontSize: 22, lineHeight: 1, marginRight: 6 }}>←</span>
      <div style={{ marginLeft: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff' }}>{NAME}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#06211C', background: C.gold, padding: '3px 10px', borderRadius: 999 }}>{SLOT}</span>
        </div>
        <div style={{ fontSize: 13, color: '#9DBDB4', marginTop: 3 }}>Contestant 4 of 11</div>
      </div>
    </>
  );
}

/** Mobile name row — unchanged, shared by every mobile option. */
function MobileNameRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DCEAE6', fontSize: 20, lineHeight: 1 }}>←</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NAME}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#06211C', background: C.gold, padding: '2px 9px', borderRadius: 999 }}>{SLOT}</span>
        </div>
      </div>
      <ScoreBlock size="mobile" />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option A — one pill family                                              */
/* ---------------------------------------------------------------------- */

function OptionADesktop() {
  return (
    <div style={{ height: 92, display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
      <NameBlock />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <SavedBare />
        <PillDark>Rules</PillDark>
        <SegmentedLangDark />
        <ScoreBlock />
        <FinishPill />
      </div>
    </div>
  );
}

function OptionAMobile() {
  return (
    <div>
      <div style={{ background: C.greenDeep, padding: '14px 16px' }}>
        <MobileNameRow />
      </div>
      <div style={{ background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SavedBare light />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PillLight />
          <SegmentedLangLight />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option B — icon-lean                                                     */
/* ---------------------------------------------------------------------- */

function IconCircle({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      style={{
        width: 34, height: 34, borderRadius: 999, border: '1px solid #3A6258', background: '#11332D',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DCEAE6', fontSize: 15, cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
}

function IconCircleLight({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span
      title={title}
      style={{
        width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.line}`, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.greenDeep, fontSize: 15, cursor: 'pointer',
      }}
    >
      {children}
    </span>
  );
}

function OptionBDesktop() {
  return (
    <div style={{ height: 92, display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
      <NameBlock />
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span title="Saved" style={{ width: 8, height: 8, borderRadius: 999, background: '#6FCBA0', boxShadow: '0 0 8px #6FCBA0', display: 'inline-block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircle title="Rules (real build: inline SVG open-book icon)">📖</IconCircle>
          <IconCircle title="Switch to Arabic">ع</IconCircle>
        </div>
        <ScoreBlock />
        <FinishPill />
      </div>
    </div>
  );
}

function OptionBMobile() {
  return (
    <div>
      <div style={{ background: C.greenDeep, padding: '14px 16px' }}>
        <MobileNameRow />
      </div>
      <div style={{ background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span title="Saved" style={{ width: 7, height: 7, borderRadius: 999, background: '#4E9B72', boxShadow: '0 0 8px #4E9B72', display: 'inline-block' }} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconCircleLight title="Rules">📖</IconCircleLight>
          <IconCircleLight title="Switch to Arabic">ع</IconCircleLight>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Option C — empty header                                                  */
/* ---------------------------------------------------------------------- */

function OptionCDesktop() {
  return (
    <div>
      <div style={{ height: 92, display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
        <NameBlock />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <ScoreBlock />
          <FinishPill />
        </div>
      </div>
      <div style={{ height: 40, boxSizing: 'border-box', background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '0 30px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SavedBare light />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PillLight />
          <SegmentedLangLight />
        </div>
      </div>
    </div>
  );
}

function OptionCMobile() {
  return (
    <div>
      <div style={{ background: C.greenDeep, padding: '14px 16px' }}>
        <MobileNameRow />
      </div>
      <div style={{ background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SavedBare light />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <PillLight />
          <SegmentedLangLight />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Layout scaffolding                                                       */
/* ---------------------------------------------------------------------- */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 390, flex: 'none', border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
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
      <div style={{ maxWidth: 1100, borderRadius: 10, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.10)', marginBottom: 20 }}>
        {desktop}
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <PhoneFrame>{mobile}</PhoneFrame>
      </div>
    </div>
  );
}

/** Static comparison page — no hooks, no state, no persistence. */
export default function MockHeader() {
  return (
    <div style={{ minHeight: '100vh', background: C.parchment, color: C.ink, fontFamily: serif, padding: '40px 30px 80px' }}>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 700, color: C.greenDeep, marginBottom: 6 }}>Header treatment mockups</div>
      <div style={{ fontSize: 14, color: C.sub, marginBottom: 40, maxWidth: 900 }}>
        Static comparison behind <code>?hdrmock=1</code>. Three options for the judge grading-screen header's secondary controls (Rules, language, Saved). Throwaway — deleted after the operator picks.
      </div>

      <OptionBlock
        label="Option A — one pill family"
        description="Every secondary control shares one pill shape (34px tall, dark outline on the green header). Rules is a pill; EN|ع becomes a single segmented pill instead of two loose letters. Saved stays a bare dot + word, sitting to the left of the pills. The mobile strip reuses the same family recolored for its cream background."
        desktop={<OptionADesktop />}
        mobile={<OptionAMobile />}
      />

      <OptionBlock
        label="Option B — icon-lean"
        description="Rules and the language switch collapse to two identical 34px circles — a book glyph and the 'switch to' language letter (shows 'ع' when English is active, 'EN' when Arabic is active). The real build would swap the book emoji for an inline SVG icon. Saved drops its label, becoming a dot-only indicator with a tooltip, placed left of the circles."
        desktop={<OptionBDesktop />}
        mobile={<OptionBMobile />}
      />

      <OptionBlock
        label="Option C — empty header"
        description="The green header keeps only the essentials: back arrow, name + slot pill, score, Finish. Rules, the language pill, and Saved all move down into a new cream utility strip below the header, using Option A's light pill family. Mobile is unchanged from today's strip layout, just recolored to the same light pill family."
        desktop={<OptionCDesktop />}
        mobile={<OptionCMobile />}
      />
    </div>
  );
}
