import { describe, it, expect } from 'vitest';
import { parseRegistration } from './parse-registration';
import { PAYLOAD_ALL_CATS, PAYLOAD_THREE_CATS } from './__fixtures__/payloads';

describe('parseRegistration', () => {
  it('produces one registration per item with the idempotency-key id', () => {
    const regs = parseRegistration(PAYLOAD_THREE_CATS);
    expect(regs).toHaveLength(1);
    expect(regs[0].id).toBe('b2000000-0000-4000-8000-000000000002:b2000000-0000-4000-8000-0000000000b2');
  });

  it('maps the ticket into a registration doc (no createdAt — set at write time)', () => {
    const { doc } = parseRegistration(PAYLOAD_THREE_CATS)[0];
    expect(doc.source).toBe('zeffy');
    expect(doc.kind).toBe('ticket');
    expect(doc.zeffyPaymentId).toBe('b2000000-0000-4000-8000-000000000002');
    expect(doc.zeffyItemId).toBe('b2000000-0000-4000-8000-0000000000b2');
    expect(doc.paymentStatus).toBe('succeeded');
    expect(doc.promotedContestantId).toBeNull();
    expect(doc).not.toHaveProperty('createdAt');
  });

  it('puts contestant answers in parsedFields and the purchaser in buyer', () => {
    const { doc } = parseRegistration(PAYLOAD_THREE_CATS)[0];
    const pf = doc.parsedFields as { fullName: string; categories: string[]; gender: string };
    expect(pf.fullName).toBe('Yusuf Karim');
    expect(pf.gender).toBe('male');
    expect(pf.categories).toHaveLength(3);
    expect((doc.buyer as { email: string }).email).toBe('buyer@example.com');
  });

  it('preserves the raw item verbatim (lossless master)', () => {
    const { doc } = parseRegistration(PAYLOAD_ALL_CATS)[0];
    expect((doc.rawItem as { id: string }).id).toBe('a1000000-0000-4000-8000-0000000000a1');
    expect((doc.parsedFields as { categories: string[] }).categories).toHaveLength(4);
  });
});
