import { useState } from 'react';
import { C, serif } from '../../ui/theme';
import { questionScore } from '../../scoring';
import type { GradingScreenProps, GradingSession } from '../useGradingSession';
import { L, t } from '../labels';
import { useJudgeLang, LangToggle } from '../useJudgeLang';
import StepperCard, { HIFZ_KEYS, TAJWEED_KEYS } from './StepperCard';
import VoiceScale from './VoiceScale';
import ScoreBars from './ScoreBars';
import DQOverlay from './DQOverlay';
import RulesModal from './RulesModal';

/** The phone grading layout (spec §6, DemoMobile shape) — pure presentation over
 * useGradingSession; the same brain object DesktopShell consumes. */
export default function MobileShell({ contestant, mistakeLimit, meta, s }: GradingScreenProps & { s: GradingSession }) {
  const {
    cfg, rulesText, locked, tieBreak, questions, active, setActive, aq, counts, score, means,
    sync, notes, setNotes, canFinish, voiceNudge, showPrompt,
    inc, dec, setVoice, manualDQ, restoreDQ, resetQ, dismissPrompt, confirmDQ,
    addQuestion, removeQuestion, finalize, reopen, submitTieBreak, saveAndExit, needsVoice,
  } = s;
  const { lang, setLang } = useJudgeLang();
  const [rulesOpen, setRulesOpen] = useState(false);
  const startedCount = meta.startedCount;

  // Pre-seed: no interactive elements — patching an empty questions array must be unreachable.
  if (!questions.length) {
    return <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.parchment, color: C.muted, fontFamily: serif }}>{t('loading', lang)}</div>;
  }

  const status = locked
    ? { key: 'gradedLocked' as const, color: C.gold, dot: C.gold }
    : sync === 'offline'
    ? { key: 'offlineSaved' as const, color: '#E8B45F', dot: '#E8B45F' }
    : sync === 'saving'
    ? { key: 'saving' as const, color: C.gold, dot: C.gold }
    : { key: 'saved' as const, color: '#8FD4AE', dot: '#6FCBA0' };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: C.parchment, color: C.ink, position: 'relative' }}>

      {/* ---- header ---- */}
      <div style={{ background: C.greenDeep, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            onClick={saveAndExit}
            aria-label={t('backToQueue', lang)}
            title={t('backToQueue', lang)}
            style={{ width: 44, height: 44, minWidth: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#DCEAE6', fontSize: 20, lineHeight: 1, padding: 0, marginTop: -2 }}
          >
            ←
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{contestant.name}</span>
              <span style={{ flex: 'none', fontSize: 11, fontWeight: 600, color: '#06211C', background: C.gold, padding: '2px 9px', borderRadius: 999 }}>{contestant.slotLabel}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: status.color, fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: status.dot, boxShadow: `0 0 8px ${status.dot}`, display: 'inline-block' }} />
                <L k={status.key} lang={lang} />
              </span>
              <LangToggle lang={lang} setLang={setLang} />
              {rulesText && (
                <span onClick={() => setRulesOpen(true)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box', minHeight: 44, fontSize: 12.5, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '8px 16px', borderRadius: 5, background: '#11332D' }}>
                  <L k="rules" lang={lang} />
                </span>
              )}
            </div>
            {tieBreak && (
              <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: C.gold }}><L k="tieBreakHeader" lang={lang} /></div>
            )}
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>{tieBreak ? t('tieBreakScore', lang) : t('sessionScore', lang)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
              <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 32, lineHeight: 1.1, color: C.gold }}>{score.toFixed(1)}</span>
              <span style={{ fontSize: 13, color: '#9DBDB4' }}>/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- question chips (replace the desktop rail) ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px 4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 44 }}>
        {questions.map((q, i) => {
          const isActive = i === active;
          const total = q.disqualified ? 0 : Math.round(questionScore(q, cfg));
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{
                flex: 'none', cursor: 'pointer', borderRadius: 999, padding: '9px 14px', minHeight: 44, boxSizing: 'border-box',
                border: `1.5px solid ${isActive ? C.brass : q.disqualified ? C.failLine : C.line}`,
                background: isActive ? '#FCF7E9' : q.disqualified ? C.failBg : '#fff',
                fontSize: 13.5, fontWeight: 600, color: isActive ? C.ink : q.disqualified ? '#9A6A5C' : '#41504B',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              {`Q${i + 1}`}
              {q.isAdded && <span style={{ color: C.brassDark, fontWeight: 700 }}>+</span>}
              <span style={{ fontFamily: serif, fontSize: 14, fontWeight: 600, color: q.disqualified ? C.fail : isActive ? C.brassDark : C.green }}>{q.disqualified ? t('dqAbbrev', lang) : total}</span>
              {needsVoice(q) && !locked && <span title={t('voiceNotRatedDot', lang)} style={{ color: C.fail, fontSize: 15, lineHeight: 1 }}>•</span>}
            </button>
          );
        })}
        {!locked && !tieBreak && (
          <button onClick={addQuestion} style={{ flex: 'none', cursor: 'pointer', borderRadius: 999, padding: '9px 14px', minHeight: 44, boxSizing: 'border-box', border: '1.5px dashed #C9BD9E', background: 'transparent', color: C.brassDark, fontSize: 13.5, fontWeight: 600 }}>
            <L k="addChip" lang={lang} />
          </button>
        )}
      </div>

      {/* Phase E insertion slot: the collapsible question-reveal panel
          (surah/ayah/page + passage) mounts here, under the chips. */}

      {/* ---- body (locked → read-only) ---- */}
      <div style={{ padding: '10px 14px 96px', opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : 'auto' }}>

        {/* active question line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 8px', minHeight: 44 }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.greenDeep }}>{`${t('question', lang)} ${active + 1}`}</span>
          <span style={{ fontSize: 12.5, color: C.muted }}>{aq.isAdded ? t('addedQuestion', lang) : `${t('of', lang)} ${questions.length}`}</span>
          {aq.isAdded && !locked && (
            <button onClick={() => removeQuestion(active)} title={t('removeQuestion', lang)} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: 1, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flex: 'none' }}>×</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: C.brassDark, background: C.pill, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{`${aq.events.length} ${t('marks', lang)}`}</span>
        </div>

        {aq.disqualified && (
          <div style={{ margin: '0 0 10px', background: C.failBg, border: `1px solid ${C.failLine}`, borderRadius: 10, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.fail, letterSpacing: '.04em', textTransform: 'uppercase' }}><L k="dqBanner" lang={lang} /></span>
            <span onClick={restoreDQ} style={{ marginLeft: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', boxSizing: 'border-box', minHeight: 44, fontSize: 12.5, fontWeight: 600, color: C.fail, border: '1px solid #E0B6AA', background: '#fff', padding: '7px 14px', borderRadius: 6 }}><L k="restoreQ" lang={lang} /></span>
          </div>
        )}

        <div style={{ opacity: aq.disqualified ? 0.4 : 1, pointerEvents: aq.disqualified ? 'none' : 'auto' }}>
          <SectionLabel color={C.brassDark}><L k="hifz" lang={lang} /></SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {HIFZ_KEYS.map((k) => (
              <StepperCard key={k.type} def={k} count={counts[k.type]} lang={lang} cfg={cfg} compact onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
            ))}
          </div>
          <SectionLabel color={C.green} style={{ marginTop: 16 }}><L k="tajweed" lang={lang} /></SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TAJWEED_KEYS.map((k) => (
              <StepperCard key={k.type} def={k} count={counts[k.type]} lang={lang} cfg={cfg} compact onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
            ))}
          </div>

          <SectionLabel color={C.voiceBar} style={{ marginTop: 16 }}><L k="voice" lang={lang} /></SectionLabel>
          <VoiceScale aq={aq} voiceMax={cfg.voice_max} setVoice={setVoice} lang={lang} />
        </div>

        {!tieBreak && (
          <>
            <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: '13px 14px 2px' }}>
              <ScoreBars cfg={cfg} means={means} questions={questions} lang={lang} />
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 8 }}><L k="notes" lang={lang} /></div>
              <textarea
                value={notes}
                disabled={locked}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder', lang)}
                style={{ width: '100%', minHeight: 88, resize: 'vertical', boxSizing: 'border-box', background: locked ? '#F3EFE4' : '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>

            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}><L k="panelCompleteness" lang={lang} /></span>
              <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.greenDeep }}>{startedCount} / {meta.panelSize || '—'}</span>
              <span style={{ fontSize: 12, color: C.muted }}><L k="judgesStarted" lang={lang} /></span>
            </div>
          </>
        )}

        {/* reset + disqualify */}
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E4DCC9', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div onClick={resetQ} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxSizing: 'border-box', minHeight: 44, background: '#fff', border: '1.5px solid #D8D0BE', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 600, color: C.sub }}>
            <span style={{ fontSize: 16, color: C.brassDark }}>↺</span> <L k="resetPoints" lang={lang} />
          </div>
          {!aq.disqualified && (
            <div onClick={manualDQ} style={{ marginLeft: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', minHeight: 44, background: '#fff', border: '1.5px solid #E0B6AA', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 600, color: C.fail }}><L k="disqualifyQ" lang={lang} /></div>
          )}
        </div>
      </div>

      {/* ---- sticky bottom action bar (banners directly above it) ---- */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
        {locked && (
          <div style={{ padding: '9px 14px', background: C.pill, color: C.brassDark, fontSize: 12.5, fontWeight: 600, borderTop: `1px solid ${C.line}` }}>
            <L k="lockedBanner" lang={lang} />
          </div>
        )}
        {voiceNudge && !canFinish && !locked && (
          <div style={{ padding: '9px 14px', background: C.failBg, color: C.fail, fontSize: 12.5, fontWeight: 600, borderTop: `1px solid ${C.failLine}` }}>
            <L k="voiceNudge" lang={lang} />
          </div>
        )}
        <div style={{ background: C.cream, borderTop: `1px solid ${C.line}`, padding: '10px 14px', display: 'flex', gap: 10 }}>
          {tieBreak ? (
            <BarButton primary onClick={submitTieBreak}><L k="submitTieBreak" lang={lang} /></BarButton>
          ) : (
            <BarButton primary onClick={locked ? reopen : finalize}><L k={locked ? 'reopenEdit' : 'finish'} lang={lang} /></BarButton>
          )}
        </div>
      </div>

      {/* auto-flag prompt — same component as desktop, viewport-anchored on phone */}
      {showPrompt && !locked && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>
          <DQOverlay limit={mistakeLimit} lang={lang} onKeep={dismissPrompt} onConfirm={confirmDQ} />
        </div>
      )}

      {rulesOpen && rulesText && <RulesModal text={rulesText} lang={lang} onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

function BarButton({ children, primary = false, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        minHeight: 48, borderRadius: 8, padding: '12px 16px', fontSize: 14.5, textAlign: 'center',
        ...(primary
          ? { flex: 1, fontWeight: 700, color: '#06211C', background: C.gold }
          : { fontWeight: 600, color: '#41504B', background: '#fff', border: '1.5px solid #D8D0BE' }),
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 10.5, letterSpacing: '.13em', textTransform: 'uppercase', color, fontWeight: 700, margin: '0 0 8px', ...style }}>{children}</div>;
}
