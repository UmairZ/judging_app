import type { RegistrationDoc } from '../data/types';
import type { ZeffyPayload } from './types';
import { parseRegistration } from './parse-registration';

export function verifyZeffyRequest(
  provided: { token: string | null; campaignId: string },
  expected: { token: string; campaignId: string },
): boolean {
  // ponytail: plain === on a high-entropy URL token over HTTPS. Swap to an HMAC if Zeffy ever signs.
  return provided.token === expected.token && provided.campaignId === expected.campaignId;
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
