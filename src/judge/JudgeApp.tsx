import { useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useDocData } from '../data/db';
import type { JudgeDoc } from '../data/types';
import { DEFAULT_STRUCTURE_CONFIG, type StructureConfig } from '../domain/structure';
import { C, serif } from '../ui/theme';
import WelcomeScreen from './WelcomeScreen';
import QueueScreen from './QueueScreen';
import GradingScreen from './GradingScreen';
import { useJudgeQueue, type JudgeQueueItem } from './useJudgeQueue';

export default function JudgeApp() {
  const { user, signInAdmin } = useAuth();
  const judgeId = user?.uid ?? '';
  const [screen, setScreen] = useState<'welcome' | 'queue' | 'grading'>('welcome');
  const [selected, setSelected] = useState<JudgeQueueItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const items = useJudgeQueue(judgeId);
  const judges = useCollection<JudgeDoc>('judges');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;

  const judgeName = judges.find((j) => j.id === judgeId)?.name ?? 'Judge';
  const slots = [...new Set(items.map((i) => i.slotLabel))];
  const subtitle = slots.length ? slots.join(' · ') : 'Your assigned contestants';

  // Hidden admin re-entry: long-press the top-left corner for ~1.2s.
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(() => setAdminOpen(true), 1200); };
  const endPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  let content;
  if (screen === 'welcome') {
    content = <WelcomeScreen name={judgeName} subtitle={subtitle} onStart={() => setScreen('queue')} />;
  } else if (screen === 'grading' && selected) {
    const minQuestions = structure.categories.find((c) => c.id === selected.category)?.minQuestions ?? 4;
    content = (
      <GradingScreen
        contestant={{ name: selected.name, slotLabel: selected.slotLabel }}
        enrollmentId={selected.enrollmentId}
        judgeId={judgeId}
        minQuestions={minQuestions}
        onEnd={() => setScreen('queue')}
      />
    );
  } else {
    content = <QueueScreen items={items} onSelect={(c) => { setSelected(c); setScreen('grading'); }} />;
  }

  return (
    <>
      {content}
      <div
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        title="Hold to switch to admin"
        style={{ position: 'fixed', top: 0, left: 0, width: 64, height: 64, zIndex: 60 }}
      />
      {adminOpen && <AdminReentry onClose={() => setAdminOpen(false)} signInAdmin={signInAdmin} />}
    </>
  );
}

function AdminReentry({ onClose, signInAdmin }: { onClose: () => void; signInAdmin: (email: string, password: string) => Promise<unknown> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInAdmin(email, password); // success → auth switches, App re-routes to AdminApp
    } catch {
      setError('Sign-in failed — check the admin email and password.');
      setBusy(false);
    }
  };

  const field: React.CSSProperties = { width: '100%', background: '#fff', border: `1px solid #D8D0BE`, borderRadius: 8, padding: '11px 13px', fontSize: 14, color: C.ink, marginBottom: 12, boxSizing: 'border-box', outline: 'none' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(6,33,28,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 24 }}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 360, maxWidth: '100%', background: C.parchment, borderRadius: 12, padding: '24px 24px 20px', boxShadow: '0 20px 60px rgba(6,33,28,.4)' }}>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Admin sign-in</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 18 }}>Return this device to organizer mode.</div>
        <input style={field} type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        <input style={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <div style={{ color: C.fail, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ fontSize: 13.5, color: C.sub, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px' }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: C.green, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
