import { C, serif } from '../../ui/theme';

/** The count-based auto-flag prompt: write off the whole question, or keep it. */
export default function DQOverlay({ limit, onKeep, onConfirm }: { limit: number; onKeep: () => void; onConfirm: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
      <div style={{ width: 440, background: C.cream, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '30px 30px 26px', boxShadow: '0 24px 60px rgba(20,40,36,.32)', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ fontSize: 26, color: C.brass }}>⚠</span>
        </div>
        <div style={{ fontFamily: serif, fontSize: 25, fontWeight: 600, color: C.greenDeep, marginBottom: 8 }}>Call it?</div>
        <div style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.55, marginBottom: 24 }}>
          That's {limit} hifz mistakes on this question — this category's limit. Write off the <strong style={{ color: C.brassDark }}>whole question</strong> (hifz, tajweed &amp; voice), or keep it and let the remaining points still count.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div onClick={onKeep} style={{ flex: 1, cursor: 'pointer', background: '#fff', border: '1.5px solid #D8D0BE', borderRadius: 9, padding: 14, fontSize: 15, fontWeight: 600, color: '#41504B' }}>Keep it</div>
          <div onClick={onConfirm} style={{ flex: 1, cursor: 'pointer', background: C.fail, borderRadius: 9, padding: 14, fontSize: 15, fontWeight: 700, color: '#fff' }}>Disqualify</div>
        </div>
      </div>
    </div>
  );
}
