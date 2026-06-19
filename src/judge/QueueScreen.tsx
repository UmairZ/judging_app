import { C, serif, initials } from '../ui/theme';
import type { JudgeQueueItem, QueueStatus } from './useJudgeQueue';

const STATUS: Record<QueueStatus, { label: string; color: string; bg: string; dot: string; avatarBg: string; avatarFg: string }> = {
  graded: { label: 'Graded', color: '#206560', bg: '#DCEAE6', dot: '#2A7A73', avatarBg: 'linear-gradient(135deg,#DCEAE6,#BCD3CD)', avatarFg: '#206560' },
  in_progress: { label: 'In progress', color: '#9C7C34', bg: '#F6EFDA', dot: '#B99644', avatarBg: 'linear-gradient(135deg,#F6EFDA,#E8D9AE)', avatarFg: '#9C7C34' },
  not_started: { label: 'Not started', color: '#8A938E', bg: '#F0ECE0', dot: '#B6AE9C', avatarBg: '#ECE6D8', avatarFg: '#A89C82' },
};

export default function QueueScreen({ items, onSelect }: { items: JudgeQueueItem[]; onSelect: (c: JudgeQueueItem) => void }) {
  const graded = items.filter((i) => i.status === 'graded').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: C.canvas, display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: 560, maxWidth: '100%', background: C.parchment, borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden', alignSelf: 'flex-start' }}>
        <div style={{ padding: '20px 24px 16px', background: C.cream, borderBottom: `1px solid ${C.line}` }}>
          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.greenDeep }}>Your queue</span>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>{items.length} contestants · {graded} graded · {inProgress} in progress</div>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {items.length === 0 && (
            <div style={{ padding: '32px 8px', textAlign: 'center', color: C.muted, fontSize: 14 }}>No contestants assigned to your panel yet.</div>
          )}
          {items.map((c) => {
            const s = STATUS[c.status];
            const live = c.status === 'in_progress';
            return (
              <div key={c.enrollmentId} onClick={() => onSelect(c)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1.5px solid ${live ? C.brass : C.line}`, boxShadow: live ? '0 0 0 3px rgba(185,150,68,.12)' : 'none', borderRadius: 10, padding: '12px 15px', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: s.avatarBg, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontWeight: 600, color: s.avatarFg, fontSize: 16 }}>
                  {initials(c.name)}
                </div>
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
        </div>
      </div>
    </div>
  );
}
