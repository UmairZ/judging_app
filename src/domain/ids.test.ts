import { describe, it, expect } from 'vitest';
import { enrollmentId, registrationId } from './ids';

describe('deterministic ids', () => {
  it('enrollmentId joins contestant and category with an underscore', () => {
    expect(enrollmentId('c123', '15')).toBe('c123_15');
  });

  it('registrationId joins payment and item with a colon', () => {
    expect(registrationId('pay_1', 'item_1')).toBe('pay_1:item_1');
  });

  it('is stable for the same inputs (idempotent doc id)', () => {
    expect(registrationId('p', 'i')).toBe(registrationId('p', 'i'));
  });
});
