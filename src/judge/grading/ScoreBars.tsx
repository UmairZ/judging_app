import { C, serif, pct } from '../../ui/theme';
import type { Question, ScoringConfig } from '../../scoring';

/** The side-panel score breakdown: one weighted bar per component. */
export default function ScoreBars({ cfg, means, questions }: { cfg: ScoringConfig; means: { H: number; T: number; V: number }; questions: Question[] }) {
  const { H, T, V } = means;
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 12 }}>Score breakdown</div>
      <Bar label={`Hifz · ${cfg.weights.hifz}%`} labelColor={C.brassDark} value={pct(H)} frac={H} color={C.hifzBar} />
      <Bar label={`Tajweed · ${cfg.weights.tajweed}%`} labelColor={C.tajBar} value={pct(T)} frac={T} color={C.tajBar} />
      <Bar label={`Voice · ${cfg.weights.voice}%`} labelColor={C.voiceBar} value={questions.some((q) => q.voice != null || q.disqualified) ? pct(V) : 'pending'} frac={V} color={C.voiceBar} />
    </div>
  );
}

function Bar({ label, labelColor, value, frac, color }: { label: string; labelColor: string; value: string; frac: number; color: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: labelColor, fontWeight: 600 }}>{label}</span>
        <span style={{ color: C.greenDeep, fontFamily: serif, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: 7, background: '#ECE6D8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct(frac), background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
