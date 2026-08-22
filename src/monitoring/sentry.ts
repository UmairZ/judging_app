import * as Sentry from '@sentry/react';

// Opt-in by configuration: without VITE_SENTRY_DSN (dev, self-hosters) this is a no-op.
export function initMonitoring(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): void {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: env.MODE, sendDefaultPii: false });
}
