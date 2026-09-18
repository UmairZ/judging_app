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

const prefListeners = new Set<() => void>();

/** Tiny per-device localStorage preference (useJudgeLang's pattern, generalized) —
 * e.g. the desktop sidebar collapse state ('judge-rail', default 'collapsed').
 * Storage access is best-effort: a throwing/absent localStorage falls back. */
export function useLocalPref(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    (cb) => { prefListeners.add(cb); return () => prefListeners.delete(cb); },
    () => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  );
  const set = useCallback((v: string) => {
    try { localStorage.setItem(key, v); } catch { /* per-device convenience only */ }
    prefListeners.forEach((cb) => cb());
  }, [key]);
  return [value, set];
}

/** Shared light pill family (Option C) — Rules affordance on cream/white ground.
 * Every call site sits on a light background now, so one style covers all of them. */
export const rulesPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 30,
  boxSizing: 'border-box',
  border: `1px solid ${C.line}`,
  background: '#fff',
  color: C.greenDeep,
  borderRadius: 999,
  padding: '0 14px',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
};

/** Segmented EN | ع pill — one rounded container, two halves (spec §2). Light-pill
 * family: every call site now sits on a light (cream/white) background. */
export function LangToggle({ lang, setLang }: { lang: JudgeLang; setLang: (l: JudgeLang) => void }) {
  const Side = ({ side, text, fontSize }: { side: JudgeLang; text: string; fontSize: number }) => {
    const active = lang === side;
    return (
      <button
        onClick={() => setLang(side)}
        aria-pressed={active}
        style={{
          cursor: 'pointer',
          border: 'none',
          // Fill the container's full height so the active fill is a true
          // segment, not a lozenge floating inside the pill.
          height: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 40,
          padding: '0 12px',
          fontSize,
          fontWeight: 600,
          lineHeight: 1,
          background: active ? C.greenDeep : 'transparent',
          color: active ? '#fff' : C.greenDeep,
        }}
      >
        {text}
      </button>
    );
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: 30,
        boxSizing: 'border-box',
        border: `1px solid ${C.line}`,
        background: '#fff',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      {/* ع gets a bump for optical parity — Arabic glyphs render small at 12px. */}
      <Side side="en" text="EN" fontSize={12} />
      <Side side="ar" text="ع" fontSize={15} />
    </span>
  );
}
