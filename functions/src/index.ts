import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { handleZeffyWebhook, verifyZeffyRequest } from '../../src/zeffy/webhook';

initializeApp();
const db = getFirestore();

// Zeffy payment.completed receiver. Verifies a secret URL token + the contest
// campaign_id, then writes one immutable registration per item (idempotent via
// create()). Env (ZEFFY_TOKEN, ZEFFY_CAMPAIGN_ID) comes from functions/.env.
export const zeffyWebhook = onRequest({ region: 'us-central1' }, async (req, res) => {
  const expected = {
    token: process.env.ZEFFY_TOKEN ?? '',
    campaignId: process.env.ZEFFY_CAMPAIGN_ID ?? '',
  };
  const payload = req.body;
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const campaignId = payload?.data?.campaign_id ?? '';

  if (!verifyZeffyRequest({ token, campaignId }, expected)) {
    res.status(403).send('forbidden');
    return;
  }

  try {
    const result = await handleZeffyWebhook(payload, async (id, doc) => {
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
