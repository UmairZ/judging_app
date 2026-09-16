import { C, serif } from '../../ui/theme';
import type { DeductionEventType, ScoringConfig } from '../../scoring';
import { L, t, type JudgeLang } from '../labels';
import InfoPopover from './InfoPopover';

/* ---- the five deduction keys, grouped as in the design ---- */
export type KeyDef = { type: DeductionEventType };
export const HIFZ_KEYS: KeyDef[] = [
  { type: 'self_corrected' },
  { type: 'prompted_fixed' },
  { type: 'prompted_failed' },
];
export const TAJWEED_KEYS: KeyDef[] = [
  { type: 'tajweed_major' },
  { type: 'tajweed_minor' },
];

/** One deduction row. `compact` tightens paddings/sizes for the phone shell
 * (360px-safe: the label column wraps; controls stay ≥44px, "+" the biggest). */
export default function StepperCard({ def, count, lang, cfg, onInc, onDec, compact = false }: { def: KeyDef; count: number; lang: JudgeLang; cfg: ScoringConfig; onInc: () => void; onDec: () => void; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 16, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: compact ? '10px 10px 10px 14px' : '12px 14px 12px 18px', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <L k={def.type} lang={lang} style={{ fontSize: compact ? 15 : 18, fontWeight: 600, color: C.ink, ...(compact ? {} : { whiteSpace: 'nowrap' as const }) }} />
          <InfoPopover type={def.type} cfg={cfg} lang={lang} />
        </div>
        <div style={{ fontSize: compact ? 12 : 13, color: C.muted, marginTop: 2, ...(compact ? { lineHeight: 1.35 } : {}) }}><L k={`${def.type}_desc`} lang={lang} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12, ...(compact ? { flex: 'none' } : {}) }}>
        <button onClick={onDec} title={t('removeOne', lang)} style={{ width: 44, height: 44, borderRadius: 10, border: '1.5px solid #C9BD9E', color: C.brassDark, fontSize: compact ? 24 : 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff', ...(compact ? { padding: 0 } : {}) }}>−</button>
        <span style={{ fontFamily: serif, fontSize: compact ? 24 : 30, fontWeight: 700, color: C.greenDeep, minWidth: compact ? 24 : 30, textAlign: 'center' }}>{count}</span>
        <button onClick={onInc} title={t('addOne', lang)} style={{ width: compact ? 52 : 58, height: compact ? 52 : 58, borderRadius: compact ? 12 : 13, background: C.green, color: '#fff', fontSize: compact ? 27 : 30, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', boxShadow: '0 2px 7px rgba(32,101,96,.28)', ...(compact ? { padding: 0 } : {}) }}>+</button>
      </div>
    </div>
  );
}
