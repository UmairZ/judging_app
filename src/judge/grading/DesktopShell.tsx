import { useState } from 'react';
import { C, serif } from '../../ui/theme';
import { questionScore } from '../../scoring';
import type { GradingScreenProps, GradingSession } from '../useGradingSession';
import { L, t } from '../labels';
import { useJudgeLang, useLocalPref, LangToggle, rulesPillStyle } from '../useJudgeLang';
import StepperCard, { HIFZ_KEYS, TAJWEED_KEYS } from './StepperCard';
import VoiceScale from './VoiceScale';
import DQOverlay from './DQOverlay';
import RulesModal from './RulesModal';
import SideSelect from './SideSelect';
import PassagePanel from './PassagePanel';

/** The desktop grading layout — pure presentation over useGradingSession.
 * Task 6 (approved Option D): the left sidebar collapses into a VS Code-style
 * icon rail (default), and once a side is chosen the main area splits into
 * scoring (~55%) | passage pane (~45%). The old right side panel is gone —
 * Notes and Panel completeness live in the sidebar. */
export default function DesktopShell({ contestant, mistakeLimit, meta, s }: GradingScreenProps & { s: GradingSession }) {
  const {
    cfg, rulesText, locked, tieBreak, questions, active, setActive, aq, counts, score,
    sync, notes, setNotes, canFinish, voiceNudge, showPrompt,
    inc, dec, setVoice, manualDQ, restoreDQ, resetQ, dismissPrompt, confirmDQ,
    addQuestion, removeQuestion, finalize, reopen, submitTieBreak, saveAndExit, needsVoice,
    questionSet, side, setSide, sideLocked, revealRow, passageLines,
  } = s;
  const { lang, setLang } = useJudgeLang();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false); // pill-reopened side re-choice (until sideLocked)
  // Sidebar collapse — per-device, DEFAULT COLLAPSED (D1 is the working state).
  const [railPref, setRailPref] = useLocalPref('judge-rail', 'collapsed');
  const railExpanded = railPref === 'expanded';
  const [notesOpen, setNotesOpen] = useState(true); // NOTES section — expanded default
  const [completenessOpen, setCompletenessOpen] = useState(false); // PANEL COMPLETENESS — collapsed default
  // How many panel judges have started this contestant — passed in by the parent, which
  // already subscribes to the sessions collection (no extra listener here).
  const startedCount = meta.startedCount;

  // Question reveal (phase E): the active question's drawn row (null → judge's own
  // question — revealRow is tie-break-aware at the hook, so a tie-break can never
  // surface the main round's passage here).
  const activeRow = questionSet && side ? revealRow(active) : null;
  // Split only once a side exists; tie-break = judge's own question → full-width
  // scoring, no pane at all.
  const showPane = !!(questionSet && side && !tieBreak);
  const sidePillText = questionSet && side
    ? `${t(side === 'begin' ? 'beginningSide' : 'endSide', lang)} · ${side === 'begin' ? questionSet.beginLabel : questionSet.endLabel}`
    : '';

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
    <div style={{ width: '100%', height: '100vh', background: C.parchment, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: C.ink, position: 'relative' }}>

        {/* ---- header ---- */}
        <div style={{ height: 92, flex: 'none', display: 'flex', alignItems: 'center', padding: '0 30px', background: C.greenDeep }}>
          <button
            onClick={saveAndExit}
            aria-label={t('backToQueue', lang)}
            title={t('backToQueue', lang)}
            style={{ width: 44, height: 44, minWidth: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#DCEAE6', fontSize: 22, lineHeight: 1, marginRight: 6, padding: 0 }}
          >
            ←
          </button>
          <div style={{ marginLeft: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#fff' }}>{contestant.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#06211C', background: C.gold, padding: '3px 10px', borderRadius: 999 }}>{contestant.slotLabel}</span>
            </div>
            <div style={{ fontSize: 13, color: '#9DBDB4', marginTop: 3 }}>
              {!tieBreak && `${t('contestant', lang)} ${meta.position} ${t('of', lang)} ${meta.total}`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9DBDB4', fontWeight: 600 }}>{tieBreak ? t('tieBreakScore', lang) : t('sessionScore', lang)}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 46, lineHeight: 1, color: C.gold }}>{score.toFixed(1)}</span>
                <span style={{ fontSize: 16, color: '#9DBDB4' }}>/ 100</span>
              </div>
            </div>
            {tieBreak ? (
              <span onClick={submitTieBreak} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}><L k="submitTieBreak" lang={lang} /></span>
            ) : (
              <span onClick={locked ? reopen : finalize} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06211C', background: C.gold, padding: '11px 18px', borderRadius: 5 }}><L k={locked ? 'reopenEdit' : 'finish'} lang={lang} /></span>
            )}
          </div>
        </div>

        {/* ---- utility strip: sync status + tie-break flag + side pill left, Rules + language toggle right ---- */}
        <div style={{ flex: 'none', minHeight: 40, boxSizing: 'border-box', background: C.cream, borderBottom: `1px solid ${C.line}`, padding: '6px 30px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: status.color, fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: status.dot, boxShadow: `0 0 8px ${status.dot}`, display: 'inline-block' }} />
            <L k={status.key} lang={lang} />
          </div>
          {tieBreak && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.gold }}><L k="tieBreakHeader" lang={lang} /></span>
          )}
          {/* Side pill (phase E) — reopens the two-button side selector (an explicit
              re-choice; a bare toggle was ruled too risky live) until the first mark,
              then static. Never rendered in tie-break mode: the shared session doc
              carries the MAIN round's side, which a tie-break must not rewrite. */}
          {questionSet && side && !tieBreak && (
            sideLocked || locked ? (
              <span style={{ ...rulesPillStyle, cursor: 'default' }}>{sidePillText}</span>
            ) : (
              <button onClick={() => setSideOpen(true)} style={{ ...rulesPillStyle, fontFamily: 'inherit' }}>
                {sidePillText}
              </button>
            )
          )}
          <div style={{ flex: 1 }} />
          {rulesText && (
            <span onClick={() => setRulesOpen(true)} style={rulesPillStyle}>
              <L k="rules" lang={lang} />
            </span>
          )}
          <LangToggle lang={lang} setLang={setLang} />
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

          {/* sidebar (hidden in tie-break mode — single question), D1 collapsed / D2 expanded */}
          {!tieBreak && (railExpanded ? (

          /* D2 — expanded (~250px): full question cards, NOTES, PANEL COMPLETENESS */
          <div style={{ width: 250, flex: 'none', boxSizing: 'border-box', borderRight: `1px solid ${C.line}`, background: C.cream, padding: '16px 12px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '0 6px 10px', display: 'flex', alignItems: 'center', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600 }}>
              <L k="questions" lang={lang} />
              <button
                onClick={() => setRailPref('collapsed')}
                aria-label={t('collapseSidebar', lang)}
                title={t('collapseSidebar', lang)}
                style={{ marginLeft: 'auto', cursor: 'pointer', background: 'none', border: 'none', fontSize: 15, lineHeight: 1, color: C.muted, padding: 0 }}
              >
                «
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
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
            {/* NOTES — collapsible, expanded default */}
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16, flex: 'none' }}>
              <RailSectionHeader open={notesOpen} onClick={() => setNotesOpen((o) => !o)}><L k="notes" lang={lang} /></RailSectionHeader>
              {notesOpen && (
                <div style={{ padding: '0 6px 12px' }}>
                  <textarea
                    value={notes}
                    disabled={locked}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('notesPlaceholder', lang)}
                    style={{ width: '100%', minHeight: 72, resize: 'vertical', boxSizing: 'border-box', background: locked ? '#F3EFE4' : '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: C.ink, fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
              )}
            </div>
            {/* PANEL COMPLETENESS — collapsible, collapsed default */}
            <div style={{ borderTop: `1px solid ${C.line}`, flex: 'none' }}>
              <RailSectionHeader open={completenessOpen} onClick={() => setCompletenessOpen((o) => !o)}><L k="panelCompleteness" lang={lang} /></RailSectionHeader>
              {completenessOpen && (
                <div style={{ padding: '0 6px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep }}>{startedCount} / {meta.panelSize || '—'}</span>
                  <span style={{ fontSize: 12.5, color: C.muted }}><L k="judgesStarted" lang={lang} /></span>
                </div>
              )}
            </div>
          </div>

          ) : (

          /* D1 — collapsed icon rail (~56px), the default working state */
          <div style={{ width: 56, flex: 'none', boxSizing: 'border-box', borderRight: `1px solid ${C.line}`, background: C.cream, padding: '12px 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, overflowY: 'auto' }}>
            <button
              onClick={() => setRailPref('expanded')}
              aria-label={t('expandSidebar', lang)}
              title={t('expandSidebar', lang)}
              style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 15, lineHeight: 1, color: C.muted, padding: '2px 0 4px', flex: 'none' }}
            >
              »
            </button>
            {questions.map((q, i) => (
              <RailIcon
                key={i}
                active={i === active}
                fail={q.disqualified}
                dot={needsVoice(q) && !locked}
                title={`${t('question', lang)} ${i + 1}`}
                onClick={() => setActive(i)}
              >
                {/* zeroed question → red '0'; score itself is never shown collapsed */}
                {q.disqualified ? t('dqAbbrev', lang) : `Q${i + 1}`}
              </RailIcon>
            ))}
            {!locked && (
              <RailIcon dashed title={t('addQuestion', lang)} onClick={addQuestion}>+</RailIcon>
            )}
            <div style={{ width: 28, height: 1, background: C.line, margin: '2px 0', flex: 'none' }} />
            <RailIcon title={t('notes', lang)} onClick={() => setRailPref('expanded')}>✎</RailIcon>
            <span title={t('panelCompleteness', lang)} style={{ marginTop: 'auto', fontSize: 10.5, fontWeight: 600, color: C.muted, flex: 'none' }}>{startedCount}/{meta.panelSize || '—'}</span>
          </div>

          ))}

          {/* main — active question (locked → read-only); ~55% when the passage pane is up */}
          <div style={{ flex: showPane ? '1 1 55%' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '24px 30px', position: 'relative', overflow: 'auto', opacity: locked ? 0.55 : 1, pointerEvents: locked ? 'none' : 'auto' }}>
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
              {!aq.disqualified && (
                <div onClick={manualDQ} style={{ marginLeft: 'auto', cursor: 'pointer', background: '#fff', border: '1.5px solid #E0B6AA', borderRadius: 8, padding: '13px 22px', fontSize: 15, fontWeight: 600, color: C.fail }}><L k="disqualifyQ" lang={lang} /></div>
              )}
            </div>

            {/* auto-flag prompt */}
            {showPrompt && <DQOverlay limit={mistakeLimit} lang={lang} onKeep={dismissPrompt} onConfirm={confirmDQ} />}
          </div>

          {/* passage pane (phase E) — ~45%, Arabic anchored right; renders the hook's
              revealRow output (null → own-question copy for added questions). */}
          {showPane && (
            <>
              <div style={{ width: 1, flex: 'none', background: C.line }} />
              {/* single-cell grid so the pane card fills the reserved width AND height */}
              <div style={{ flex: '1 1 45%', minWidth: 0, minHeight: 0, padding: '20px 22px', display: 'grid' }}>
                <PassagePanel row={activeRow} passageLines={passageLines} lang={lang} variant="pane" />
              </div>
            </>
          )}
        </div>

        {rulesOpen && rulesText && <RulesModal text={rulesText} lang={lang} onClose={() => setRulesOpen(false)} />}

        {/* Side prompt (phase E): on open when the session carries no side yet, or
            reopened from the strip pill for an explicit re-choice. Locked/tie-break
            sessions are never interrogated. */}
        {questionSet && (side == null || sideOpen) && !locked && !tieBreak && (
          <SideSelect
            beginLabel={questionSet.beginLabel}
            endLabel={questionSet.endLabel}
            lang={lang}
            onPick={(choice) => { setSide(choice); setSideOpen(false); }}
          />
        )}
      </div>
  );
}

function SectionLabel({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 700, margin: '0 0 9px', ...style }}>{children}</div>;
}

/** Small-caps collapsible section header for the expanded rail (mock's
 * RailSectionHeader) — chevron shows expanded (▾) or collapsed (▸). */
function RailSectionHeader({ children, open, onClick }: { children: React.ReactNode; open: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 6px 8px', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, cursor: 'pointer' }}>
      <span>{children}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{open ? '▾' : '▸'}</span>
    </div>
  );
}

/** ~40px rounded-square item for the collapsed icon rail (mock's RailIconCircle,
 * radius 10 per the approved brief — matching the cards): question chip, dashed
 * add button, or ✎ notes glyph. Red dot = voice unrated; red '0' = zeroed. */
function RailIcon({
  children, active = false, dashed = false, dot = false, fail = false, title, onClick,
}: {
  children: React.ReactNode; active?: boolean; dashed?: boolean; dot?: boolean; fail?: boolean;
  title: string; onClick: () => void;
}) {
  return (
    <span
      title={title}
      onClick={onClick}
      style={{
        position: 'relative', width: 40, height: 40, flex: 'none', boxSizing: 'border-box', borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
        border: dashed ? `1.5px dashed ${C.line}` : `1.5px solid ${active ? C.brass : fail ? C.failLine : C.line}`,
        background: active ? '#FCF7E9' : fail ? C.failBg : '#fff',
        color: fail ? C.fail : active ? C.ink : '#41504B',
      }}
    >
      {children}
      {dot && <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 999, background: '#C0392B' }} />}
    </span>
  );
}
