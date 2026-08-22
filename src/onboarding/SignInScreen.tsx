import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { C, serif, arabic } from '../ui/theme';

const field: React.CSSProperties = { width: '100%', background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.ink, marginBottom: 14, fontFamily: 'inherit', boxSizing: 'border-box' };

export default function SignInScreen() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (mode === 'signin' ? signInEmail(email, password) : signUpEmail(email, password));
    } catch {
      setError(mode === 'signin' ? 'Sign-in failed — check the email and password.' : 'Sign-up failed — try a different email or a longer password.');
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError('');
    try {
      await signInGoogle();
    } catch {
      setError('Google sign-in was cancelled or failed.');
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontFamily: arabic, fontSize: 18, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>
        {mode === 'signin' ? 'Sign in' : 'Create your account'}
      </div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 24 }}>Run Quran competitions — judging, live scores, leaderboards.</div>

      <div style={{ width: '100%', maxWidth: 360 }}>
        <button onClick={google} disabled={busy} style={{ width: '100%', background: '#fff', color: C.ink, fontSize: 14.5, fontWeight: 600, padding: 13, borderRadius: 8, border: '1px solid #D8D0BE', cursor: busy ? 'default' : 'pointer', marginBottom: 18 }}>
          Continue with Google
        </button>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>— or with email —</div>
        <form onSubmit={submit}>
          <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <input style={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          {error && <div style={{ color: C.fail, fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ width: '100%', background: C.green, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} style={{ marginTop: 14, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </div>

      {import.meta.env.DEV && (
        <div style={{ marginTop: 26, fontSize: 12.5, color: C.muted }}>
          <div>Dev · emulator admin: <code>admin@demo.local</code> / <code>admin123</code></div>
          <button onClick={() => void signInEmail('j1@judge.local', 'judge123')} style={{ marginTop: 8, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Sign in as a judge (j1)</button>
        </div>
      )}
    </div>
  );
}
