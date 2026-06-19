/** Sample queue data for the judge-app slice (replaced by Firestore later). */
export type QueueStatus = 'graded' | 'in_progress' | 'not_started';

export interface QueueContestant {
  id: string;
  name: string;
  slotLabel: string;
  status: QueueStatus;
  detail: string; // status-specific subtitle
}

export const JUDGE = {
  name: 'Ustadha Maryam',
  panel: "Sisters' Panel",
  slotLabel: "5 Ajzā' · Sisters",
};

export const SAMPLE_QUEUE: QueueContestant[] = [
  { id: 'c1', name: 'Fatima Noor', slotLabel: JUDGE.slotLabel, status: 'graded', detail: 'Score 90.2' },
  { id: 'c2', name: 'Khadija Omar', slotLabel: JUDGE.slotLabel, status: 'in_progress', detail: 'Q3 of 4 · 71.5 so far' },
  { id: 'c3', name: 'Aisha Siddiqua', slotLabel: JUDGE.slotLabel, status: 'not_started', detail: 'Not yet graded' },
  { id: 'c4', name: 'Zaynab Ali', slotLabel: JUDGE.slotLabel, status: 'not_started', detail: 'Not yet graded' },
  { id: 'c5', name: 'Hafsa Karim', slotLabel: JUDGE.slotLabel, status: 'not_started', detail: 'Not yet graded' },
];
