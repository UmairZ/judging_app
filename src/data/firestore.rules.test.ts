import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

// Two tenants. P1/P2 are the competition base paths; membership is seeded per test run.
const P1 = 'orgs/org1/competitions/comp1';
const P2 = 'orgs/org2/competitions/comp2';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ibn-katheer',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // org1: one staff member, two judges bound to seats jA/jB
    await setDoc(doc(db, 'orgs/org1/members/staff1'), { role: 'owner' });
    await setDoc(doc(db, `${P1}/members/uJudgeA`), { role: 'judge', judgeId: 'jA' });
    await setDoc(doc(db, `${P1}/members/uJudgeB`), { role: 'judge', judgeId: 'jB' });
    await setDoc(doc(db, `${P1}/members/uDisplay1`), { role: 'display' });
    // org2: a foreign tenant
    await setDoc(doc(db, 'orgs/org2/members/staff2'), { role: 'admin' });
    await setDoc(doc(db, `${P2}/members/uJudgeZ`), { role: 'judge', judgeId: 'jZ' });
    await setDoc(doc(db, 'users/staff1/orgs/org1'), { role: 'owner', name: 'Org One' });
    await setDoc(doc(db, `${P1}/joinCodes/JUDGE234`), { role: 'judge', judgeId: 'jC', redeemedBy: null });
    await setDoc(doc(db, `${P1}/members/uNoSeat`), { role: 'judge' }); // corrupt: judge with no judgeId
  });
});

// No custom claims anywhere — identity is the uid; authorization is the member docs.
const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('sessions — one writer per doc, judgeId from the member doc', () => {
  it('a judge can create a session for their own seat', async () => {
    await assertSucceeds(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s1`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge cannot create a session for another seat', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s2`), { judgeId: 'jB', enrollmentId: 'e1', questions: [] }));
  });

  it('the auth uid alone is not enough — judgeId must match the member doc', async () => {
    // uJudgeA writing judgeId equal to their *uid* (not their seat) must fail.
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/sessions/s2b`), { judgeId: 'uJudgeA', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot update another judge's session", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s3`), { judgeId: 'jB', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(updateDoc(doc(as('uJudgeA'), `${P1}/sessions/s3`), { enrollmentId: 'changed' }));
  });

  it('a judge cannot hand off their session to another seat', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s5`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(updateDoc(doc(as('uJudgeA'), `${P1}/sessions/s5`), { judgeId: 'jB' }));
  });

  it('nobody can delete a session — not even org staff', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/sessions/s4`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(deleteDoc(doc(as('uJudgeA'), `${P1}/sessions/s4`)));
    await assertFails(deleteDoc(doc(as('staff1'), `${P1}/sessions/s4`)));
  });

  it("org staff can create and update any judge's session (correct-marks feature)", async () => {
    const db = as('staff1');
    await assertSucceeds(setDoc(doc(db, `${P1}/sessions/s6`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
    await assertSucceeds(updateDoc(doc(db, `${P1}/sessions/s6`), { finalizedAt: 'now' }));
  });

  it('a display member cannot create a session', async () => {
    await assertFails(setDoc(doc(as('uDisplay1'), `${P1}/sessions/sd`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge member doc without a judgeId cannot create sessions', async () => {
    await assertFails(setDoc(doc(as('uNoSeat'), `${P1}/sessions/sq`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
    await assertFails(setDoc(doc(as('uNoSeat'), `${P1}/sessions/sq2`), { enrollmentId: 'e1', questions: [] }));
  });
});

describe('staff-only collections', () => {
  it('a judge cannot write config, staff can', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/config/scoring`), { hifz_base: 9 }));
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/config/scoring`), { hifz_base: 9 }));
  });

  it('a judge can read config (needed for their queue)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/config/structure`), { divisions: [] });
    });
    await assertSucceeds(getDoc(doc(as('uJudgeA'), `${P1}/config/structure`)));
  });

  it('a judge cannot write contestants', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/contestants/c1`), { fullName: 'X' }));
  });
});

describe('registrations — immutable master', () => {
  it('staff can create; a judge cannot create or read', async () => {
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/registrations/p1:i1`), { source: 'manual' }));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/registrations/p1:i2`), { source: 'manual' }));
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/registrations/p1:i1`)));
  });

  it('nobody (even staff) can update or delete a registration', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/registrations/p1:i3`), { source: 'zeffy' });
    });
    await assertFails(updateDoc(doc(as('staff1'), `${P1}/registrations/p1:i3`), { source: 'manual' }));
    await assertFails(deleteDoc(doc(as('staff1'), `${P1}/registrations/p1:i3`)));
  });
});

describe('member docs', () => {
  it('a user can read their own comp member doc; not somebody else’s', async () => {
    await assertSucceeds(getDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeA`)));
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeB`)));
  });

  it('org staff can read any member doc in their org', async () => {
    await assertSucceeds(getDoc(doc(as('staff1'), `${P1}/members/uJudgeA`)));
    await assertSucceeds(getDoc(doc(as('staff1'), 'orgs/org1/members/staff1')));
  });

  it('member docs are not client-writable in Phase 1 (functions/seed only)', async () => {
    await assertFails(setDoc(doc(as('staff1'), `${P1}/members/uNew`), { role: 'judge', judgeId: 'jC' }));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/members/uJudgeA`), { role: 'judge', judgeId: 'jB' }));
  });
});

describe('cross-tenant isolation — the SaaS invariant', () => {
  it('foreign org staff cannot read or write another org’s data', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P1}/config/structure`), { divisions: [] });
      await setDoc(doc(ctx.firestore(), `${P1}/contestants/c1`), { fullName: 'X' });
    });
    const db = as('staff2'); // org2 staff
    await assertFails(getDoc(doc(db, `${P1}/config/structure`)));
    await assertFails(getDoc(doc(db, `${P1}/contestants/c1`)));
    await assertFails(setDoc(doc(db, `${P1}/config/scoring`), { hifz_base: 1 }));
    await assertFails(setDoc(doc(db, `${P1}/sessions/sx`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge of one competition cannot read or write another competition', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `${P2}/config/structure`), { divisions: [] });
    });
    const db = as('uJudgeA'); // comp1 judge
    await assertFails(getDoc(doc(db, `${P2}/config/structure`)));
    // even claiming their own seat id in the foreign tenant
    await assertFails(setDoc(doc(db, `${P2}/sessions/sy`), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('a judge cannot write a sibling competition in the same org', async () => {
    await assertFails(setDoc(doc(as('uJudgeA'), 'orgs/org1/competitions/comp2/sessions/sz'), { judgeId: 'jA', enrollmentId: 'e1', questions: [] }));
  });

  it('foreign staff cannot read another org’s member docs or org doc', async () => {
    await assertFails(getDoc(doc(as('staff2'), `${P1}/members/uJudgeA`)));
    await assertFails(getDoc(doc(as('staff2'), 'orgs/org1')));
  });
});

describe('unauthenticated', () => {
  it('cannot read or write anything', async () => {
    await assertFails(getDoc(doc(anon(), `${P1}/config/structure`)));
    await assertFails(setDoc(doc(anon(), `${P1}/sessions/x`), { judgeId: 'jA' }));
    await assertFails(getDoc(doc(anon(), 'orgs/org1')));
  });
});

describe('competitions listing', () => {
  it('org staff can list their competitions; foreign staff and judges cannot', async () => {
    await assertSucceeds(getDocs(collection(as('staff1'), 'orgs/org1/competitions')));
    await assertFails(getDocs(collection(as('staff2'), 'orgs/org1/competitions')));
    await assertFails(getDocs(collection(as('uJudgeA'), 'orgs/org1/competitions')));
  });

  it('a comp member can get their competition doc; foreign staff cannot', async () => {
    await assertSucceeds(getDoc(doc(as('uJudgeA'), P1)));
    await assertFails(getDoc(doc(as('staff2'), P1)));
  });
});

describe('join codes — staff-managed, secret from judges', () => {
  it('staff can create an unredeemed code and delete (revoke) one', async () => {
    await assertSucceeds(setDoc(doc(as('staff1'), `${P1}/joinCodes/NEWCODE2`), { role: 'judge', judgeId: 'jC', redeemedBy: null }));
    await assertSucceeds(deleteDoc(doc(as('staff1'), `${P1}/joinCodes/JUDGE234`)));
  });
  it('staff cannot create a pre-redeemed code and cannot update one (redeem is callable-only)', async () => {
    await assertFails(setDoc(doc(as('staff1'), `${P1}/joinCodes/SNEAKYY2`), { role: 'judge', judgeId: 'jC', redeemedBy: 'uEvil' }));
    await assertFails(updateDoc(doc(as('staff1'), `${P1}/joinCodes/JUDGE234`), { redeemedBy: 'x' }));
  });
  it('judges and foreign staff cannot read or write codes', async () => {
    await assertFails(getDoc(doc(as('uJudgeA'), `${P1}/joinCodes/JUDGE234`)));
    await assertFails(getDoc(doc(as('staff2'), `${P1}/joinCodes/JUDGE234`)));
    await assertFails(setDoc(doc(as('uJudgeA'), `${P1}/joinCodes/HACKED22`), { role: 'judge', judgeId: 'jA', redeemedBy: null }));
  });
});

describe('users mirror — read own only', () => {
  it('a user reads their own org mirror; others cannot; nobody writes client-side', async () => {
    await assertSucceeds(getDoc(doc(as('staff1'), 'users/staff1/orgs/org1')));
    await assertFails(getDoc(doc(as('staff2'), 'users/staff1/orgs/org1')));
    await assertFails(setDoc(doc(as('staff1'), 'users/staff1/orgs/org2'), { role: 'owner', name: 'X' }));
  });

  it("a user cannot list another user's org mirror", async () => {
    await assertFails(getDocs(collection(as('staff2'), 'users/staff1/orgs')));
  });
});
