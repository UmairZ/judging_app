import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ibn-katheer',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const judge = (id: string) => env.authenticatedContext(id, { role: 'judge', judgeId: id }).firestore();
const admin = () => env.authenticatedContext('admin1', { admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

describe('sessions — one writer per doc', () => {
  it('a judge can create their own session', async () => {
    const db = judge('judgeA');
    await assertSucceeds(setDoc(doc(db, 'sessions/s1'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot create a session owned by another judge", async () => {
    const db = judge('judgeA');
    await assertFails(setDoc(doc(db, 'sessions/s2'), { judgeId: 'judgeB', enrollmentId: 'e1', questions: [] }));
  });

  it("a judge cannot update another judge's session", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s3'), { judgeId: 'judgeB', enrollmentId: 'e1', questions: [] });
    });
    const db = judge('judgeA');
    await assertFails(updateDoc(doc(db, 'sessions/s3'), { enrollmentId: 'changed' }));
  });

  it('nobody can delete a session', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s4'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(deleteDoc(doc(judge('judgeA'), 'sessions/s4')));
  });

  it('not even an admin can delete a session', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s4b'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(deleteDoc(doc(admin(), 'sessions/s4b')));
  });

  it('a judge cannot hand off their own session to another judge', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'sessions/s5'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] });
    });
    await assertFails(updateDoc(doc(judge('judgeA'), 'sessions/s5'), { judgeId: 'judgeB' }));
  });

  it("an admin can create and update any judge's session (correct-marks feature)", async () => {
    const db = admin();
    await assertSucceeds(setDoc(doc(db, 'sessions/s6'), { judgeId: 'judgeA', enrollmentId: 'e1', questions: [] }));
    await assertSucceeds(updateDoc(doc(db, 'sessions/s6'), { finalizedAt: 'now' }));
  });
});

describe('admin-only collections', () => {
  it('a judge cannot write config', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'config/scoring'), { hifz_base: 9 }));
  });

  it('an admin can write config', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'config/scoring'), { hifz_base: 9 }));
  });

  it('a judge can read config (needed for their queue)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config/structure'), { divisions: [] });
    });
    await assertSucceeds(getDoc(doc(judge('judgeA'), 'config/structure')));
  });

  it('a judge cannot write contestants', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'contestants/c1'), { fullName: 'X' }));
  });
});

describe('registrations — immutable master', () => {
  it('an admin can create a registration', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'registrations/p1:i1'), { source: 'manual' }));
  });

  it('a judge cannot create a registration', async () => {
    await assertFails(setDoc(doc(judge('judgeA'), 'registrations/p1:i2'), { source: 'manual' }));
  });

  it('nobody (even admin) can update or delete a registration', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'registrations/p1:i3'), { source: 'zeffy' });
    });
    await assertFails(updateDoc(doc(admin(), 'registrations/p1:i3'), { source: 'manual' }));
    await assertFails(deleteDoc(doc(admin(), 'registrations/p1:i3')));
  });

  it('a judge cannot read a registration', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'registrations/p1:i9'), { source: 'zeffy' });
    });
    await assertFails(getDoc(doc(judge('judgeA'), 'registrations/p1:i9')));
  });
});

describe('unauthenticated', () => {
  it('cannot read or write anything', async () => {
    await assertFails(getDoc(doc(anon(), 'config/structure')));
    await assertFails(setDoc(doc(anon(), 'sessions/x'), { judgeId: 'x' }));
  });
});
