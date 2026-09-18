import { useState, useEffect, useRef } from 'react';
import { useDocData, now, useSyncState } from '../data/db';
import { useDb } from '../data/backend';
import { useTenant } from '../tenant/TenantContext';
import type { SessionDoc } from '../data/types';
import type { PoolRow } from '../intake/questionBank';
import {
  resolveScoringConfig,
  sessionScore,
  componentMeans,
  questionScore,
  mistakeLimitReached,
  countEvents,
  type Question,
  type Session,
  type DeductionEventType,
  type ScoringConfig,
} from '../scoring';

export interface GradingScreenProps {
  contestant: { name: string; slotLabel: string };
  enrollmentId: string;
  judgeId: string;
  minQuestions: number;
  mistakeLimit: number;
  meta: { position: number; total: number; panelName: string; judgeIndex: number; panelSize: number; startedCount: number };
  onEnd: () => void;
  tieBreak?: boolean;
  /** Force the desktop layout regardless of viewport — for surfaces that embed
   * GradingScreen inside a fixed-size card (e.g. the marketing /demo page),
   * where MobileShell's viewport-fixed furniture would escape the card.
   * Default (undefined) picks the shell from the real viewport via useIsPhone. */
  forcedShell?: 'desktop';
}

/** Which drawn pool the contestant recites from — persisted on the session doc (spec §4). */
export type SideChoice = 'begin' | 'end';

/**
 * `questionSets/{enrollmentId}` as written by the portal (Task 4) — consumed as-is.
 * Rows are PoolRow plus additive `juz`/`crosses`; arrays are juz-ascending (Q1 = index 0).
 * `beginLabel`/`endLabel` are display strings rendered VERBATIM, never re-derived.
 */
export interface QuestionSetDoc {
  enrollmentId: string;
  begin: PoolRow[];
  end: PoolRow[];
  beginLabel: string;
  endLabel: string;
}

/** `config/questions.passage_lines` — default 7 when the doc/field is absent, clamped 1..15. */
export function resolvePassageLines(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.min(15, Math.max(1, raw)) : 7;
}

export function freshQuestion(index: number, isAdded = false): Question {
  return { index, events: [], voice: null, disqualified: false, isAdded, isTieBreak: false };
}

/**
 * All of GradingScreen's state, subscriptions and handlers — extracted so the
 * desktop and (Task 6) mobile shells can share one grading brain. The shell
 * renders the Loading screen while `questions.length === 0`, exactly as the
 * monolithic component did with its early return.
 */
export function useGradingSession({ enrollmentId, judgeId, minQuestions, mistakeLimit, onEnd, tieBreak = false }: GradingScreenProps) {
  const { tp } = useTenant();
  const sessionId = `${enrollmentId}__${judgeId}`;
  const { data: sessionDoc, loading } = useDocData<SessionDoc & { side?: SideChoice | null }>(tp(`sessions/${sessionId}`));
  // Question reveal (phase E): the contestant's drawn set + passage length config.
  const { data: questionSet } = useDocData<QuestionSetDoc>(tp(`questionSets/${enrollmentId}`));
  const questionsCfg = useDocData<{ passage_lines?: number }>(tp('config/questions')).data;
  const passageLines = resolvePassageLines(questionsCfg?.passage_lines);
  const [side, setSideState] = useState<SideChoice | null>(null);
  const sync = useSyncState(tp(`sessions/${sessionId}`));
  const { write } = useDb();
  const cfg = resolveScoringConfig(useDocData<ScoringConfig>(tp('config/scoring')).data);
  const rulesText = useDocData<{ rulesText?: string }>(tp('config/policies')).data?.rulesText ?? '';
  const [questions, setQuestions] = useState<Question[]>([]);
  const [active, setActive] = useState(0);
  const seeded = useRef(false);
  const dirty = useRef(false);
  const [notes, setNotesState] = useState('');
  const [locked, setLocked] = useState(false); // finalized → read-only until the judge reopens
  const [voiceNudge, setVoiceNudge] = useState(false); // flashed when Finish is blocked on an unrated question
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
    setNotesState(sessionDoc?.notes ?? '');
    setSideState(sessionDoc?.side ?? null);
    seeded.current = true;
  }, [loading, sessionDoc, minQuestions, tieBreak]);

  // Single write path — lazy creation: the doc only appears once the judge grades.
  const persist = (extra: Record<string, unknown> = {}) => {
    const payloadQs = tieBreak ? [...primaryRef.current, ...questions] : questions;
    void write(tp(`sessions/${sessionId}`), {
      enrollmentId, judgeId, questions: payloadQs, notes,
      round: 'main',
      // startedAt is written once: only while the live doc doesn't carry it yet.
      ...(sessionDoc?.startedAt ? {} : { startedAt: now() }),
      ...extra,
    }, true);
  };

  // Question edits are discrete taps → persist immediately.
  useEffect(() => {
    if (!seeded.current || !dirty.current) return;
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, sessionId, enrollmentId, judgeId, tieBreak]);

  // Notes is free text → debounce so typing doesn't fire a write per keystroke.
  // (Save & exit / Finish flush the latest notes synchronously, so nothing is lost on exit.)
  useEffect(() => {
    if (!seeded.current || !dirty.current) return;
    const t = setTimeout(() => persist(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  const session: Session = { enrollmentId, judgeId, questions };
  // Pre-seed (questions empty → shell shows Loading) a placeholder keeps derived math safe.
  const aq = questions[active] ?? freshQuestion(active);
  // Voice is required to finish: every non-disqualified question must have a rating.
  const needsVoice = (q: Question) => !q.disqualified && q.voice == null;
  const firstUnratedVoice = questions.findIndex(needsVoice);
  const canFinish = firstUnratedVoice === -1;
  const counts = countEvents(aq);
  const score = tieBreak ? questionScore(aq, cfg) : sessionScore(session, cfg);
  const { H, T, V } = componentMeans(session, cfg);
  const showPrompt = mistakeLimitReached(aq, mistakeLimit) && !aq.flagDismissed;

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
  // freshQuestion carries no flagDismissed — reset clears the dismissal too.
  const resetQ = () => patch(active, (q) => freshQuestion(q.index, q.isAdded));
  // "Keep it" lives on the question and persists via the normal tap path.
  const dismissPrompt = () => patch(active, (q) => ({ ...q, flagDismissed: true }));
  // Also marks the prompt dismissed so an explicit "Restore question" isn't
  // immediately re-interrogated — the judge already ruled on this question.
  const confirmDQ = () => patch(active, (q) => ({ ...q, disqualified: true, flagDismissed: true }));
  const setNotes = (v: string) => { dirty.current = true; setNotesState(v); };
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
    if (!canFinish) { setActive(firstUnratedVoice); setVoiceNudge(true); return; }
    persist({ finalizedAt: now(), endedAt: now() });
    onEnd();
  };
  const reopen = () => {
    setLocked(false);
    dirty.current = true; // subsequent edits will persist again
    void write(tp(`sessions/${sessionId}`), { enrollmentId, judgeId, finalizedAt: null }, true);
  };
  const submitTieBreak = () => {
    if (!canFinish) { setActive(firstUnratedVoice); setVoiceNudge(true); return; }
    persist();
    onEnd();
  };
  const saveAndExit = () => { if (!locked && dirty.current) persist(); onEnd(); };

  // ---- question reveal (phase E, spec §4) ----
  // Locked the moment ANY question of the session carries an event or a voice mark:
  // the recitation has started, so the side can no longer change.
  const sideLocked = questions.some((q) => q.events.length > 0 || q.voice != null);
  // Persists through the SAME session write path as every other session field.
  const setSide = (s: SideChoice) => {
    if (sideLocked && side != null) return; // pill gone static — belt and braces
    setSideState(s);
    persist({ side: s });
  };
  /** The drawn row behind question `index` on the chosen side — null for an
   * added/tie-break question (or while no set/side exists): judge's own question. */
  const revealRow = (index: number): PoolRow | null =>
    (side && questionSet ? questionSet[side]?.[index] : undefined) ?? null;

  return {
    questionSet, side, setSide, sideLocked, revealRow, passageLines,
    cfg, rulesText, loading, locked, tieBreak, questions, active, setActive, aq, counts, score,
    means: { H, T, V }, sync, notes, setNotes, canFinish, voiceNudge, showPrompt,
    inc, dec, setVoice, manualDQ, restoreDQ, resetQ, dismissPrompt, confirmDQ,
    addQuestion, removeQuestion, finalize, reopen, submitTieBreak, saveAndExit, needsVoice,
  };
}

export type GradingSession = ReturnType<typeof useGradingSession>;
