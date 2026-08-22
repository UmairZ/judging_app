import { useState, type ReactNode } from 'react';
import Leaderboard from './Leaderboard';
import Registrations from './Registrations';
import Contestants from './Contestants';
import StructurePanels from './StructurePanels';
import ScoringConfig from './ScoringConfig';
import Devices from './Devices';
import { setupStepLabel } from './logic';
import { useAuth } from '../auth/AuthContext';
import { useCollection } from '../data/db';
import { useTenant } from '../tenant/TenantContext';
import type { JudgeDoc, ContestantDoc } from '../data/types';
import { C, serif } from '../ui/theme';
import Wordmark from '../ui/Wordmark';

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
];

const items = NAV.filter((n): n is NavItem => 'id' in n);

export default function AdminApp({ onExit }: { onExit?: () => void }) {
  const [tab, setTab] = useState<string>('leaderboard');
  const { user, signOut } = useAuth();
  const { tp } = useTenant();
  const judges = useCollection<JudgeDoc>(tp('judges'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const current = items.find((n) => n.id === tab) ?? items[0];

  // First-run checklist: guides a brand-new competition through the three setup tabs.
  // Hidden the moment a single contestant exists — from then on the leaderboard is the story.
  const showSetup = contestants.length === 0;
  const setupSteps: { glyph: string; label: string; done: boolean; tabId: string }[] = [
    { glyph: '①', label: 'Review categories', done: true, tabId: 'categories' },
    { glyph: '②', label: 'Add judges & panels', done: judges.length > 0, tabId: 'judgespanels' },
    { glyph: '③', label: 'Add contestants', done: contestants.length > 0, tabId: 'contestants' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.canvas }}>
      <div style={{ width: 240, flex: 'none', background: C.greenDeep, color: '#fff', display: 'flex', flexDirection: 'column', padding: '22px 0', overflow: 'auto' }}>
        <div style={{ padding: '0 22px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wordmark size={20} onDark />
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
          <div onClick={() => { window.location.href = '/'; }} style={{ cursor: 'pointer', fontSize: 13, color: '#9DBDB4' }}>← Dashboard</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {showSetup && (
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '13px 20px', marginBottom: 20, background: C.parchment, border: `1px solid ${C.cardLine}`, borderRadius: 8 }}>
            {setupSteps.map((s, i) => (
              <div key={s.tabId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  onClick={() => setTab(s.tabId)}
                  style={{ fontSize: 13, fontWeight: 600, color: s.done ? C.green : C.brassDark, cursor: 'pointer' }}
                >
                  {setupStepLabel(s.glyph, s.label, s.done)}
                </span>
                {i < setupSteps.length - 1 && <span style={{ color: C.muted, fontSize: 13 }}>→</span>}
              </div>
            ))}
          </div>
        )}
        {current.el}
      </div>
    </div>
  );
}
