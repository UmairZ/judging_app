import { useState, useRef, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useMembership } from '../auth/MembershipContext';
import { useTenant } from '../tenant/TenantContext';
import { useCollection, useDocData } from '../data/db';
import type { JudgeDoc, PanelDoc, AssignmentDoc, TiebreakDoc, SessionDoc, ContestantDoc, EnrollmentDoc } from '../data/types';
import { DEFAULT_STRUCTURE_CONFIG, type StructureConfig } from '../domain/structure';
import { enrollmentId } from '../domain/ids';
import { C, serif } from '../ui/theme';
import WelcomeScreen from './WelcomeScreen';
import Dashboard, { type TieBreakItem } from './Dashboard';
import GradingScreen from './GradingScreen';
import { buildJudgeQueue, type JudgeQueueItem } from './useJudgeQueue';

export default function JudgeApp() {
  const { signInEmail } = useAuth();
  const { judgeId: memberJudgeId } = useMembership();
  const judgeId = memberJudgeId ?? '';
  const { tp } = useTenant();
  const [screen, setScreen] = useState<'welcome' | 'dashboard' | 'grading' | 'tiebreak'>('welcome');
  const [selected, setSelected] = useState<JudgeQueueItem | null>(null);
  const [tbTarget, setTbTarget] = useState<TieBreakItem | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const judges = useCollection<JudgeDoc>(tp('judges'));
  const panels = useCollection<PanelDoc>(tp('panels'));
  const assignments = useCollection<AssignmentDoc>(tp('assignments'));
  const tiebreaks = useCollection<TiebreakDoc>(tp('tiebreaks'));
  const sessions = useCollection<SessionDoc>(tp('sessions'));
  const contestants = useCollection<ContestantDoc>(tp('contestants'));
  const enrollments = useCollection<EnrollmentDoc>(tp('enrollments'));
  const structure = useDocData<StructureConfig>(tp('config/structure')).data ?? DEFAULT_STRUCTURE_CONFIG;

  // Single source for the queue — collections are subscribed once here, not again inside the hook.
  const items = useMemo(
    () => buildJudgeQueue(judgeId, { panels, assignments, enrollments, contestants, sessions, structure }),
    [judgeId, panels, assignments, enrollments, contestants, sessions, structure],
  );
  const startedCountFor = (enr: string) => sessions.filter((s) => s.enrollmentId === enr).length;

  const judgeName = judges.find((j) => j.id === judgeId)?.name ?? 'Judge';
  const myPanel = panels.find((p) => p.judgeIds.includes(judgeId));
  const slots = [...new Set(items.map((i) => i.slotLabel))];
  const subtitle = slots.length ? slots.join(' · ') : 'Your assigned contestants';
  const catLabel = (id: string) => structure.categories.find((c) => c.id === id)?.label ?? id;
  const divLabel = (id: string) => structure.divisions.find((d) => d.id === id)?.label ?? id;
  const panelMeta = { panelName: myPanel?.name ?? '', judgeIndex: myPanel ? myPanel.judgeIds.indexOf(judgeId) + 1 : 0, panelSize: myPanel?.judgeIds.length ?? 0 };

  // Sudden-death rounds the admin started for this judge's panel.
  const tieBreaks: TieBreakItem[] = tiebreaks
    .filter((t) => t.method === 'question' && assignments.find((a) => a.category === t.category && a.division === t.division)?.panelId === myPanel?.id)
    .flatMap((t) =>
      (t.contestantIds ?? []).map((cid) => {
        const enr = enrollmentId(cid, t.category);
        const sess = sessions.find((s) => s.id === `${enr}__${judgeId}`);
        return {
          roundId: t.id,
          contestantId: cid,
          name: contestants.find((c) => c.id === cid)?.fullName ?? '—',
          enrollmentId: enr,
          category: t.category,
          slotLabel: `${catLabel(t.category)} · ${divLabel(t.division)}`,
          graded: !!sess?.questions?.some((q) => q.isTieBreak),
        };
      }),
    );

  // Hidden admin re-entry: long-press the top-left corner for ~1.2s.
  const pressTimer = useRef<number | null>(null);
  const startPress = () => { pressTimer.current = window.setTimeout(() => setAdminOpen(true), 1200); };
  const endPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  let content;
  if (screen === 'welcome') {
    content = <WelcomeScreen name={judgeName} subtitle={subtitle} onStart={() => setScreen('dashboard')} />;
  } else if (screen === 'grading' && selected) {
    const minQuestions = structure.categories.find((c) => c.id === selected.category)?.minQuestions ?? 4;
    const meta = { position: items.findIndex((i) => i.enrollmentId === selected.enrollmentId) + 1, total: items.length, ...panelMeta, startedCount: startedCountFor(selected.enrollmentId) };
    content = (
      <GradingScreen
        contestant={{ name: selected.name, slotLabel: selected.slotLabel }}
        enrollmentId={selected.enrollmentId}
        judgeId={judgeId}
        minQuestions={minQuestions}
        meta={meta}
        onEnd={() => setScreen('dashboard')}
      />
    );
  } else if (screen === 'tiebreak' && tbTarget) {
    content = (
      <GradingScreen
        contestant={{ name: tbTarget.name, slotLabel: tbTarget.slotLabel }}
        enrollmentId={tbTarget.enrollmentId}
        judgeId={judgeId}
        minQuestions={1}
        meta={{ position: 0, total: 0, ...panelMeta, startedCount: startedCountFor(tbTarget.enrollmentId) }}
        tieBreak
        onEnd={() => setScreen('dashboard')}
      />
    );
  } else {
    content = (
      <Dashboard
        judgeName={judgeName}
        items={items}
        tieBreaks={tieBreaks}
        onGrade={(c) => { setSelected(c); setScreen('grading'); }}
        onTieBreak={(t) => { setTbTarget(t); setScreen('tiebreak'); }}
      />
    );
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
      {adminOpen && <AdminReentry onClose={() => setAdminOpen(false)} signInEmail={signInEmail} />}
    </>
  );
}

function AdminReentry({ onClose, signInEmail }: { onClose: () => void; signInEmail: (email: string, password: string) => Promise<unknown> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInEmail(email, password); // success → auth switches, App re-routes to the organizer's admin surface
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
