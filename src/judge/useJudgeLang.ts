import { useCallback, useSyncExternalStore } from 'react';
import type { JudgeLang } from './labels';

const KEY = 'judge-lang';
const listeners = new Set<() => void>();

function read(): JudgeLang {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ar' ? 'ar' : 'en'; // anything else (missing, junk) → default en
  } catch { return 'en'; }
}

/** Per-device judge language preference (spec §2). Default English. */
export function useJudgeLang(): { lang: JudgeLang; setLang: (l: JudgeLang) => void } {
  const lang = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
  );
  const setLang = useCallback((l: JudgeLang) => {
    try { localStorage.setItem(KEY, l); } catch { /* per-device convenience only */ }
    listeners.forEach((cb) => cb());
  }, []);
  return { lang, setLang };
}
