import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleZeffyWebhook, verifyZeffyRequest } from '../../src/zeffy/webhook';
import { judgeClaims, adminClaims } from '../../src/auth/claims';

initializeApp();
const db = getFirestore();

// Zeffy payment.completed receiver. Verifies a secret URL token + the contest
// campaign_id, then writes one immutable registration per item (idempotent via
// create()). Env (ZEFFY_TOKEN, ZEFFY_CAMPAIGN_ID) comes from functions/.env.
export const zeffyWebhook = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  // Fail CLOSED if secrets aren't configured — never fall back to empty/permissive values.
  const expectedToken = process.env.ZEFFY_TOKEN;
  const expectedCampaign = process.env.ZEFFY_CAMPAIGN_ID;
  if (!expectedToken || !expectedCampaign) {
    res.status(500).send('misconfigured');
    return;
  }

  const payload = req.body;
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const campaignId = typeof payload?.data?.campaign_id === 'string' ? payload.data.campaign_id : '';

  // Reject empty token/campaign before comparing, then verify against the configured secrets.
  if (!token || !campaignId || !verifyZeffyRequest({ token, campaignId }, { token: expectedToken, campaignId: expectedCampaign })) {
    res.status(403).send('forbidden');
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
  } catch {
    res.status(500).send('error');
  }
});

// Mint a judge custom token (uid == judgeId, role claims) so an admin can
// provision a device. Admin-only; the client signs in with the returned token.
export const mintJudgeToken = onCall({ region: 'us-central1', invoker: 'public' }, async (req) => {
  if (req.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'admin only');
  const judgeId = (req.data as { judgeId?: unknown })?.judgeId;
  if (typeof judgeId !== 'string' || !judgeId) throw new HttpsError('invalid-argument', 'judgeId required');
  const token = await getAuth().createCustomToken(judgeId, judgeClaims(judgeId));
  return { token };
});

// One-time bootstrap: set the {admin:true} claim on an existing user by email.
// Secret-guarded (ADMIN_BOOTSTRAP_TOKEN in functions/.env) — no admin claim exists yet
// to gate it, so it cannot be a callable. Used once for the first organizer account.
export const bootstrapAdmin = onRequest({ region: 'us-central1', invoker: 'public' }, async (req, res) => {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expected || req.query.token !== expected) {
    res.status(403).send('forbidden');
    return;
  }
  const email = typeof req.query.email === 'string' ? req.query.email : '';
  if (!email) {
    res.status(400).send('email required');
    return;
  }
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, adminClaims());
    res.status(200).json({ ok: true, uid: user.uid });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err as Error)?.message) });
  }
});
