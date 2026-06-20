import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { handleZeffyWebhook, verifyZeffyRequest } from '../../src/zeffy/webhook';
import { judgeClaims } from '../../src/auth/claims';

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
  } catch {
    res.status(500).send('error');
  }
});

// Mint a judge custom token (uid == judgeId, role claims) so an admin can
// provision a device. Admin-only; the client signs in with the returned token.
export const mintJudgeToken = onCall({ region: 'us-central1', invoker: 'public' }, async (req) => {
  if (req.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'admin only');
  const judgeId = (req.data as { judgeId?: unknown })?.judgeId;
  // Constrain to a safe uid charset, and only mint for a judge that actually exists.
  if (typeof judgeId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(judgeId)) {
    throw new HttpsError('invalid-argument', 'invalid judgeId');
  }
  const snap = await db.doc(`judges/${judgeId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'unknown judge');
  const token = await getAuth().createCustomToken(judgeId, judgeClaims(judgeId));
  return { token };
});
