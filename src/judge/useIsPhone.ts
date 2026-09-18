import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 700px)';

/** Phone-shell breakpoint (spec §1/§6). Safe when matchMedia is missing (jsdom) → desktop. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(QUERY);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false),
  );
}
