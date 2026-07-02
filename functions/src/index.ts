import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleZeffyWebhook, verifyZeffyRequest, tenantFromWebhookPath } from '../../src/zeffy/webhook';
import { validateIds, provisionedUid, validateRedeem, JOIN_CODE_RE } from '../../src/onboarding/logic';
import { DEFAULT_STRUCTURE_CONFIG } from '../../src/domain/structure';
import { DEFAULT_SCORING_CONFIG } from '../../src/scoring/config';

initializeApp();
const db = getFirestore();

// Zeffy payment.completed receiver, per-tenant: the URL path names the competition
// (/zeffy/{orgId}/{compId}) and the secret token + event-title filter live in that
// competition's config/zeffy doc ({ token, eventTitle }, admin-managed in-app).
// Fails CLOSED when the competition has no token configured.
export const zeffyWebhook = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  const tenant = tenantFromWebhookPath(req.path);
  if (!tenant) {
    res.status(404).send('unknown tenant');
    return;
  }
  const base = `orgs/${tenant.orgId}/competitions/${tenant.compId}`;

  const cfg = (await db.doc(`${base}/config/zeffy`).get()).data() ?? {};
  const expectedToken = typeof cfg.token === 'string' ? cfg.token : '';
  const expectedEventTitle = typeof cfg.eventTitle === 'string' ? cfg.eventTitle : '';
  if (!expectedToken) {
    res.status(403).send('forbidden'); // fail closed: no token configured for this competition
    return;
  }
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token || token !== expectedToken) {
    res.status(403).send('forbidden');
    return;
  }

  const payload = req.body;
  if (payload?.type !== 'payment.completed') {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }
  if (!expectedEventTitle.trim()) {
    res.status(500).send('event title not configured');
    return;
  }
  const eventTitle = typeof payload?.data?.description === 'string' ? payload.data.description : '';
  if (!verifyZeffyRequest({ token, eventTitle }, { token: expectedToken, eventTitle: expectedEventTitle })) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const result = await handleZeffyWebhook(payload, async (id, doc) => {
      // Path-injection guard: the doc id derives from attacker-controllable payment/item ids.
      if (!/^[A-Za-z0-9:_-]{1,1500}$/.test(id)) throw new Error('invalid registration id');
      try {
        await db.doc(`${base}/registrations/${id}`).create({ ...doc, createdAt: FieldValue.serverTimestamp() });
        return 'written';
      } catch (err) {
        const code = (err as { code?: number | string })?.code;
        if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) return 'exists';
        throw err;
      }
    });
    res.status(200).json({ ok: true, processed: result.processed });
  } catch (err) {
    console.error('zeffyWebhook', err);
    if (err instanceof Error && err.message === 'invalid registration id') {
      res.status(400).send('bad request');
      return;
    }
    res.status(500).send('error');
  }
});

const REGION = { region: 'us-central1', invoker: 'public' } as const;

function requireAuth(req: { auth?: { uid: string } | null }): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'sign in first');
  return req.auth.uid;
}

async function requireOrgStaff(uid: string, orgId: string): Promise<void> {
  const m = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  const role = m.data()?.role;
  if (role !== 'owner' && role !== 'admin') throw new HttpsError('permission-denied', 'org staff only');
}

// Create an org + owner membership + dashboard mirror, atomically. Fails if the id is taken.
export const createOrg = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  // Anonymous accounts are for join codes; org creation needs a real account (App Check lands later).
  if ((req.auth?.token as { firebase?: { sign_in_provider?: string } })?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', 'create an account (email or Google) to start an organization');
  }
  const { orgId, name } = (req.data ?? {}) as { orgId?: unknown; name?: unknown };
  if (typeof orgId !== 'string' || typeof name !== 'string' || !validateIds(orgId) || !name.trim()) {
    throw new HttpsError('invalid-argument', 'invalid org id or name');
  }
  try {
    const batch = db.batch();
    batch.create(db.doc(`orgs/${orgId}`), { name: name.trim(), ownerUid: uid, plan: 'free', createdAt: FieldValue.serverTimestamp() });
    batch.set(db.doc(`orgs/${orgId}/members/${uid}`), { role: 'owner' });
    batch.set(db.doc(`users/${uid}/orgs/${orgId}`), { role: 'owner', name: name.trim() });
    await batch.commit();
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) {
      throw new HttpsError('already-exists', 'that org id is taken');
    }
    throw err;
  }
  return { orgId };
});

// Create a competition with default config docs. Caller must be org staff.
export const createCompetition = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, name } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof name !== 'string' || !validateIds(orgId, compId) || !name.trim()) {
    throw new HttpsError('invalid-argument', 'invalid ids or name');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  try {
    const batch = db.batch();
    batch.create(db.doc(base), { name: name.trim(), status: 'setup', createdAt: FieldValue.serverTimestamp() });
    batch.set(db.doc(`${base}/config/structure`), DEFAULT_STRUCTURE_CONFIG);
    batch.set(db.doc(`${base}/config/scoring`), DEFAULT_SCORING_CONFIG);
    await batch.commit();
  } catch (err) {
    const code = (err as { code?: number | string })?.code;
    if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) {
      throw new HttpsError('already-exists', 'that competition id is taken');
    }
    throw err;
  }
  return { compId };
});

// Redeem a join code: transactionally consume the code and write the member doc.
export const redeemJoinCode = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, code } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof code !== 'string' || !validateIds(orgId, compId) || !JOIN_CODE_RE.test(code)) {
    throw new HttpsError('invalid-argument', 'invalid join request');
  }
  // Staff don't need seats — and letting them redeem burns the code for the real judge.
  const callerOrg = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  const callerRole = callerOrg.data()?.role;
  if (callerRole === 'owner' || callerRole === 'admin') {
    throw new HttpsError('failed-precondition', 'organizers open competitions from the dashboard — codes are for judges and displays');
  }
  const base = `orgs/${orgId}/competitions/${compId}`;
  try {
    const result = await db.runTransaction(async (tx) => {
      const codeRef = db.doc(`${base}/joinCodes/${code}`);
      const memberRef = db.doc(`${base}/members/${uid}`);
      const snap = await tx.get(codeRef);
      const existingMember = await tx.get(memberRef);
      if (existingMember.exists) throw new Error('already-member');
      const grant = validateRedeem(snap.exists ? (snap.data() as { role: string; judgeId?: string; redeemedBy: string | null }) : null);
      tx.set(memberRef, grant.role === 'judge' ? { role: 'judge', judgeId: grant.judgeId } : { role: 'display' });
      if (grant.judgeId) tx.set(db.doc(`${base}/judges/${grant.judgeId}`), { uid }, { merge: true });
      tx.update(codeRef, { redeemedBy: uid, redeemedAt: FieldValue.serverTimestamp() });
      return grant;
    });
    return result;
  } catch (err) {
    const msg = (err as Error)?.message;
    if (msg === 'not-found') throw new HttpsError('not-found', 'code not recognized');
    if (msg === 'already-redeemed') throw new HttpsError('failed-precondition', 'code already used');
    if (msg === 'corrupt-code') throw new HttpsError('failed-precondition', 'code is invalid');
    if (msg === 'already-member') throw new HttpsError('failed-precondition', 'this device already has a role in this competition');
    throw err;
  }
});

// Provision a device for a judge seat (org-supplied hardware). Tenant-scoped, no custom claims:
// the minted uid's authority comes entirely from the member doc written here.
export const mintJudgeToken = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, judgeId } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof judgeId !== 'string' || !validateIds(orgId, compId, judgeId)) {
    throw new HttpsError('invalid-argument', 'invalid ids');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  const seat = await db.doc(`${base}/judges/${judgeId}`).get();
  if (!seat.exists) throw new HttpsError('not-found', 'unknown judge seat');

  // Provisioning claims the seat: outstanding invitations for it are stale — delete them
  // so an old link can't later re-bind the seat to a different device.
  const stale = await db.collection(`${base}/joinCodes`).where('judgeId', '==', judgeId).get();
  if (!stale.empty) {
    const cleanup = db.batch();
    stale.docs.forEach((d) => cleanup.delete(d.ref));
    await cleanup.commit();
  }

  let deviceUid: string;
  try {
    deviceUid = provisionedUid(orgId, compId, judgeId);
  } catch {
    throw new HttpsError('invalid-argument', 'ids invalid for a device uid');
  }
  await db.doc(`${base}/members/${deviceUid}`).set({ role: 'judge', judgeId });
  await db.doc(`${base}/judges/${judgeId}`).set({ uid: deviceUid }, { merge: true });
  const token = await getAuth().createCustomToken(deviceUid);
  return { token };
});

// Kick a competition member (judge/display): delete their membership, free the seat,
// and delete any codes they redeemed so the seat can be re-issued. Org staff are
// managed elsewhere — this callable refuses to touch them.
export const removeMember = onCall(REGION, async (req) => {
  const uid = requireAuth(req);
  const { orgId, compId, memberUid } = (req.data ?? {}) as Record<string, unknown>;
  if (typeof orgId !== 'string' || typeof compId !== 'string' || typeof memberUid !== 'string' || !validateIds(orgId, compId, memberUid)) {
    throw new HttpsError('invalid-argument', 'invalid ids');
  }
  await requireOrgStaff(uid, orgId);
  const base = `orgs/${orgId}/competitions/${compId}`;
  const memberRef = db.doc(`${base}/members/${memberUid}`);
  const member = await memberRef.get();
  if (!member.exists) throw new HttpsError('not-found', 'not a member of this competition');
  const role = member.data()?.role;
  if (role !== 'judge' && role !== 'display') {
    throw new HttpsError('failed-precondition', 'only judge and display members can be removed here');
  }
  const judgeId = member.data()?.judgeId;
  const redeemed = await db.collection(`${base}/joinCodes`).where('redeemedBy', '==', memberUid).get();

  // Also delete any outstanding (unredeemed) codes for this seat so the seat can be re-issued
  let outstanding: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null = null;
  if (typeof judgeId === 'string' && judgeId) {
    outstanding = await db.collection(`${base}/joinCodes`).where('judgeId', '==', judgeId).get();
  }

  const batch = db.batch();
  batch.delete(memberRef);
  if (typeof judgeId === 'string' && judgeId) {
    batch.set(db.doc(`${base}/judges/${judgeId}`), { uid: FieldValue.delete() }, { merge: true });
  }
  redeemed.docs.forEach((d) => batch.delete(d.ref));
  if (outstanding) {
    outstanding.docs.forEach((d) => batch.delete(d.ref));
  }
  await batch.commit();
  return { removed: true };
});
