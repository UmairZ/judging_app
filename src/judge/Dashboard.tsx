import { useState } from 'react';
import { C, serif, initials } from '../ui/theme';
import type { JudgeQueueItem, QueueStatus } from './useJudgeQueue';

export interface TieBreakItem {
  roundId: string;
  contestantId: string;
  name: string;
  enrollmentId: string;
  category: string;
  slotLabel: string;
  graded: boolean;
}

const STATUS: Record<QueueStatus, { label: string; color: string; bg: string; dot: string; avatarBg: string; avatarFg: string }> = {
  graded: { label: 'Graded', color: '#206560', bg: '#DCEAE6', dot: '#2A7A73', avatarBg: 'linear-gradient(135deg,#DCEAE6,#BCD3CD)', avatarFg: '#206560' },
  in_progress: { label: 'In progress', color: '#9C7C34', bg: '#F6EFDA', dot: '#B99644', avatarBg: 'linear-gradient(135deg,#F6EFDA,#E8D9AE)', avatarFg: '#9C7C34' },
  not_started: { label: 'Not started', color: '#8A938E', bg: '#F0ECE0', dot: '#B6AE9C', avatarBg: '#ECE6D8', avatarFg: '#A89C82' },
};

function Avatar({ name, bg, fg }: { name: string; bg: string; fg: string }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: '50%', background: bg, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontWeight: 600, color: fg, fontSize: 16 }}>
      {initials(name)}
    </div>
  );
}

export default function Dashboard({
  judgeName, items, tieBreaks, onGrade, onTieBreak,
}: {
  judgeName: string;
  items: JudgeQueueItem[];
  tieBreaks: TieBreakItem[];
  onGrade: (c: JudgeQueueItem) => void;
  onTieBreak: (t: TieBreakItem) => void;
}) {
  const [tab, setTab] = useState<'queue' | 'tiebreaks'>('queue');
  const [showGraded, setShowGraded] = useState(false);

  const toGrade = items.filter((i) => i.status !== 'graded');
  const graded = items.filter((i) => i.status === 'graded');
  const pendingTB = tieBreaks.filter((t) => !t.graded).length;

  const Tab = ({ id, label, badge, badgeColor }: { id: 'queue' | 'tiebreaks'; label: string; badge?: number; badgeColor?: string }) => {
    const on = tab === id;
    return (
      <button onClick={() => setTab(id)} style={{ flex: 1, padding: '13px 8px', background: on ? C.parchment : 'transparent', border: 'none', borderBottom: on ? `2.5px solid ${C.green}` : '2.5px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: on ? C.greenDeep : C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {label}
        {badge != null && badge > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: badgeColor ?? C.green, borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: C.canvas, display: 'flex', justifyContent: 'center', padding: '28px 16px' }}>
      <div style={{ width: 580, maxWidth: '100%', background: C.parchment, borderRadius: 10, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        <div style={{ padding: '20px 24px 14px', background: C.cream }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.greenDeep }}>{judgeName}</span>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{toGrade.length} to grade · {graded.length} graded</div>
        </div>
        <div style={{ display: 'flex', background: C.cream, borderBottom: `1px solid ${C.line}` }}>
          <Tab id="queue" label="Queue" badge={toGrade.length} badgeColor={C.brass} />
          <Tab id="tiebreaks" label="Tie-breaks" badge={pendingTB} badgeColor={C.fail} />
        </div>

        {tab === 'queue' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {items.length === 0 && (
              <div style={{ padding: '32px 8px', textAlign: 'center', color: C.muted, fontSize: 14 }}>No contestants assigned to your panel yet.</div>
            )}
            {toGrade.map((c) => {
              const s = STATUS[c.status];
              const live = c.status === 'in_progress';
              return (
                <div key={c.enrollmentId} onClick={() => onGrade(c)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1.5px solid ${live ? C.brass : C.line}`, boxShadow: live ? '0 0 0 3px rgba(185,150,68,.12)' : 'none', borderRadius: 10, padding: '12px 15px', cursor: 'pointer' }}>
                  <Avatar name={c.name} bg={s.avatarBg} fg={s.avatarFg} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{c.name}</div>
                    <div style={{ fontSize: 12.5, color: live ? C.brassDark : C.muted }}>{c.slotLabel} · {c.detail}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: s.color, background: s.bg, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot, display: 'inline-block' }} />
                    {s.label}
                  </span>
                </div>
              );
            })}

            {graded.length > 0 && (
              <>
                <button onClick={() => setShowGraded((v) => !v)} style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, fontWeight: 600, color: C.muted, padding: '6px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {showGraded ? '▾' : '▸'} Graded ({graded.length})
                </button>
                {showGraded && graded.map((c) => {
                  const s = STATUS.graded;
                  return (
                    <div key={c.enrollmentId} onClick={() => onGrade(c)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px 15px', cursor: 'pointer', opacity: 0.85 }}>
                      <Avatar name={c.name} bg={s.avatarBg} fg={s.avatarFg} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{c.name}</div>
                        <div style={{ fontSize: 12.5, color: C.muted }}>{c.slotLabel}</div>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: s.color, background: s.bg, padding: '5px 11px', borderRadius: 999 }}>Graded</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === 'tiebreaks' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {tieBreaks.length === 0 && (
              <div style={{ padding: '36px 12px', textAlign: 'center', color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
                No tie-breaks right now.<br />
                <span style={{ fontSize: 12.5 }}>When the admin starts a sudden-death, the tied contestants appear here for you to re-grade.</span>
              </div>
            )}
            {tieBreaks.map((t) => (
              <div key={t.roundId + t.contestantId} onClick={() => !t.graded && onTieBreak(t)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1.5px solid ${t.graded ? C.line : C.fail}`, borderRadius: 10, padding: '12px 15px', cursor: t.graded ? 'default' : 'pointer', opacity: t.graded ? 0.8 : 1 }}>
                <Avatar name={t.name} bg={t.graded ? STATUS.graded.avatarBg : '#FBE6E0'} fg={t.graded ? STATUS.graded.avatarFg : C.fail} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink }}>{t.name}</div>
                  <div style={{ fontSize: 12.5, color: C.muted }}>{t.slotLabel} · sudden-death</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: t.graded ? STATUS.graded.color : '#fff', background: t.graded ? STATUS.graded.bg : C.fail, padding: '5px 12px', borderRadius: 999 }}>
                  {t.graded ? 'Graded' : 'Grade →'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
