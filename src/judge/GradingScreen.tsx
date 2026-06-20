import { useState, useEffect, useRef } from 'react';
import { useDocData, writeDoc, now } from '../data/db';
import type { SessionDoc } from '../data/types';
import {
  DEFAULT_SCORING_CONFIG as CFG,
  sessionScore,
  componentMeans,
  questionScore,
  hifzAtFloor,
  countEvents,
  type Question,
  type Session,
  type DeductionEventType,
} from '../scoring';

/* ---- design tokens (from the Ibn Katheer design language) ---- */
const C = {
  ink: '#1C2926',
  green: '#206560',
  greenDeep: '#16413B',
  greenPress: '#185049',
  brass: '#B99644',
  brassDark: '#9C7C34',
  gold: '#DCB75E',
  canvas: '#E3DDD0',
  parchment: '#F4EFE4',
  cream: '#FBF8F1',
  line: '#EAE3D4',
  cardLine: '#E6DEC9',
  muted: '#8A938E',
  sub: '#5C6661',
  fail: '#C0563C',
  failBg: '#FBEEEA',
  failLine: '#E6CCC2',
  pill: '#F6EFDA',
  hifzBar: '#C99A3A',
  tajBar: '#4E78AE',
  voiceBar: '#5E9B86',
};
const serif = "'Spectral', serif";

/* ---- the five deduction keys, grouped as in the design ---- */
type KeyDef = { type: DeductionEventType; label: string; tag: string; tagColor: string; tagBg: string; desc: string };
const HIFZ_KEYS: KeyDef[] = [
  { type: 'self_corrected', label: 'Self-corrected', tag: '−0', tagColor: C.sub, tagBg: '#F0ECE0', desc: 'Slipped but caught and fixed it themselves — no penalty, tracked only.' },
  { type: 'prompted_fixed', label: 'Prompted', tag: '−1', tagColor: C.brassDark, tagBg: C.pill, desc: 'Needed a hint to recall the next word, then continued.' },
  { type: 'prompted_failed', label: 'Prompted-failed', tag: '−2', tagColor: C.fail, tagBg: C.failBg, desc: 'Hint given, but still could not continue the passage.' },
];
const TAJWEED_KEYS: KeyDef[] = [
  { type: 'tajweed_major', label: 'Tajweed major', tag: '−1', tagColor: C.brassDark, tagBg: C.pill, desc: 'A clear tajweed rule was broken (e.g. a missed elongation or rule of nūn).' },
  { type: 'tajweed_minor', label: 'Tajweed minor', tag: '−0.5', tagColor: C.sub, tagBg: '#F0ECE0', desc: 'A slight imperfection in articulation or pronunciation.' },
];


function freshQuestion(index: number, isAdded = false): Question {
  return { index, events: [], voice: null, disqualified: false, isAdded, isTieBreak: false };
}

const pct = (f: number) => `${Math.round(f * 100)}%`;

export default function GradingScreen({ contestant, enrollmentId, judgeId, minQuestions, meta, onEnd, tieBreak = false }: { contestant: { name: string; slotLabel: string }; enrollmentId: string; judgeId: string; minQuestions: number; meta: { position: number; total: number; panelName: string; judgeIndex: number; panelSize: number }; onEnd: () => void; tieBreak?: boolean }) {
  const sessionId = `${enrollmentId}__${judgeId}`;
  const { data: sessionDoc, loading } = useDocData<SessionDoc>(`sessions/${sessionId}`);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const seeded = useRef(false);
  const dirty = useRef(false);
  const [notes, setNotes] = useState('');
  const [locked, setLocked] = useState(false); // finalized → read-only until the judge reopens
  const primaryRef = useRef<Question[]>([]); // tie-break mode: the untouched primary questions to merge back

  // Seed from the existing session doc. In tie-break mode we grade one isTieBreak
  // question, keeping the primary questions intact (merged back on save).
  useEffect(() => {
    if (seeded.current || loading) return;
    const docQs = sessionDoc?.questions ?? [];
    if (tieBreak) {
      primaryRef.current = docQs.filter((q) => !q.isTieBreak);
      const existing = docQs.find((q) => q.isTieBreak);
      setQuestions([existing ?? { ...freshQuestion(0, true), isTieBreak: true }]);
      setActive(0);
    } else {
      setQuestions(docQs.length ? docQs : Array.from({ length: minQuestions }, (_, i) => freshQuestion(i)));
      setLocked(sessionDoc?.finalizedAt != null);
    }
    setNotes(sessionDoc?.notes ?? '');
    seeded.current = true;
  }, [loading, sessionDoc, minQuestions, tieBreak]);

  // Persist on every real edit — lazy creation: the doc only appears once the judge grades.
  useEffect(() => {
    if (!seeded.current || !dirty.current) return;
    const payloadQs = tieBreak ? [...primaryRef.current, ...questions] : questions;
    void writeDoc(`sessions/${sessionId}`, { enrollmentId, judgeId, questions: payloadQs, notes, updatedAt: now() }, true);
  }, [questions, notes, sessionId, enrollmentId, judgeId, tieBreak]);

  if (!questions.length) {
    return <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.parchment, color: C.muted, fontFamily: serif }}>Loading…</div>;
  }

  const session: Session = { enrollmentId, judgeId, questions };
  const aq = questions[active];
  const counts = countEvents(aq);
  const score = tieBreak ? questionScore(aq, CFG) : sessionScore(session, CFG);
  const { H, T, V } = componentMeans(session, CFG);
  const showPrompt = hifzAtFloor(aq, CFG) && !dismissed.has(active);

  const patch = (i: number, fn: (q: Question) => Question) => {
    if (locked) return;
    dirty.current = true;
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? fn(q) : q)));
  };

  const inc = (type: DeductionEventType) =>
    patch(active, (q) => ({ ...q, events: [...q.events, { type, ts: new Date().toISOString() }] }));
  const dec = (type: DeductionEventType) =>
    patch(active, (q) => {
      const last = q.events.map((e) => e.type).lastIndexOf(type);
      if (last < 0) return q;
      return { ...q, events: q.events.filter((_, idx) => idx !== last) };
    });
  const setVoice = (n: number) => patch(active, (q) => ({ ...q, voice: n }));
  const manualDQ = () => patch(active, (q) => ({ ...q, disqualified: true }));
  const restoreDQ = () => patch(active, (q) => ({ ...q, disqualified: false }));
  const resetQ = () => {
    patch(active, (q) => freshQuestion(q.index, q.isAdded));
    setDismissed((d) => { const n = new Set(d); n.delete(active); return n; });
  };
  const dismissPrompt = () => setDismissed((d) => new Set(d).add(active));
  const confirmDQ = () => { manualDQ(); dismissPrompt(); };
  const addQuestion = () => {
    if (locked) return;
    dirty.current = true;
    setQuestions((qs) => { setActive(qs.length); return [...qs, freshQuestion(qs.length, true)]; });
  };
  const removeQuestion = (i: number) => {
    if (locked) return;
    dirty.current = true;
    const newLen = questions.length - 1;
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
    setActive((a) => Math.min(Math.max(0, a > i ? a - 1 : a), Math.max(0, newLen - 1)));
  };
  const finalize = () => {
    void writeDoc(`sessions/${sessionId}`, { enrollmentId, judgeId, questions, notes, updatedAt: now(), finalizedAt: now() }, true);
    onEnd();
  };
  const reopen = () => {
    setLocked(false);
    dirty.current = true; // subsequent edits will persist again
    void writeDoc(`sessions/${sessionId}`, { enrollmentId, judgeId, finalizedAt: null, updatedAt: now() }, true);
  };
  const submitTieBreak = () => {
    void writeDoc(`sessions/${sessionId}`, { enrollmentId, judgeId, questions: [...primaryRef.current, ...questions], notes, updatedAt: now() }, true);
    onEnd();
  };

  return (
    <div style={{ width: '100%', height: '100vh', background: C.parchment, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: C.ink, position: 'relative' }}>

        {/* ---- header ---- */}
        <div style={{ height: 92, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: 12, height: 12, background: C.green, transform: 'rotate(45deg)', display: 'inline-block' }} />
          </div>
          <div style={{ marginLeft: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff' }}>{contestant.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#06211C', background: C.gold, padding: '3px 10px', borderRadius: 999 }}>{contestant.slotLabel}</span>
            </div>
            <div style={{ fontSize: 13, color: '#9DBDB4', marginTop: 3 }}>
              {tieBreak ? (
                <span style={{ color: C.gold, fontWeight: 600 }}>⚖︎ Sudden-death tie-break — grade one question</span>
              ) : (
                <>
                  Contestant {meta.position} of {meta.total}
                  {meta.panelName && <> · {meta.panelName}</>}
                  {meta.panelSize > 0 && <> · You are <span style={{ color: '#CFE2DB' }}>Judge {meta.judgeIndex} of {meta.panelSize}</span></>}
                </>
              )}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: locked ? C.gold : '#8FD4AE', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: locked ? C.gold : '#6FCBA0', boxShadow: `0 0 8px ${locked ? C.gold : '#6FCBA0'}`, display: 'inline-block' }} />
              {locked ? 'Graded · locked' : 'Saved locally'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>{tieBreak ? 'Tie-break score' : 'Session score'}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 46, lineHeight: 1, color: C.gold }}>{score.toFixed(1)}</span>
                <span style={{ fontSize: 16, color: '#9DBDB4' }}>/ 100</span>
              </div>
            </div>
            {tieBreak ? (
              <>
                <span onClick={onEnd} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '11px 18px', borderRadius: 5, background: '#11332D' }}>Cancel</span>
                <span onClick={submitTieBreak} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}>Submit tie-break</span>
              </>
            ) : (
              <>
                <span onClick={onEnd} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '11px 18px', borderRadius: 5, background: '#11332D' }}>{locked ? 'Back to queue' : 'Save & exit'}</span>
                <span onClick={locked ? reopen : finalize} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}>{locked ? 'Reopen to edit' : 'Finish'}</span>
              </>
            )}
          </div>
        </div>

        {locked && (
          <div style={{ flex: 'none', padding: '9px 30px', background: C.pill, color: C.brassDark, fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>
            ✓ This session is graded &amp; locked — scores are read-only. Tap “Reopen to edit” to change anything.
          </div>
        )}

        {/* ---- body ---- */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* question rail (hidden in tie-break mode — single question) */}
          {!tieBreak && (
          <div style={{ width: 244, flex: 'none', borderRight: `1px solid ${C.line}`, background: C.cream, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px 10px', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <span>Questions</span><span style={{ color: '#B6AE9C' }}>min {minQuestions}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map((q, i) => {
                const isActive = i === active;
                const total = q.disqualified ? 0 : Math.round(questionScore(q, CFG));
                return (
                  <div key={i} onClick={() => setActive(i)} style={{ cursor: 'pointer', borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${isActive ? C.brass : q.disqualified ? C.failLine : C.line}`, background: isActive ? '#FCF7E9' : q.disqualified ? C.failBg : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: isActive ? C.ink : q.disqualified ? '#9A6A5C' : '#41504B' }}>Question {i + 1}{q.isAdded ? ' +' : ''}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {q.isAdded && !locked && (
                          <button onClick={(e) => { e.stopPropagation(); removeQuestion(i); }} title="Remove question" style={{ fontSize: 15, lineHeight: 1, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                        )}
                        <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: q.disqualified ? C.fail : isActive ? C.brassDark : C.green }}>{q.disqualified ? 'DQ' : <>{total}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}> / 100</span></>}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {!locked && <div onClick={addQuestion} style={{ cursor: 'pointer', marginTop: 2, borderRadius: 8, padding: '11px 13px', border: `1.5px dashed #C9BD9E`, color: C.brassDark, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>+ Add question</div>}
            </div>
          </div>
          )}

          {/* main — active question (locked → read-only) */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '24px 30px', position: 'relative', overflow: 'auto', opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep }}>Question {active + 1}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{aq.isAdded ? 'Added question' : `of ${questions.length}`}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.brassDark, background: C.pill, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{aq.events.length} marks</span>
            </div>

            {aq.disqualified && (
              <div style={{ margin: '12px 0 2px', background: C.failBg, border: `1px solid ${C.failLine}`, borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.fail, letterSpacing: '.04em', textTransform: 'uppercase' }}>Disqualified question</span>
                <span style={{ fontSize: 13, color: '#9A6A5C' }}>All components zeroed — written off.</span>
                <span onClick={restoreDQ} style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.fail, border: '1px solid #E0B6AA', background: '#fff', padding: '7px 14px', borderRadius: 6 }}>Restore question</span>
              </div>
            )}

            <div style={{ opacity: aq.disqualified ? 0.4 : 1, pointerEvents: aq.disqualified ? 'none' : 'auto' }}>
              <SectionLabel color={C.brassDark}>Hifz — memorization</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {HIFZ_KEYS.map((k) => (
                  <StepperCard key={k.type} def={k} count={counts[k.type]} onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
                ))}
              </div>
              <SectionLabel color={C.green} style={{ marginTop: 18 }}>Tajweed — recitation</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TAJWEED_KEYS.map((k) => (
                  <StepperCard key={k.type} def={k} count={counts[k.type]} onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
                ))}
              </div>

              {/* voice — per question */}
              <SectionLabel color={C.voiceBar} style={{ marginTop: 18 }}>Sawt wal-Adā' — voice &amp; delivery</SectionLabel>
              <div style={{ background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ flex: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>Voice &amp; delivery</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>rate as you go · 0–{CFG.voice_max}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
                  {Array.from({ length: CFG.voice_max + 1 }, (_, n) => {
                    const on = aq.voice != null && (n === 0 ? aq.voice === 0 : n <= aq.voice && aq.voice > 0);
                    return (
                      <div key={n} onClick={() => setVoice(n)} style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ height: 14 + n * 8, borderRadius: '4px 4px 0 0', background: on ? C.voiceBar : C.line, marginBottom: 5 }} />
                        <span style={{ fontSize: 13, fontWeight: aq.voice === n ? 700 : 600, color: aq.voice === n ? C.brassDark : C.muted }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* action bar */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid #E4DCC9`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div onClick={resetQ} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #D8D0BE', borderRadius: 8, padding: '13px 20px', fontSize: 15, fontWeight: 600, color: C.sub }}>
                <span style={{ fontSize: 17, color: C.brassDark }}>↺</span> Reset points
              </div>
              <div onClick={manualDQ} style={{ marginLeft: 'auto', cursor: 'pointer', background: '#fff', border: '1.5px solid #E0B6AA', borderRadius: 8, padding: '13px 22px', fontSize: 15, fontWeight: 600, color: C.fail }}>Disqualify question</div>
            </div>

            {/* auto-flag prompt */}
            {showPrompt && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                <div style={{ width: 440, background: C.cream, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '30px 30px 26px', boxShadow: '0 24px 60px rgba(20,40,36,.32)', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span style={{ fontSize: 26, color: C.brass }}>⚠</span>
                  </div>
                  <div style={{ fontFamily: serif, fontSize: 25, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>Call it?</div>
                  <div style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.55, marginBottom: 24 }}>
                    This question's hifz has bottomed out — already 0 from deductions. Write off the <strong style={{ color: C.brassDark }}>whole question</strong> (hifz, tajweed &amp; voice), or keep it and let tajweed and voice still count.
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div onClick={dismissPrompt} style={{ flex: 1, cursor: 'pointer', background: '#fff', border: '1.5px solid #D8D0BE', borderRadius: 9, padding: 14, fontSize: 15, fontWeight: 600, color: '#41504B' }}>Keep it</div>
                    <div onClick={confirmDQ} style={{ flex: 1, cursor: 'pointer', background: C.fail, borderRadius: 9, padding: 14, fontSize: 15, fontWeight: 700, color: '#fff' }}>Disqualify</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* side — score breakdown + completeness (hidden in tie-break mode) */}
          {!tieBreak && (
          <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 12 }}>Score breakdown</div>
              <Bar label="Hifz · 70%" labelColor={C.brassDark} value={pct(H)} frac={H} color={C.hifzBar} />
              <Bar label="Tajweed · 25%" labelColor={C.tajBar} value={pct(T)} frac={T} color={C.tajBar} />
              <Bar label="Voice · 5%" labelColor={C.voiceBar} value={questions.some((q) => q.voice != null || q.disqualified) ? pct(V) : 'pending'} frac={V} color={C.voiceBar} />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 8 }}>Notes</div>
              <textarea
                value={notes}
                disabled={locked}
                onChange={(e) => { dirty.current = true; setNotes(e.target.value); }}
                placeholder="Private notes for this contestant…"
                style={{ width: '100%', minHeight: 104, resize: 'vertical', boxSizing: 'border-box', background: locked ? '#F3EFE4' : '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div style={{ marginTop: 'auto', background: C.parchment, border: '1px solid #E0D8C6', borderRadius: 9, padding: '13px 15px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 5 }}>Panel completeness</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep }}>1 / {meta.panelSize || '—'}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>judges started</span>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
  );
}

function SectionLabel({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 700, margin: '0 0 9px', ...style }}>{children}</div>;
}

function StepperCard({ def, count, onInc, onDec }: { def: KeyDef; count: number; onInc: () => void; onDec: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: '12px 14px 12px 18px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap' }}>{def.label}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: def.tagColor, background: def.tagBg, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap', flex: 'none' }}>{def.tag}</span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{def.desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onDec} title="Remove one" style={{ width: 44, height: 44, borderRadius: 10, border: '1.5px solid #C9BD9E', color: C.brassDark, fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}>−</button>
        <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 700, color: C.greenDeep, minWidth: 30, textAlign: 'center' }}>{count}</span>
        <button onClick={onInc} title="Add one" style={{ width: 58, height: 58, borderRadius: 13, background: C.green, color: '#fff', fontSize: 30, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', boxShadow: '0 2px 7px rgba(32,101,96,.28)' }}>+</button>
      </div>
    </div>
  );
}

function Bar({ label, labelColor, value, frac, color }: { label: string; labelColor: string; value: string; frac: number; color: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: labelColor, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.greenDeep, fontFamily: serif, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 7, background: '#ECE6D8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct(frac), background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
