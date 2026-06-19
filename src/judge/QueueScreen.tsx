import { JUDGE, SAMPLE_QUEUE, type QueueContestant, type QueueStatus } from './sampleQueue';

const serif = "'Spectral', serif";

const STATUS: Record<QueueStatus, { label: string; color: string; bg: string; dot: string; avatarBg: string; avatarFg: string }> = {
  graded: { label: 'Graded', color: '#206560', bg: '#DCEAE6', dot: '#2A7A73', avatarBg: 'linear-gradient(135deg,#DCEAE6,#BCD3CD)', avatarFg: '#206560' },
  in_progress: { label: 'In progress', color: '#9C7C34', bg: '#F6EFDA', dot: '#B99644', avatarBg: 'linear-gradient(135deg,#F6EFDA,#E8D9AE)', avatarFg: '#9C7C34' },
  not_started: { label: 'Not started', color: '#8A938E', bg: '#F0ECE0', dot: '#B6AE9C', avatarBg: '#ECE6D8', avatarFg: '#A89C82' },
};

const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export default function QueueScreen({ onSelect }: { onSelect: (c: QueueContestant) => void }) {
  const graded = SAMPLE_QUEUE.filter((c) => c.status === 'graded').length;
  const inProgress = SAMPLE_QUEUE.filter((c) => c.status === 'in_progress').length;

  return (
    <div style={{ width: '100%', height: '100vh', background: '#E3DDD0', display: 'flex', justifyContent: 'center', padding: '32px 16px', overflow: 'auto' }}>
      <div style={{ width: 560, maxWidth: '100%', background: '#F4EFE4', borderRadius: 8, boxShadow: '0 6px 22px rgba(20,40,36,.14)', overflow: 'hidden', alignSelf: 'flex-start', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px 16px', background: '#FBF8F1', borderBottom: '1px solid #EAE3D4' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: '#16413B' }}>Your queue</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9C7C34', background: '#F6EFDA', padding: '4px 11px', borderRadius: 999 }}>{JUDGE.slotLabel}</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8A938E', marginTop: 5 }}>
            {SAMPLE_QUEUE.length} contestants · {graded} graded · {inProgress} in progress
          </div>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {SAMPLE_QUEUE.map((c) => {
            const s = STATUS[c.status];
            const live = c.status === 'in_progress';
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1.5px solid ${live ? '#B99644' : '#EAE3D4'}`, boxShadow: live ? '0 0 0 3px rgba(185,150,68,.12)' : 'none', borderRadius: 10, padding: '12px 15px', cursor: 'pointer' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: s.avatarBg, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontWeight: 600, color: s.avatarFg, fontSize: 16 }}>
                  {initials(c.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: '#1C2926' }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: c.status === 'in_progress' ? '#9C7C34' : '#8A938E' }}>{c.detail}</div>
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
