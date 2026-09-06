import { useEffect, useRef, useState } from 'react';

/** Fired on `window` after navigate() pushes a history entry, so every
 * usePortalPath() consumer re-reads the pathname in place. */
export const NAVIGATE_EVENT = 'portal:navigate';

/**
 * Client-side navigation: push a history entry and notify subscribers —
 * no document load, so auth state and Firestore subscriptions persist
 * (the old-AdminApp instant-tab feel).
 */
export function navigate(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/**
 * Reactive `window.location.pathname`: re-renders on navigate() (custom
 * event) and on back/forward (`popstate`). Scrolls to the top when the
 * path changes — but not on initial mount, so a plain page load keeps
 * whatever scroll position the browser restored.
 */
export function usePortalPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener(NAVIGATE_EVENT, onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  const prevPath = useRef(path);
  useEffect(() => {
    if (prevPath.current !== path) {
      prevPath.current = path;
      window.scrollTo(0, 0);
    }
  }, [path]);

  return path;
}
