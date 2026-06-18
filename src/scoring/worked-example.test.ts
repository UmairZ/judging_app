import { describe, it, expect } from 'vitest';
import { DEFAULT_SCORING_CONFIG as CFG, sessionScore, componentMeans } from './index';
import type { Question, Session, QuestionEvent } from './index';

const ev = (type: QuestionEvent['type']): QuestionEvent => ({ type });
function q(events: QuestionEvent[], extra: Partial<Question> = {}): Question {
  return { index: 0, events, ...extra };
}
function session(questions: Question[]): Session {
  return { enrollmentId: 'e1', judgeId: 'j1', questions };
}

describe('spec §3.6 worked example', () => {
  it('Strong contestant scores 90.75 (H .90, T .95, V .80)', () => {
    // hifz fractions .9, 1.0, .8, .9 ; each tajweed_minor -> taj .95 ; voice 4 -> .8
    const strong = session([
      q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 4 }), // hifz 9 (.9)
      q([ev('tajweed_minor')], { voice: 4 }),                       // hifz 10 (1.0)
      q([ev('prompted_failed'), ev('tajweed_minor')], { voice: 4 }),// hifz 8 (.8)
      q([ev('prompted_fixed'), ev('tajweed_minor')], { voice: 4 }), // hifz 9 (.9)
    ]);
    const m = componentMeans(strong, CFG);
    expect(m.H).toBeCloseTo(0.9, 10);
    expect(m.T).toBeCloseTo(0.95, 10);
    expect(m.V).toBeCloseTo(0.8, 10);
    expect(sessionScore(strong, CFG)).toBeCloseTo(90.75, 10); // displayed as 90.8
  });

  it('Weak contestant with 1 DQ scores 35.5 (H .30, T .50, V .40)', () => {
    const weak = session([
      // hifz .4 (ded 6), tajweed .6 (ded 4), voice 3 (.6)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'),
         ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major')],
        { voice: 3 }),
      // disqualified -> all components 0, voice counts as 0
      q([], { disqualified: true, voice: null }),
      // hifz .5 (ded 5), tajweed .8 (ded 2), voice 3 (.6)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_fixed'),
         ev('tajweed_major'), ev('tajweed_major')],
        { voice: 3 }),
      // hifz .3 (ded 7), tajweed .6 (ded 4), voice 2 (.4)
      q([ev('prompted_failed'), ev('prompted_failed'), ev('prompted_failed'), ev('prompted_fixed'),
         ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major'), ev('tajweed_major')],
        { voice: 2 }),
    ]);
    const m = componentMeans(weak, CFG);
    expect(m.H).toBeCloseTo(0.3, 10);  // (.4 + 0 + .5 + .3) / 4
    expect(m.T).toBeCloseTo(0.5, 10);  // (.6 + 0 + .8 + .6) / 4
    expect(m.V).toBeCloseTo(0.4, 10);  // (.6 + 0 + .6 + .4) / 4
    expect(sessionScore(weak, CFG)).toBeCloseTo(35.5, 10);
  });
});
