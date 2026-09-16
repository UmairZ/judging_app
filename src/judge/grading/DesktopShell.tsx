import { useState } from 'react';
import { C, serif } from '../../ui/theme';
import { questionScore } from '../../scoring';
import type { GradingScreenProps, GradingSession } from '../useGradingSession';
import { L, t, nQuestions } from '../labels';
import { useJudgeLang, LangToggle } from '../useJudgeLang';
import StepperCard, { HIFZ_KEYS, TAJWEED_KEYS } from './StepperCard';
import VoiceScale from './VoiceScale';
import ScoreBars from './ScoreBars';
import DQOverlay from './DQOverlay';
import RulesModal from './RulesModal';

/** The desktop grading layout — pure presentation over useGradingSession. */
export default function DesktopShell({ contestant, minQuestions, mistakeLimit, meta, onEnd, s }: GradingScreenProps & { s: GradingSession }) {
  const {
    cfg, rulesText, locked, tieBreak, questions, active, setActive, aq, counts, score, means,
    sync, notes, setNotes, canFinish, voiceNudge, showPrompt,
    inc, dec, setVoice, manualDQ, restoreDQ, resetQ, dismissPrompt, confirmDQ,
    addQuestion, removeQuestion, finalize, reopen, submitTieBreak, saveAndExit, needsVoice,
  } = s;
  const { lang, setLang } = useJudgeLang();
  const [rulesOpen, setRulesOpen] = useState(false);
  // How many panel judges have started this contestant — passed in by the parent, which
  // already subscribes to the sessions collection (no extra listener here).
  const startedCount = meta.startedCount;

  if (!questions.length) {
    return <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.parchment, color: C.muted, fontFamily: serif }}>{t('loading', lang)}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: C.parchment, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: C.ink, position: 'relative' }}>

        {/* ---- header ---- */}
        <div style={{ height: 92, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ width: 12, height: 12, background: C.green, transform: 'rotate(45deg)', display: 'inline-block' }} />
          </div>
          <div style={{ marginLeft: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff' }}>{contestant.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#06211C', background: C.gold, padding: '3px 10px', borderRadius: 999 }}>{contestant.slotLabel}</span>
            </div>
            <div style={{ fontSize: 13, color: '#9DBDB4', marginTop: 3 }}>
              {tieBreak ? (
                <span style={{ color: C.gold, fontWeight: 600 }}><L k="tieBreakHeader" lang={lang} /></span>
              ) : (
                <>
                  {`${t('contestant', lang)} ${meta.position} ${t('of', lang)} ${meta.total}`}
                  {meta.panelName && <> · {meta.panelName}</>}
                  {meta.panelSize > 0 && <> · <span style={{ color: '#CFE2DB' }}>{`${t('youAreJudge', lang)} ${meta.judgeIndex} ${t('of', lang)} ${meta.panelSize}`}</span></>}
                </>
              )}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <LangToggle lang={lang} setLang={setLang} />
            {rulesText && (
              <span onClick={() => setRulesOpen(true)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '11px 18px', borderRadius: 5, background: '#11332D' }}>
                <L k="rules" lang={lang} />
              </span>
            )}
            {(() => {
              const status = locked
                ? { key: 'gradedLocked' as const, color: C.gold, dot: C.gold }
                : sync === 'offline'
                ? { key: 'offlineSaved' as const, color: '#E8B45F', dot: '#E8B45F' }
                : sync === 'saving'
                ? { key: 'saving' as const, color: C.gold, dot: C.gold }
                : { key: 'saved' as const, color: '#8FD4AE', dot: '#6FCBA0' };
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: status.color, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: status.dot, boxShadow: `0 0 8px ${status.dot}`, display: 'inline-block' }} />
                  <L k={status.key} lang={lang} />
                </div>
              );
            })()}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>{tieBreak ? t('tieBreakScore', lang) : t('sessionScore', lang)}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 46, lineHeight: 1, color: C.gold }}>{score.toFixed(1)}</span>
                <span style={{ fontSize: 16, color: '#9DBDB4' }}>/ 100</span>
              </div>
            </div>
            {tieBreak ? (
              <>
                <span onClick={onEnd} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '11px 18px', borderRadius: 5, background: '#11332D' }}><L k="cancel" lang={lang} /></span>
                <span onClick={submitTieBreak} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}><L k="submitTieBreak" lang={lang} /></span>
              </>
            ) : (
              <>
                <span onClick={saveAndExit} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DCEAE6', border: '1px solid #3A6258', padding: '11px 18px', borderRadius: 5, background: '#11332D' }}><L k={locked ? 'backToQueue' : 'saveExit'} lang={lang} /></span>
                <span onClick={locked ? reopen : finalize} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}><L k={locked ? 'reopenEdit' : 'finish'} lang={lang} /></span>
              </>
            )}
          </div>
        </div>

        {locked && (
          <div style={{ flex: 'none', padding: '9px 30px', background: C.pill, color: C.brassDark, fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>
            <L k="lockedBanner" lang={lang} />
          </div>
        )}

        {voiceNudge && !canFinish && !locked && (
          <div style={{ flex: 'none', padding: '9px 30px', background: C.failBg, color: C.fail, fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.failLine}` }}>
            <L k="voiceNudge" lang={lang} />
          </div>
        )}

        {/* ---- body ---- */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* question rail (hidden in tie-break mode — single question) */}
          {!tieBreak && (
          <div style={{ width: 244, flex: 'none', borderRight: `1px solid ${C.line}`, background: C.cream, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px 10px', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
              <L k="questions" lang={lang} /><span style={{ color: '#B6AE9C' }}>{nQuestions(minQuestions, lang)}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map((q, i) => {
                const isActive = i === active;
                const total = q.disqualified ? 0 : Math.round(questionScore(q, cfg));
                return (
                  <div key={i} onClick={() => setActive(i)} style={{ cursor: 'pointer', borderRadius: 8, padding: '11px 13px', border: `1.5px solid ${isActive ? C.brass : q.disqualified ? C.failLine : C.line}`, background: isActive ? '#FCF7E9' : q.disqualified ? C.failBg : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: isActive ? C.ink : q.disqualified ? '#9A6A5C' : '#41504B' }}>
                        {`${t('question', lang)} ${i + 1}`}{q.isAdded ? ' +' : ''}
                        {needsVoice(q) && !locked && <span title={t('voiceNotRatedDot', lang)} style={{ color: C.fail, marginLeft: 6, fontSize: 15, lineHeight: 1 }}>•</span>}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {q.isAdded && !locked && (
                          <button onClick={(e) => { e.stopPropagation(); removeQuestion(i); }} title={t('removeQuestion', lang)} style={{ fontSize: 15, lineHeight: 1, color: C.fail, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                        )}
                        <span style={{ fontFamily: serif, fontSize: 17, fontWeight: 600, color: q.disqualified ? C.fail : isActive ? C.brassDark : C.green }}>{q.disqualified ? t('dqAbbrev', lang) : <>{total}<span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}> / 100</span></>}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
              {!locked && <div onClick={addQuestion} style={{ cursor: 'pointer', marginTop: 2, borderRadius: 8, padding: '11px 13px', border: `1.5px dashed #C9BD9E`, color: C.brassDark, fontSize: 13, fontWeight: 600, textAlign: 'center' }}><L k="addQuestion" lang={lang} /></div>}
            </div>
          </div>
          )}

          {/* main — active question (locked → read-only) */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '24px 30px', position: 'relative', overflow: 'auto', opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 4 }}>
              <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep }}>{`${t('question', lang)} ${active + 1}`}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{aq.isAdded ? t('addedQuestion', lang) : `${t('of', lang)} ${questions.length}`}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.brassDark, background: C.pill, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{`${aq.events.length} ${t('marks', lang)}`}</span>
            </div>

            {aq.disqualified && (
              <div style={{ margin: '12px 0 2px', background: C.failBg, border: `1px solid ${C.failLine}`, borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.fail, letterSpacing: '.04em', textTransform: 'uppercase' }}><L k="dqBanner" lang={lang} /></span>
                <span style={{ fontSize: 13, color: '#9A6A5C' }}><L k="dqBannerDetail" lang={lang} /></span>
                <span onClick={restoreDQ} style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: C.fail, border: '1px solid #E0B6AA', background: '#fff', padding: '7px 14px', borderRadius: 6 }}><L k="restoreQ" lang={lang} /></span>
              </div>
            )}

            <div style={{ opacity: aq.disqualified ? 0.4 : 1, pointerEvents: aq.disqualified ? 'none' : 'auto' }}>
              <SectionLabel color={C.brassDark}><L k="hifz" lang={lang} /></SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {HIFZ_KEYS.map((k) => (
                  <StepperCard key={k.type} def={k} count={counts[k.type]} lang={lang} cfg={cfg} onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
                ))}
              </div>
              <SectionLabel color={C.green} style={{ marginTop: 18 }}><L k="tajweed" lang={lang} /></SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TAJWEED_KEYS.map((k) => (
                  <StepperCard key={k.type} def={k} count={counts[k.type]} lang={lang} cfg={cfg} onInc={() => inc(k.type)} onDec={() => dec(k.type)} />
                ))}
              </div>

              {/* voice — per question */}
              <SectionLabel color={C.voiceBar} style={{ marginTop: 18 }}><L k="voice" lang={lang} /></SectionLabel>
              <VoiceScale aq={aq} voiceMax={cfg.voice_max} setVoice={setVoice} lang={lang} />
            </div>

            {/* action bar */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid #E4DCC9`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div onClick={resetQ} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #D8D0BE', borderRadius: 8, padding: '13px 20px', fontSize: 15, fontWeight: 600, color: C.sub }}>
                <span style={{ fontSize: 17, color: C.brassDark }}>↺</span> <L k="resetPoints" lang={lang} />
              </div>
              <div onClick={manualDQ} style={{ marginLeft: 'auto', cursor: 'pointer', background: '#fff', border: '1.5px solid #E0B6AA', borderRadius: 8, padding: '13px 22px', fontSize: 15, fontWeight: 600, color: C.fail }}><L k="disqualifyQ" lang={lang} /></div>
            </div>

            {/* auto-flag prompt */}
            {showPrompt && <DQOverlay limit={mistakeLimit} lang={lang} onKeep={dismissPrompt} onConfirm={confirmDQ} />}
          </div>

          {/* side — score breakdown + completeness (hidden in tie-break mode) */}
          {!tieBreak && (
          <div style={{ width: 296, flex: 'none', borderLeft: `1px solid ${C.line}`, background: C.cream, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <ScoreBars cfg={cfg} means={means} questions={questions} lang={lang} />
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 8 }}><L k="notes" lang={lang} /></div>
              <textarea
                value={notes}
                disabled={locked}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder', lang)}
                style={{ width: '100%', minHeight: 104, resize: 'vertical', boxSizing: 'border-box', background: locked ? '#F3EFE4' : '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div style={{ marginTop: 'auto', background: C.parchment, border: '1px solid #E0D8C6', borderRadius: 9, padding: '13px 15px' }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: 5 }}><L k="panelCompleteness" lang={lang} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep }}>{startedCount} / {meta.panelSize || '—'}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}><L k="judgesStarted" lang={lang} /></span>
              </div>
            </div>
          </div>
          )}
        </div>

        {rulesOpen && <RulesModal text={rulesText} lang={lang} onClose={() => setRulesOpen(false)} />}
      </div>
  );
}

function SectionLabel({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 700, margin: '0 0 9px', ...style }}>{children}</div>;
}
