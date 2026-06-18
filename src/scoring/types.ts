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

export interface ScoringConfig {
  weights: { hifz: number; tajweed: number; voice: number };
  hifz_base: number;
  tajweed_base: number;
  voice_max: number;
  hifz_deductions: { prompted_fixed: number; prompted_failed: number };
  tajweed_deductions: { major: number; minor: number };
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
