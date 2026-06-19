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
