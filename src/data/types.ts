import type { Question } from '../scoring';

export interface JudgeDoc {
  name: string;
  active: boolean;
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
}

export interface SessionDoc {
  enrollmentId: string;
  judgeId: string;
  questions: Question[];
  notes?: string;
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
