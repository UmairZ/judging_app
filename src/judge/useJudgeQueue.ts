import { useCollection, useDocData } from '../data/db';
import type { PanelDoc, AssignmentDoc, EnrollmentDoc, ContestantDoc, SessionDoc } from '../data/types';
import { DEFAULT_STRUCTURE_CONFIG, type StructureConfig } from '../domain/structure';

export type QueueStatus = 'graded' | 'in_progress' | 'not_started';

export interface JudgeQueueItem {
  enrollmentId: string;
  contestantId: string;
  category: string;
  name: string;
  slotLabel: string;
  status: QueueStatus;
  detail: string;
}

const slotKey = (c: string, d: string) => `${c}|${d}`;

/** The contestants this judge should grade — derived from their panel's assigned slots. */
export function useJudgeQueue(judgeId: string): JudgeQueueItem[] {
  const panels = useCollection<PanelDoc>('panels');
  const assignments = useCollection<AssignmentDoc>('assignments');
  const enrollments = useCollection<EnrollmentDoc>('enrollments');
  const contestants = useCollection<ContestantDoc>('contestants');
  const sessions = useCollection<SessionDoc>('sessions');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;

  const myPanelIds = panels.filter((p) => p.judgeIds.includes(judgeId)).map((p) => p.id);
  const mySlots = new Set(
    assignments.filter((a) => myPanelIds.includes(a.panelId)).map((a) => slotKey(a.category, a.division)),
  );
  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;

  return enrollments
    .filter((e) => mySlots.has(slotKey(e.category, e.division)))
    .map((e) => {
      const sess = sessions.find((s) => s.enrollmentId === e.id && s.judgeId === judgeId);
      let status: QueueStatus = 'not_started';
      let detail = 'Not yet graded';
      if (sess?.finalizedAt) {
        status = 'graded';
        detail = 'Graded';
      } else if (sess) {
        status = 'in_progress';
        const marks = sess.questions.reduce((n, q) => n + q.events.length, 0);
        detail = `In progress · ${marks} marks`;
      }
      return {
        enrollmentId: e.id,
        contestantId: e.contestantId,
        category: e.category,
        name: contestants.find((c) => c.id === e.contestantId)?.fullName ?? '—',
        slotLabel: `${catLabel(e.category)} · ${divLabel(e.division)}`,
        status,
        detail,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
