// Seeds the local Firebase emulator with fake contest data + an admin user.
// Run with the emulator hosts set, e.g.:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node functions/seed.mjs
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Refuse to run outside the emulator: without these vars, firebase-admin would
// use real credentials and write demo data into a live project.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('seed.mjs is emulator-only. Set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST (see README).');
  process.exit(1);
}
initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-ubayy' });
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
  model: 'deduction-v1',
};

const ev = (type, n) => Array.from({ length: n }, () => ({ type, ts: '2026-06-18T00:00:00.000Z' }));
const q = (index, { pf = 0, pfail = 0, tmaj = 0, tmin = 0, voice = null, dq = false } = {}) => ({
  index, isAdded: false, isTieBreak: false, disqualified: dq, voice,
  events: [...ev('prompted_fixed', pf), ...ev('prompted_failed', pfail), ...ev('tajweed_major', tmaj), ...ev('tajweed_minor', tmin)],
});

const BASE = 'orgs/demo/competitions/2026';
const p = (rel) => `${BASE}/${rel}`;

async function main() {
  // ── auth users (no custom claims — authorization is member docs) ─────────
  const admin = await auth.createUser({ email: 'admin@ibnkatheer.local', password: 'admin123' }).catch(() => auth.getUserByEmail('admin@ibnkatheer.local'));
  for (const jid of ['j1', 'j2', 'j3']) {
    await auth.createUser({ uid: jid, email: `${jid}@judge.local`, password: 'judge123' }).catch(() => auth.getUser(jid));
  }

  // ── tenant shell ──────────────────────────────────────────────────────────
  await db.doc('orgs/demo').set({ name: 'Demo Organization', ownerUid: admin.uid, plan: 'free', createdAt: FieldValue.serverTimestamp() });
  await db.doc(`orgs/demo/members/${admin.uid}`).set({ role: 'owner' });
  await db.doc(`users/${admin.uid}/orgs/demo`).set({ role: 'owner', name: 'Demo Organization' });
  await db.doc(BASE).set({ name: '2026 Ibn Katheer Quran Competition', status: 'live', createdAt: FieldValue.serverTimestamp() });
  // judge auth uid == seat id here for convenience; the member doc binding is what the rules check
  for (const jid of ['j1', 'j2', 'j3']) {
    await db.doc(p(`members/${jid}`)).set({ role: 'judge', judgeId: jid });
  }

  // ── competition data (same demo content, nested paths) ───────────────────
  await db.doc(p('config/structure')).set(STRUCTURE);
  await db.doc(p('config/scoring')).set(SCORING);
  await db.doc(p('config/zeffy')).set({ eventTitle: '2026 Ibn Katheer Quran Competition' });

  await db.doc(p('judges/j1')).set({ name: 'Ustadha Maryam', active: true });
  await db.doc(p('judges/j2')).set({ name: 'Ustadha Sara', active: true });
  await db.doc(p('judges/j3')).set({ name: 'Ustadha Huda', active: true });
  await db.doc(p('judges/j4')).set({ name: 'Ustadha Zaynab', active: true });
  await db.doc(p('panels/sisters')).set({ name: "Sisters' Panel", judgeIds: ['j1', 'j2', 'j3', 'j4'] });
  await db.doc(p('joinCodes/JUDGE234')).set({ role: 'judge', judgeId: 'j4', redeemedBy: null, createdAt: FieldValue.serverTimestamp() });
  await db.doc(p('joinCodes/SCREEN22')).set({ role: 'display', redeemedBy: null, createdAt: FieldValue.serverTimestamp() });
  await db.doc(p('assignments/5_sisters')).set({ category: '5', division: 'sisters', panelId: 'sisters' });

  const people = [
    { id: 'fatima', name: 'Fatima Noor' },
    { id: 'khadija', name: 'Khadija Omar' },
    { id: 'aisha', name: 'Aisha Siddiqua' },
  ];
  for (const per of people) {
    await db.doc(p(`contestants/${per.id}`)).set({ fullName: per.name, gender: 'female', photoUrl: null, registrationId: null, fields: {}, active: true });
    await db.doc(p(`enrollments/${per.id}_5`)).set({ contestantId: per.id, category: '5', division: 'sisters', round: 'main' });
  }
  await db.doc(p('registrations/demoPay:demoItem')).set({
    source: 'zeffy', zeffyPaymentId: 'demoPay', zeffyItemId: 'demoItem', kind: 'ticket',
    buyer: { email: 'parent@example.com' }, rawItem: {}, paymentStatus: 'succeeded',
    parsedFields: { fullName: 'Sumayya Idris', gender: 'female', dateOfBirth: '2009-05-01', categories: ['1 Juz (Ages 13 and Under)'] },
    createdAt: FieldValue.serverTimestamp(), promotedContestantId: null,
  });

  const mk = (enr, judge, qs) => db.doc(p(`sessions/${enr}__${judge}`)).set({ enrollmentId: enr, judgeId: judge, questions: qs, round: 'main', updatedAt: FieldValue.serverTimestamp(), finalizedAt: null });
  for (const j of ['j1', 'j2', 'j3']) await mk('fatima_5', j, [q(0, { pf: 1, tmin: 1, voice: 4 }), q(1, { tmin: 1, voice: 5 }), q(2, { pf: 1, voice: 4 }), q(3, { voice: 5 })]);
  for (const j of ['j1', 'j2', 'j3']) await mk('khadija_5', j, [q(0, { pfail: 1, tmaj: 1, voice: 3 }), q(1, { pf: 2, voice: 3 }), q(2, { tmaj: 2, voice: 4 }), q(3, { pf: 1, tmin: 2, voice: 3 })]);
  for (const j of ['j1', 'j2']) await mk('aisha_5', j, [q(0, { pfail: 2, tmaj: 2, voice: 2 }), q(1, { pf: 1, voice: 3 }), q(2, { pfail: 1, voice: 3 }), q(3, { tmin: 1, voice: 4 })]);

  console.log('seed complete: tenant demo/2026, 3 contestants in (5·sisters), 8 sessions, 1 pending registration, admin + 4 judges, join codes JUDGE234 (judge j4) + SCREEN22 (display)');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
