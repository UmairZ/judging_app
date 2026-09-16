import { useEffect, useRef, useState } from 'react';
import { C } from '../../ui/theme';
import type { DeductionEventType, ScoringConfig } from '../../scoring';
import { t, type JudgeLang, type LabelKey } from '../labels';

/** "Costs {n} point(s)" -> "Costs 1 point" / "Costs 0.5 points" (en only pluralizes). */
function pointsPhrase(n: number, lang: JudgeLang): string {
  const template = t('costsPoints', lang);
  return lang === 'en'
    ? template.replace('point(s)', n === 1 ? 'point' : 'points').replace('{n}', String(n))
    : template.replace('{n}', String(n));
}

/** The ONLY cost-copy source for deduction types. Hifz prompted types escalate
 * under `escalating-v2`; tajweed stays flat regardless of model; self-corrected is free. */
export function costLine(type: DeductionEventType, cfg: ScoringConfig, lang: JudgeLang): string {
  if (type === 'self_corrected') return t('noPenalty', lang);
  if (type === 'tajweed_major' || type === 'tajweed_minor') {
    const n = type === 'tajweed_major' ? cfg.tajweed_deductions.major : cfg.tajweed_deductions.minor;
    return pointsPhrase(n, lang);
  }
  const base = pointsPhrase(cfg.hifz_deductions[type], lang);
  return cfg.model === 'escalating-v2' ? `${base} ${t('escalates', lang)}` : base;
}

export default function InfoPopover({ type, cfg, lang }: { type: DeductionEventType; cfg: ScoringConfig; lang: JudgeLang }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Touch/tap fires mouseenter BEFORE click: without this flag the enter opens the
  // popover and the click instantly toggles it shut (verified live). A click right
  // after a hover-open keeps it open; only a "cold" click on an open popover closes.
  const hoverOpened = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const desc = t(`${type}_desc` as LabelKey, lang);
  const cost = costLine(type, cfg, lang);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}
      onMouseEnter={() => { hoverOpened.current = true; setOpen(true); }}
      onMouseLeave={() => { hoverOpened.current = false; setOpen(false); }}
    >
      <button
        type="button"
        onClick={() => {
          if (!open) { setOpen(true); return; }
          if (hoverOpened.current) { hoverOpened.current = false; return; }
          setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={t('moreInfo', lang)}
        style={{
          width: 18, height: 18, borderRadius: '50%', border: `1px solid ${C.muted}`, color: C.muted,
          background: 'none', fontSize: 11, fontWeight: 700, lineHeight: 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none',
        }}
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 10,
            boxShadow: '0 6px 18px rgba(28,41,38,.18)', width: 'max-content', maxWidth: 'min(280px, calc(100vw - 24px))', zIndex: 6,
            padding: '10px 12px', fontSize: 13, lineHeight: 1.4, color: C.ink,
          }}
        >
          <div>{desc}</div>
          <div style={{ marginTop: 6, color: C.muted, fontWeight: 600 }}>{cost}</div>
        </div>
      )}
    </div>
  );
}
