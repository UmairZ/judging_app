import { describe, expect, it } from 'vitest';
import { buildJudgeQueue } from './useJudgeQueue';
import { DEFAULT_STRUCTURE_CONFIG } from '../domain/structure';
import type { WithId } from '../data/db';
import type { PanelDoc, AssignmentDoc, EnrollmentDoc, ContestantDoc, SessionDoc } from '../data/types';

const panels: WithId<PanelDoc>[] = [{ id: 'p1', name: 'Panel 1', judgeIds: ['j1'] }];
const assignments: WithId<AssignmentDoc>[] = [{ id: 'a1', category: '1', division: 'brothers', panelId: 'p1' }];
const contestants: WithId<ContestantDoc>[] = [
  { id: 'c1', fullName: 'Not Started Kid', gender: 'male', photoUrl: null, registrationId: null, fields: {}, active: true },
  { id: 'c2', fullName: 'In Progress Kid', gender: 'male', photoUrl: null, registrationId: null, fields: {}, active: true },
  { id: 'c3', fullName: 'Graded Kid', gender: 'male', photoUrl: null, registrationId: null, fields: {}, active: true },
];
const enrollments: WithId<EnrollmentDoc>[] = [
  { id: 'e1', contestantId: 'c1', category: '1', division: 'brothers' },
  { id: 'e2', contestantId: 'c2', category: '1', division: 'brothers' },
  { id: 'e3', contestantId: 'c3', category: '1', division: 'brothers' },
];

describe('buildJudgeQueue', () => {
  it('carries status + marks per item (no English detail string)', () => {
    const sessions: WithId<SessionDoc>[] = [
      {
        id: 's2', enrollmentId: 'e2', judgeId: 'j1', notes: '', updatedAt: null, finalizedAt: null,
        questions: [{ index: 0, events: [{ type: 'prompted_fixed' }, { type: 'tajweed_minor' }], voice: null, disqualified: false }],
      },
      {
        id: 's3', enrollmentId: 'e3', judgeId: 'j1', notes: '', updatedAt: null, finalizedAt: 'sometime',
        questions: [{ index: 0, events: [{ type: 'prompted_fixed' }], voice: 3, disqualified: false }],
      },
    ];

    const items = buildJudgeQueue('j1', { panels, assignments, enrollments, contestants, sessions, structure: DEFAULT_STRUCTURE_CONFIG });
    const byId = Object.fromEntries(items.map((i) => [i.enrollmentId, i]));

    expect(byId.e1).toMatchObject({ status: 'not_started', marks: 0 });
    expect(byId.e2).toMatchObject({ status: 'in_progress', marks: 2 });
    expect(byId.e3).toMatchObject({ status: 'graded', marks: 1 });

    // Structured data only — Dashboard composes the localized copy itself.
    for (const item of items) {
      expect(item).not.toHaveProperty('detail');
    }
  });
});
