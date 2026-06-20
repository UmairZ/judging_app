import { useState, type ReactNode } from 'react';
import Leaderboard from './Leaderboard';
import Registrations from './Registrations';
import Contestants from './Contestants';
import StructurePanels from './StructurePanels';
import ScoringConfig from './ScoringConfig';
import Devices from './Devices';
import Projector from './Projector';
import { useAuth } from '../auth/AuthContext';
import { C, serif } from '../ui/theme';

type NavItem = { id: string; label: string; el: ReactNode };
type NavRow = NavItem | { group: string };

const NAV: NavRow[] = [
  { id: 'leaderboard', label: 'Leaderboard', el: <Leaderboard /> },
  { group: 'Set up' },
  { id: 'categories', label: 'Categories & Divisions', el: <StructurePanels section="structure" /> },
  { id: 'scoring', label: 'Scoring Engine', el: <ScoringConfig /> },
  { id: 'judgespanels', label: 'Judges & Panels', el: <StructurePanels section="panels" /> },
  { id: 'provisioning', label: 'Provisioning', el: <Devices /> },
  { group: 'Participants' },
  { id: 'registrations', label: 'Registrations', el: <Registrations /> },
  { id: 'contestants', label: 'Contestants', el: <Contestants /> },
  { id: 'display', label: 'Display', el: <Projector /> },
];

const items = NAV.filter((n): n is NavItem => 'id' in n);

export default function AdminApp({ onExit }: { onExit?: () => void }) {
  const [tab, setTab] = useState<string>('leaderboard');
  const { user, signOut } = useAuth();
  const current = items.find((n) => n.id === tab) ?? items[0];

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.canvas }}>
      <div style={{ width: 240, flex: 'none', background: C.greenDeep, color: '#fff', display: 'flex', flexDirection: 'column', padding: '22px 0', overflow: 'auto' }}>
        <div style={{ padding: '0 22px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/ibn-katheer-logo.svg" alt="" style={{ height: 34, filter: 'brightness(0) invert(1)' }} />
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600 }}>Admin</div>
        </div>
        {NAV.map((n, i) => {
          if ('group' in n) {
            return (
              <div key={`g${i}`} style={{ padding: '16px 22px 6px', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6F9389', fontWeight: 700 }}>
                {n.group}
              </div>
            );
          }
          const on = tab === n.id;
          return (
            <div
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{ padding: '11px 22px', cursor: 'pointer', fontSize: 14, fontWeight: on ? 600 : 400, color: on ? '#fff' : '#9DBDB4', background: on ? '#11332D' : 'transparent', borderLeft: `3px solid ${on ? C.gold : 'transparent'}` }}
            >
              {n.label}
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '18px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {user && <div onClick={() => signOut()} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>Sign out</div>}
          {onExit && <div onClick={onExit} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>← Exit preview</div>}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: current.id === 'display' ? 0 : 28 }}>{current.el}</div>
    </div>
  );
}
