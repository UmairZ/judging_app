import type { Question } from '../scoring';

export interface JudgeDoc {
  name: string;
  active: boolean;
  uid?: string; // set when a device/person claims this seat (join code or provisioning)
}

export interface JoinCodeDoc {
  role: 'judge' | 'display';
  judgeId?: string;
  redeemedBy: string | null;
  createdAt: unknown;
}

export interface PanelDoc {
  name: string;
  judgeIds: string[];
}

export interface AssignmentDoc {
  category: string;
  division: string;
  panelId: string;
}

export interface RegistrationDoc {
  source: 'zeffy' | 'manual';
  zeffyPaymentId: string | null;
  zeffyItemId: string | null;
  kind: 'ticket' | 'donation' | 'other';
  buyer: Record<string, unknown>;
  rawItem: Record<string, unknown>;
  parsedFields: Record<string, unknown>;
  paymentStatus: string;
  createdAt: unknown; // Firestore Timestamp
  promotedContestantId: string | null;
}

export interface ContestantDoc {
  fullName: string;
  gender: 'male' | 'female' | null;
  photoUrl: string | null;
  registrationId: string | null;
  fields: Record<string, unknown>;
  active: boolean;
}

export interface EnrollmentDoc {
  contestantId: string;
  category: string;
  division: string;
  round?: string; // schema hook: multi-round competitions (default 'main')
}

export interface SessionDoc {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
  notes?: string;
  round?: string; // schema hook: multi-round competitions (default 'main')
  startedAt?: unknown; // Firestore Timestamp, stamped on first write
  endedAt?: unknown | null; // stamped at finalize (recording-bookmark hook)
  updatedAt: unknown; // Firestore Timestamp
  finalizedAt: unknown | null;
}

export interface TiebreakDoc {
  category: string;
  division: string;
  contestantIds: string[];
  method: 'question' | 'override';
  resolution: Record<string, unknown>;
  resolvedBy: string;
  note: string;
  createdAt: unknown; // Firestore Timestamp
}
