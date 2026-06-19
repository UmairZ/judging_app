import { useState } from 'react';
import Leaderboard from './Leaderboard';
import Registrations from './Registrations';
import Contestants from './Contestants';
import StructurePanels from './StructurePanels';
import ScoringConfig from './ScoringConfig';
import Devices from './Devices';
import Projector from './Projector';
import { useAuth } from '../auth/AuthContext';
import { C, serif } from '../ui/theme';

const NAV = [
  { id: 'leaderboard', label: 'Leaderboard', el: <Leaderboard /> },
  { id: 'registrations', label: 'Registrations', el: <Registrations /> },
  { id: 'contestants', label: 'Contestants', el: <Contestants /> },
  { id: 'structure', label: 'Structure & Panels', el: <StructurePanels /> },
  { id: 'scoring', label: 'Scoring', el: <ScoringConfig /> },
  { id: 'devices', label: 'Judge Devices', el: <Devices /> },
  { id: 'display', label: 'Display', el: <Projector /> },
] as const;

export default function AdminApp({ onExit }: { onExit?: () => void }) {
  const [tab, setTab] = useState<string>('leaderboard');
  const { user, signOut } = useAuth();
  const current = NAV.find((n) => n.id === tab) ?? NAV[0];

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.canvas }}>
      <div style={{ width: 240, flex: 'none', background: C.greenDeep, color: '#fff', display: 'flex', flexDirection: 'column', padding: '22px 0' }}>
        <div style={{ padding: '0 22px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/ibn-katheer-logo.svg" alt="" style={{ height: 34, filter: 'brightness(0) invert(1)' }} />
          <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600 }}>Admin</div>
        </div>
        {NAV.map((n) => {
          const on = tab === n.id;
          return (
            <div key={n.id} onClick={() => setTab(n.id)} style={{ padding: '12px 22px', cursor: 'pointer', fontSize: 14, fontWeight: on ? 600 : 400, color: on ? '#fff' : '#9DBDB4', background: on ? '#11332D' : 'transparent', borderLeft: `3px solid ${on ? C.gold : 'transparent'}` }}>
              {n.label}
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {user && <div onClick={() => signOut()} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>Sign out</div>}
          {onExit && <div onClick={onExit} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>← Exit preview</div>}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: current.id === 'display' ? 0 : 28 }}>{current.el}</div>
    </div>
  );
}
