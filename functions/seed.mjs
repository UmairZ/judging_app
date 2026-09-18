// Seeds the local Firebase emulator with fake contest data + an admin user.
// Run with the emulator hosts set, e.g.:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8180 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node functions/seed.mjs
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
// v3 shape (2026-09-18) — mirrors src/scoring DEFAULT_SCORING_CONFIG at the
// escalating system, since that's what the demo comp exercises.
const SCORING = {
  model: 'escalating-v3',
  voice_max: 5,
  raw: {
    costs: { hesitation: 0, prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
    voice_worth: 5,
  },
  percent: {
    weights: { hifz: 70, tajweed: 25, voice: 5 },
    costs: { prompted: 10, unable: 20, tajweed_major: 10, tajweed_minor: 5 },
    escalation_step: 10,
  },
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
  await db.doc(p('config/questions')).set({ passage_lines: 7 });

  // ── question pools + one hand-written set (category 5) ───────────────────
  // Pool rows are PoolRow shape ({surah, ayah, ref, text}); the set's rows also
  // carry the juz/crosses enrichment the portal's assignment writes. Real short
  // ayat, refs verified against the mushaf (juz noted per row below).
  const pr = (surah, ayah, ref, text) => ({ surah, ayah, ref, text });
  const POOL_5_BEGIN = [
    pr(1, 1, 'الفاتحة 1:1', 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ'), // juz 1
    pr(2, 60, 'البقرة 2:60', 'وَإِذِ اسْتَسْقَىٰ مُوسَىٰ لِقَوْمِهِ'), // juz 1
    pr(2, 155, 'البقرة 2:155', 'وَلَنَبْلُوَنَّكُم بِشَيْءٍ مِّنَ الْخَوْفِ وَالْجُوعِ'), // juz 2
    pr(2, 255, 'البقرة 2:255', 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ'), // juz 3
    pr(3, 110, 'آل عمران 3:110', 'كُنتُمْ خَيْرَ أُمَّةٍ أُخْرِجَتْ لِلنَّاسِ'), // juz 4
    pr(4, 36, 'النساء 4:36', 'وَاعْبُدُوا اللَّهَ وَلَا تُشْرِكُوا بِهِ شَيْئًا'), // juz 5
  ];
  const POOL_5_END = [
    pr(46, 13, 'الأحقاف 46:13', 'إِنَّ الَّذِينَ قَالُوا رَبُّنَا اللَّهُ ثُمَّ اسْتَقَامُوا'), // juz 26
    pr(55, 1, 'الرحمن 55:1', 'الرَّحْمَٰنُ'), // juz 27
    pr(58, 11, 'المجادلة 58:11', 'يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا قِيلَ لَكُمْ تَفَسَّحُوا فِي الْمَجَالِسِ'), // juz 28
    pr(67, 1, 'الملك 67:1', 'تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ'), // juz 29
    pr(78, 31, 'النبأ 78:31', 'إِنَّ لِلْمُتَّقِينَ مَفَازًا'), // juz 30
    pr(112, 1, 'الإخلاص 112:1', 'قُلْ هُوَ اللَّهُ أَحَدٌ'), // juz 30
  ];
  await db.doc(p('questionPools/5_begin')).set({
    categoryId: '5', side: 'begin', range: [1, 5], rows: POOL_5_BEGIN,
    uploadedAt: FieldValue.serverTimestamp(), uploadedBy: 'seed',
  });
  await db.doc(p('questionPools/5_end')).set({
    categoryId: '5', side: 'end', range: [26, 30], rows: POOL_5_END,
    uploadedAt: FieldValue.serverTimestamp(), uploadedBy: 'seed',
  });
  // One hand-written questionSet (enrollment fatima_5, minQuestions 4 per side)
  // so the judge reveal exercises without running assignment first.
  const enrich = (row, juz) => ({ ...row, juz, crosses: false });
  await db.doc(p('questionSets/fatima_5')).set({
    enrollmentId: 'fatima_5',
    begin: [enrich(POOL_5_BEGIN[0], 1), enrich(POOL_5_BEGIN[2], 2), enrich(POOL_5_BEGIN[3], 3), enrich(POOL_5_BEGIN[5], 5)],
    end: [enrich(POOL_5_END[0], 26), enrich(POOL_5_END[1], 27), enrich(POOL_5_END[3], 29), enrich(POOL_5_END[5], 30)],
    beginLabel: 'Juz 1–5',
    endLabel: 'Juz 26–30',
    assignedAt: FieldValue.serverTimestamp(),
    assignedBy: 'seed',
  });

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

  console.log('seed complete: tenant demo/2026, 3 contestants in (5·sisters), 8 sessions, 1 pending registration, admin + 4 judges, join codes JUDGE234 (judge j4) + SCREEN22 (display), question pools 5_begin/5_end + set for fatima_5');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
