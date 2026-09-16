import { useCallback, useSyncExternalStore } from 'react';
import { C } from '../ui/theme';
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

/** Compact EN | ع pill pair — one language renders at a time (spec §2). */
export function LangToggle({ lang, setLang }: { lang: JudgeLang; setLang: (l: JudgeLang) => void }) {
  const Side = ({ side, text }: { side: JudgeLang; text: string }) => {
    const active = lang === side;
    return (
      <button
        onClick={() => setLang(side)}
        aria-pressed={active}
        style={{
          cursor: 'pointer',
          border: 'none',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11.5,
          fontWeight: 700,
          lineHeight: 1.4,
          background: active ? C.pill : 'transparent',
          color: active ? C.brassDark : C.muted,
        }}
      >
        {text}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Side side="en" text="EN" />
      <Side side="ar" text="ع" />
    </div>
  );
}
