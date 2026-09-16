import { C } from '../../ui/theme';
import type { Question } from '../../scoring';
import { L, t, type JudgeLang } from '../labels';

/** The per-question voice rating card — the row of clickable bars, 0..voice_max. */
export default function VoiceScale({ aq, voiceMax, setVoice, lang }: { aq: Question; voiceMax: number; setVoice: (n: number) => void; lang: JudgeLang }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 22 }}>
      <div style={{ flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.ink }}><L k="voiceDelivery" lang={lang} /></span>
          {aq.voice == null && !aq.disqualified && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.fail, background: C.failBg, padding: '2px 9px', borderRadius: 999 }}><L k="notRated" lang={lang} /></span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t('rateAsYouGo', lang)} · 0–{voiceMax}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 9 }}>
        {Array.from({ length: voiceMax + 1 }, (_, n) => {
          const on = aq.voice != null && (n === 0 ? aq.voice === 0 : n <= aq.voice && aq.voice > 0);
          return (
            <div key={n} onClick={() => setVoice(n)} style={{ flex: 1, cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ height: 14 + n * 8, borderRadius: '4px 4px 0 0', background: on ? C.voiceBar : C.line, marginBottom: 5 }} />
              <span style={{ fontSize: 13, fontWeight: aq.voice === n ? 700 : 600, color: aq.voice === n ? C.brassDark : C.muted }}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
