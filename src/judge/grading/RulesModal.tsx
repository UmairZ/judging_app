import { useEffect } from 'react';
import { C, serif } from '../../ui/theme';
import { L, t, type JudgeLang } from '../labels';

/** Full-screen rules overlay — organizer-written text (config/policies.rulesText),
 * rendered verbatim. Blank lines start a new paragraph; a single \n breaks a line
 * within one. Closes on ×, backdrop click, or Escape (DQOverlay's overlay pattern). */
export default function RulesModal({ text, lang, onClose }: { text: string; lang: JudgeLang; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const paragraphs = text.split(/\n{2,}/);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,41,38,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflow: 'auto', position: 'relative', background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 16, padding: '30px 30px 26px', boxShadow: '0 24px 60px rgba(20,40,36,.32)' }}
      >
        <button
          onClick={onClose}
          aria-label={t('close', lang)}
          style={{ position: 'absolute', top: 14, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, color: C.muted }}
        >
          ×
        </button>
        <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: C.greenDeep, marginBottom: 16 }}>
          <L k="rules" lang={lang} />
        </div>
        <div style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.6 }}>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? '0 0 12px' : '12px 0' }}>
              {p.split('\n').map((line, j, arr) => (
                <span key={j}>
                  {line}
                  {j < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
