import { C, serif } from '../../ui/theme';
import type { DeductionEventType } from '../../scoring';
import { L, t, type JudgeLang } from '../labels';

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

export default function StepperCard({ def, count, lang, onInc, onDec }: { def: KeyDef; count: number; lang: JudgeLang; onInc: () => void; onDec: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: '12px 14px 12px 18px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <L k={def.type} lang={lang} style={{ fontSize: 18, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap' }} />
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}><L k={`${def.type}_desc`} lang={lang} /></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onDec} title={t('removeOne', lang)} style={{ width: 44, height: 44, borderRadius: 10, border: '1.5px solid #C9BD9E', color: C.brassDark, fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}>−</button>
        <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 700, color: C.greenDeep, minWidth: 30, textAlign: 'center' }}>{count}</span>
        <button onClick={onInc} title={t('addOne', lang)} style={{ width: 58, height: 58, borderRadius: 13, background: C.green, color: '#fff', fontSize: 30, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', boxShadow: '0 2px 7px rgba(32,101,96,.28)' }}>+</button>
      </div>
    </div>
  );
}
