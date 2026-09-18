import { C, serif } from '../../ui/theme';
import { L, type JudgeLang } from '../labels';
import type { SideChoice } from '../useGradingSession';

/** The one-time "which side?" prompt (spec §4) — DQOverlay's overlay pattern,
 * shown only while the contestant has a questionSet and the session carries no
 * side yet. Beginning is the green-filled primary, End the outlined secondary;
 * each is subtitled with the set's begin/end label rendered VERBATIM (written by
 * the portal — e.g. 'Juz 1–5'). No dismiss affordance: the judge must choose. */
export default function SideSelect({ beginLabel, endLabel, lang, onPick }: {
  beginLabel: string;
  endLabel: string;
  lang: JudgeLang;
  onPick: (s: SideChoice) => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 45, padding: 20 }}>
      <div style={{ width: 'min(400px, calc(100vw - 32px))', background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '26px 24px', boxShadow: '0 24px 60px rgba(20,40,36,.32)', textAlign: 'center' }}>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 18 }}>
          <L k="sideQuestion" lang={lang} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => onPick('begin')}
            style={{ cursor: 'pointer', border: 'none', background: C.green, color: '#fff', borderRadius: 8, padding: '14px 16px', fontFamily: 'inherit', boxShadow: '0 2px 7px rgba(32,101,96,.28)' }}
          >
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}><L k="beginningSide" lang={lang} /></span>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginTop: 3, color: C.pillGreen }}>{beginLabel}</span>
          </button>
          <button
            onClick={() => onPick('end')}
            style={{ cursor: 'pointer', background: 'transparent', color: C.greenDeep, border: `1.5px solid ${C.greenDeep}`, borderRadius: 8, padding: '14px 16px', fontFamily: 'inherit' }}
          >
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}><L k="endSide" lang={lang} /></span>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginTop: 3, color: C.sub }}>{endLabel}</span>
          </button>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>
          <L k="sideNote" lang={lang} />
        </div>
      </div>
    </div>
  );
}
