import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleZeffyWebhook, verifyZeffyRequest } from '../../src/zeffy/webhook';
import { validateIds, provisionedUid, validateRedeem, JOIN_CODE_RE } from '../../src/onboarding/logic';
import { DEFAULT_STRUCTURE_CONFIG } from '../../src/domain/structure';
import { DEFAULT_SCORING_CONFIG } from '../../src/scoring/config';

initializeApp();
const db = getFirestore();

// Zeffy payment.completed receiver. Zeffy fans EVERY form's submissions into the
// one webhook, so we verify a secret URL token (the security boundary) + match the
// event title (payload.data.description) to this competition, then write one
// immutable registration per item (idempotent via create()). The secret token is
// env (ZEFFY_TOKEN from functions/.env); the event-title filter is admin-editable
// in-app at config/zeffy { eventTitle } so renaming the event needs no redeploy.
export const zeffyWebhook = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  // Fail CLOSED if the secret isn't configured — never fall back to a permissive value.
  const expectedToken = process.env.ZEFFY_TOKEN;
  if (!expectedToken) {
    res.status(500).send('misconfigured');
    return;
  }

  const payload = req.body;
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const eventTitle = typeof payload?.data?.description === 'string' ? payload.data.description : '';

  // Token is the security boundary — reject anything without the secret (before any Firestore read).
  if (!token || token !== expectedToken) {
    res.status(403).send('forbidden');
    return;
  }

  // Only act on completed payments — refunds/failures/other event types are no-ops (200, ignored).
  if (payload?.type !== 'payment.completed') {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  // The competition filter is admin-editable in-app at config/zeffy.eventTitle.
  const cfg = await db.doc('config/zeffy').get();
  const expectedEventTitle = typeof cfg.data()?.eventTitle === 'string' ? (cfg.data()!.eventTitle as string) : '';
  if (!expectedEventTitle.trim()) {
    res.status(500).send('event title not configured');
    return;
  }
  // A non-matching title means the payload is for a different competition — ignore it (200, no-op).
  if (!verifyZeffyRequest({ token, eventTitle }, { token: expectedToken, eventTitle: expectedEventTitle })) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const result = await handleZeffyWebhook(payload, async (id, doc) => {
      // Path-injection guard: the doc id derives from attacker-controllable payment/item ids.
      // Reject anything but the safe charset (UUIDs + ':' separator) before touching Firestore.
      if (!/^[A-Za-z0-9:_-]{1,1500}$/.test(id)) throw new Error('invalid registration id');
      try {
        await db.doc(`registrations/${id}`).create({ ...doc, createdAt: FieldValue.serverTimestamp() });
        return 'written';
      } catch (err) {
        // create() throws ALREADY_EXISTS on a duplicate retry — that's the idempotent path.
        const code = (err as { code?: number | string })?.code;
        if (code === 6 || String((err as Error)?.message).includes('ALREADY_EXISTS')) return 'exists';
        throw err; // a real write failure → bubble up → 500 → Zeffy retries
      }
    });
    res.status(200).json({ ok: true, processed: result.processed });
  } catch (err) {
    console.error('zeffyWebhook', err);
    // A deterministic bad-payload error won't succeed on retry → 400 so Zeffy stops retrying.
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
  const base = `orgs/${orgId}/competitions/${compId}`;
  try {
    const result = await db.runTransaction(async (tx) => {
      const codeRef = db.doc(`${base}/joinCodes/${code}`);
      const snap = await tx.get(codeRef);
      const grant = validateRedeem(snap.exists ? (snap.data() as { role: string; judgeId?: string; redeemedBy: string | null }) : null);
      tx.set(db.doc(`${base}/members/${uid}`), grant.role === 'judge' ? { role: 'judge', judgeId: grant.judgeId } : { role: 'display' });
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
  let deviceUid: string;
  try {
    deviceUid = provisionedUid(orgId, compId, judgeId);
  } catch {
    throw new HttpsError('invalid-argument', 'ids too long for a device uid');
  }
  await db.doc(`${base}/members/${deviceUid}`).set({ role: 'judge', judgeId });
  await db.doc(`${base}/judges/${judgeId}`).set({ uid: deviceUid }, { merge: true });
  const token = await getAuth().createCustomToken(deviceUid);
  return { token };
});
