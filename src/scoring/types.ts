export type DeductionEventType =
  | 'prompted_fixed'
  | 'prompted_failed'
  | 'self_corrected'
  | 'tajweed_major'
  | 'tajweed_minor';

export interface QuestionEvent {
  type: DeductionEventType;
  ts?: string;
}

export interface Question {
  index: number;
  isAdded?: boolean;
  isTieBreak?: boolean;
  /** judge chose "Keep it" at the mistake limit — UI-only, engine ignores */
  flagDismissed?: boolean;
  /** judge swapped the assigned question for one of their own — audit-only, engine ignores;
   * the reveal shows the own-question copy instead of the abandoned passage */
  replaced?: boolean;
  disqualified?: boolean;
  /** Per-question voice rating, 0..voice_max; null until rated. */
  voice?: number | null;
  events: QuestionEvent[];
}

export interface Session {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
}

/** The three v3 scoring systems (spec 2026-09-18):
 *  raw-v3       — per-question 100 with raw point costs from one pool
 *  weighted-v3  — component weights, percent-native costs
 *  escalating-v3 — weighted-v3 + escalating repeat penalties on hifz (the comp system)
 */
export type ScoringModel = 'raw-v3' | 'weighted-v3' | 'escalating-v3';

/** Model ids the engine implements. Unknown/legacy ids resolve to the defaults
 * via resolveScoringConfig (never crash mid-event, never mix half-shaped configs). */
export const KNOWN_MODELS: readonly ScoringModel[] = ['raw-v3', 'weighted-v3', 'escalating-v3'];

export interface ScoringConfig {
  /** ScoringModel at rest; string for forward compat — unknown ids score with the defaults. */
  model: string;
  /** Shared judge rating scale — voice is rated 0..voice_max in every system. */
  voice_max: number;
  /** raw-v3 tuning — one deduction pool, untouched by weighted/escalating edits. */
  raw: {
    costs: { hesitation: number; prompted: number; unable: number; tajweed_major: number; tajweed_minor: number };
    /** Voice's fixed slice of each question's 100 (1..30). */
    voice_worth: number;
  };
  /** weighted-v3 + escalating-v3 tuning — costs are percentages of a component.
   * Hesitation is hardwired free here (operator decision 4) — no knob. */
  percent: {
    weights: { hifz: number; tajweed: number; voice: number };
    costs: { prompted: number; unable: number; tajweed_major: number; tajweed_minor: number };
    /** escalating-v3 only: the k-th counted hifz mistake costs (k−1)·step extra percentage points (0..50). */
    escalation_step: number;
  };
}

export interface EventCounts {
  prompted_fixed: number;
  prompted_failed: number;
  self_corrected: number;
  tajweed_major: number;
  tajweed_minor: number;
}

export interface ComponentMeans {
  H: number;
  T: number;
  V: number;
}

export interface EnrollmentSummary {
  /** Mean session score across started sessions; null when none started. */
  score: number | null;
  /** Cross-judge mean of the H component. */
  hBar: number;
  /** Cross-judge mean of the T component. */
  tBar: number;
  /** Total prompted_failed events across all started sessions (tie-break). */
  totalPromptedFailed: number;
  startedCount: number;
}
