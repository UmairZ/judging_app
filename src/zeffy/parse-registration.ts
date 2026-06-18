import type { RegistrationDoc } from '../data/types';
import { registrationId } from '../domain/ids';
import type { ZeffyPayload } from './types';
import { classifyItem, parseQuestions } from './parse-questions';

export interface ParsedRegistration {
  id: string;
  doc: Omit<RegistrationDoc, 'createdAt'>;
}

export function parseRegistration(payload: ZeffyPayload): ParsedRegistration[] {
  const { data } = payload;
  return data.items.map((item) => ({
    id: registrationId(data.id, item.id),
    doc: {
      source: 'zeffy',
      zeffyPaymentId: data.id,
      zeffyItemId: item.id,
      kind: classifyItem(item.type),
      buyer: data.buyer,
      rawItem: item as unknown as Record<string, unknown>,
      parsedFields: parseQuestions(item.questions) as unknown as Record<string, unknown>,
      paymentStatus: data.status,
      promotedContestantId: null,
    },
  }));
}
