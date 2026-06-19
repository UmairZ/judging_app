// Seeds the local Firebase emulator with fake contest data + an admin user.
// Run with the emulator hosts set, e.g.:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node functions/seed.mjs
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ projectId: 'ibn-katheer-judging-bc25d' });
const db = getFirestore();
const auth = getAuth();

const STRUCTURE = {
  divisions: [
    { id: 'brothers', label: 'Brothers' },
    { id: 'sisters', label: 'Sisters' },
    { id: 'combined', label: 'Combined' },
  ],
  categories: [
    { id: '1', label: "1 Juz'", minQuestions: 3, divisions: ['brothers', 'sisters'], zeffyLabels: ['1 Juz (Ages 13 and Under)'] },
    { id: '5', label: "5 Ajzā'", minQuestions: 4, divisions: ['brothers', 'sisters'], zeffyLabels: ['5 Juz (Ages 20 and Under)'] },
    { id: '15', label: "15 Ajzā'", minQuestions: 5, divisions: ['combined'], zeffyLabels: ['15 Juz (Ages 27 and Under)'] },
    { id: '30', label: "30 Ajzā'", minQuestions: 6, divisions: ['combined'], zeffyLabels: ['30 Juz (Ages 35 and Under)'] },
  ],
};
const SCORING = {
  weights: { hifz: 70, tajweed: 25, voice: 5 },
  hifz_base: 10, tajweed_base: 10, voice_max: 5,
  hifz_deductions: { prompted_fixed: 1, prompted_failed: 2 },
  tajweed_deductions: { major: 1, minor: 0.5 },
};

const ev = (type, n) => Array.from({ length: n }, () => ({ type, ts: '2026-06-18T00:00:00.000Z' }));
const q = (index, { pf = 0, pfail = 0, tmaj = 0, tmin = 0, voice = null, dq = false } = {}) => ({
  index, isAdded: false, isTieBreak: false, disqualified: dq, voice,
  events: [...ev('prompted_fixed', pf), ...ev('prompted_failed', pfail), ...ev('tajweed_major', tmaj), ...ev('tajweed_minor', tmin)],
});

async function main() {
  await db.doc('config/structure').set(STRUCTURE);
  await db.doc('config/scoring').set(SCORING);

  await db.doc('judges/j1').set({ name: 'Ustadha Maryam', active: true });
  await db.doc('judges/j2').set({ name: 'Ustadha Sara', active: true });
  await db.doc('judges/j3').set({ name: 'Ustadha Huda', active: true });
  await db.doc('panels/sisters').set({ name: "Sisters' Panel", judgeIds: ['j1', 'j2', 'j3'] });
  await db.doc('assignments/5_sisters').set({ category: '5', division: 'sisters', panelId: 'sisters' });

  const people = [
    { id: 'fatima', name: 'Fatima Noor' },
    { id: 'khadija', name: 'Khadija Omar' },
    { id: 'aisha', name: 'Aisha Siddiqua' },
  ];
  for (const p of people) {
    await db.doc(`contestants/${p.id}`).set({ fullName: p.name, gender: 'female', photoUrl: null, registrationId: null, fields: {}, active: true });
    await db.doc(`enrollments/${p.id}_5`).set({ contestantId: p.id, category: '5', division: 'sisters' });
  }
  // a pending (un-promoted) registration so the Registrations screen has content
  await db.doc('registrations/demoPay:demoItem').set({
    source: 'zeffy', zeffyPaymentId: 'demoPay', zeffyItemId: 'demoItem', kind: 'ticket',
    buyer: { email: 'parent@example.com' }, rawItem: {}, paymentStatus: 'succeeded',
    parsedFields: { fullName: 'Sumayya Idris', gender: 'female', dateOfBirth: '2009-05-01', categories: ['1 Juz (Ages 13 and Under)'] },
    createdAt: FieldValue.serverTimestamp(), promotedContestantId: null,
  });

  const mk = (enr, judge, qs) => db.doc(`sessions/${enr}__${judge}`).set({ enrollmentId: enr, judgeId: judge, questions: qs, updatedAt: FieldValue.serverTimestamp(), finalizedAt: null });
  for (const j of ['j1', 'j2', 'j3']) await mk('fatima_5', j, [q(0, { pf: 1, tmin: 1, voice: 4 }), q(1, { tmin: 1, voice: 5 }), q(2, { pf: 1, voice: 4 }), q(3, { voice: 5 })]);
  for (const j of ['j1', 'j2', 'j3']) await mk('khadija_5', j, [q(0, { pfail: 1, tmaj: 1, voice: 3 }), q(1, { pf: 2, voice: 3 }), q(2, { tmaj: 2, voice: 4 }), q(3, { pf: 1, tmin: 2, voice: 3 })]);
  for (const j of ['j1', 'j2']) await mk('aisha_5', j, [q(0, { pfail: 2, tmaj: 2, voice: 2 }), q(1, { pf: 1, voice: 3 }), q(2, { pfail: 1, voice: 3 }), q(3, { tmin: 1, voice: 4 })]);

  const admin = await auth.createUser({ email: 'admin@ibnkatheer.local', password: 'admin123' }).catch(() => auth.getUserByEmail('admin@ibnkatheer.local'));
  await auth.setCustomUserClaims(admin.uid, { admin: true });

  // Judge auth users — uid == judgeId, so session writes pass the per-judge rule. Sign in jX@judge.local / judge123.
  for (const jid of ['j1', 'j2', 'j3']) {
    const ju = await auth.createUser({ uid: jid, email: `${jid}@judge.local`, password: 'judge123' }).catch(() => auth.getUser(jid));
    await auth.setCustomUserClaims(ju.uid, { role: 'judge', judgeId: jid });
  }

  console.log('seed complete: 3 contestants in (5·sisters), 8 sessions, 1 pending registration, admin user');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
