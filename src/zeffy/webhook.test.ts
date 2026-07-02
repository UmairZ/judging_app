import { describe, it, expect } from 'vitest';
import { verifyZeffyRequest, handleZeffyWebhook, tenantFromWebhookPath, type RegistrationWriter } from './webhook';
import { PAYLOAD_THREE_CATS } from './__fixtures__/payloads';
import type { RegistrationDoc } from '../data/types';

const EXPECTED = { token: 'secret-123', eventTitle: '2026 Ibn Katheer Quran Competition' };

describe('verifyZeffyRequest', () => {
  it('accepts the right token and event title', () => {
    expect(verifyZeffyRequest({ token: 'secret-123', eventTitle: EXPECTED.eventTitle }, EXPECTED)).toBe(true);
  });
  it('tolerates surrounding whitespace in the title', () => {
    expect(verifyZeffyRequest({ token: 'secret-123', eventTitle: '  2026 Ibn Katheer Quran Competition ' }, EXPECTED)).toBe(true);
  });
  it('rejects a wrong or missing token', () => {
    expect(verifyZeffyRequest({ token: 'nope', eventTitle: EXPECTED.eventTitle }, EXPECTED)).toBe(false);
    expect(verifyZeffyRequest({ token: null, eventTitle: EXPECTED.eventTitle }, EXPECTED)).toBe(false);
  });
  it('rejects a payload for a different competition', () => {
    expect(verifyZeffyRequest({ token: 'secret-123', eventTitle: 'Some Other Fundraiser' }, EXPECTED)).toBe(false);
    expect(verifyZeffyRequest({ token: 'secret-123', eventTitle: '' }, EXPECTED)).toBe(false);
  });
});

describe('tenantFromWebhookPath', () => {
  it('takes the trailing two segments (hosting rewrite and direct function URL)', () => {
    expect(tenantFromWebhookPath('/zeffy/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(tenantFromWebhookPath('/zeffyWebhook/demo/2026')).toEqual({ orgId: 'demo', compId: '2026' });
    expect(tenantFromWebhookPath('/demo/2026/')).toEqual({ orgId: 'demo', compId: '2026' });
  });
  it('rejects missing or unsafe segments', () => {
    expect(tenantFromWebhookPath('/zeffy')).toBeNull();
    expect(tenantFromWebhookPath('/')).toBeNull();
    expect(tenantFromWebhookPath('/zeffy/de mo/2026')).toBeNull();
  });
});

describe('handleZeffyWebhook', () => {
  function fakeWriter() {
    const store = new Map<string, Omit<RegistrationDoc, 'createdAt'>>();
    const write: RegistrationWriter = async (id, doc) => {
      if (store.has(id)) return 'exists';
      store.set(id, doc);
      return 'written';
    };
    return { store, write };
  }

  it('writes one registration per item and reports results', async () => {
    const { store, write } = fakeWriter();
    const res = await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    expect(res.processed).toBe(1);
    expect(res.results[0]).toMatchObject({ kind: 'ticket', result: 'written' });
    expect(store.size).toBe(1);
  });

  it('is idempotent — a retry of the same payload writes nothing new', async () => {
    const { store, write } = fakeWriter();
    await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    const res2 = await handleZeffyWebhook(PAYLOAD_THREE_CATS, write);
    expect(res2.results[0].result).toBe('exists');
    expect(store.size).toBe(1);
  });
});
