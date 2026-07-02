import type { RegistrationDoc } from '../data/types';
import type { ZeffyPayload } from './types';
import { parseRegistration } from './parse-registration';
import { SEG } from '../tenant/paths';

export function verifyZeffyRequest(
  provided: { token: string | null; eventTitle: string },
  expected: { token: string; eventTitle: string },
): boolean {
  // ponytail: plain === on a high-entropy URL token over HTTPS. Swap to an HMAC if Zeffy ever signs.
  // Token is the security boundary; eventTitle (Zeffy `description`) selects which competition.
  return provided.token === expected.token && provided.eventTitle.trim() === expected.eventTitle.trim();
}

/** Tenant from a webhook request path — the trailing two segments of /zeffy/{orgId}/{compId}. */
export function tenantFromWebhookPath(path: string): { orgId: string; compId: string } | null {
  const segs = path.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  const orgId = segs[segs.length - 2];
  const compId = segs[segs.length - 1];
  if (!SEG.test(orgId) || !SEG.test(compId)) return null;
  return { orgId, compId };
}

export type RegistrationWriter = (
  id: string,
  doc: Omit<RegistrationDoc, 'createdAt'>,
) => Promise<'written' | 'exists'>;

export async function handleZeffyWebhook(
  payload: ZeffyPayload,
  write: RegistrationWriter,
): Promise<{ processed: number; results: { id: string; kind: string; result: 'written' | 'exists' }[] }> {
  const regs = parseRegistration(payload);
  const results = [];
  for (const { id, doc } of regs) {
    const result = await write(id, doc);
    results.push({ id, kind: doc.kind, result });
  }
  return { processed: results.length, results };
}
