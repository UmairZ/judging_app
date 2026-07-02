import { useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, auth } from '../firebase/app';
import { useAuth } from '../auth/AuthContext';
import { JOIN_CODE_RE } from './logic';
import { C, serif, arabic } from '../ui/theme';

export default function JoinScreen({ orgId, compId, code: urlCode }: { orgId: string; compId: string; code: string | null }) {
  const { user } = useAuth();
  const [code, setCode] = useState(urlCode ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!JOIN_CODE_RE.test(trimmed)) { setError('That code doesn’t look right — 8 letters/numbers.'); return; }
    setBusy(true);
    setError('');
    try {
      // Judges normally arrive signed out — an anonymous account is their identity for the event.
      if (!auth.currentUser) await signInAnonymously(auth);
      await httpsCallable(getFunctions(app, 'us-central1'), 'redeemJoinCode')({ orgId, compId, code: trimmed });
      window.location.href = `/${orgId}/${compId}`;
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Could not join — check the code with your organizer.');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: arabic, fontSize: 18, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, color: C.greenDeep, marginBottom: 6 }}>Join the competition</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 22 }}>Enter the code your organizer gave you.</div>
      <div style={{ width: '100%', maxWidth: 300 }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="JOIN CODE"
          maxLength={8}
          style={{ width: '100%', textAlign: 'center', letterSpacing: '.35em', fontWeight: 700, fontSize: 20, background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '14px 10px', color: C.ink, boxSizing: 'border-box', marginBottom: 14, textTransform: 'uppercase' }}
        />
        {error && <div style={{ color: C.fail, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button onClick={() => void join()} disabled={busy} style={{ width: '100%', background: C.green, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Joining…' : user && !user.isAnonymous ? `Join as ${user.email ?? 'this account'}` : 'Join'}
        </button>
      </div>
    </div>
  );
}
