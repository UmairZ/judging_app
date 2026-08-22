import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { initMonitoring } from './sentry';

vi.mock('@sentry/react', () => ({ init: vi.fn() }));

describe('initMonitoring', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing without a DSN (self-hosters)', () => {
    initMonitoring({ MODE: 'production' });
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes with DSN and environment from the build mode', () => {
    initMonitoring({ VITE_SENTRY_DSN: 'https://x@o0.ingest.sentry.io/0', MODE: 'sandbox' });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://x@o0.ingest.sentry.io/0', environment: 'sandbox' }),
    );
  });
});
