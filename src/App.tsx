import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import JudgeApp from './judge/JudgeApp';
import AdminApp from './admin/AdminApp';
import { C, serif, arabic } from './ui/theme';

function Routed() {
  const { role, loading } = useAuth();
  const [judgePreview, setJudgePreview] = useState(false);

  if (loading) return <Splash />;
  if (role === 'admin') return <AdminApp />;
  if (role === 'judge') return <JudgeApp />;
  if (judgePreview) return <JudgeApp />;
  return <AdminLogin onJudgePreview={() => setJudgePreview(true)} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}

function Splash() {
  return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.canvas, color: C.muted, fontFamily: serif }}>Loading…</div>;
}

function AdminLogin({ onJudgePreview }: { onJudgePreview: () => void }) {
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInAdmin(email, password);
    } catch {
      setError('Sign-in failed — check the email and password.');
      setBusy(false);
    }
  };

  const field: React.CSSProperties = { width: '100%', background: '#fff', border: '1px solid #D8D0BE', borderRadius: 8, padding: '12px 14px', fontSize: 14, color: C.ink, marginBottom: 14, fontFamily: 'inherit' };

  return (
    <div style={{ height: '100vh', background: 'radial-gradient(circle at 50% 30%, #FBF8F1, #F1E9D9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>
      <img src="/ibn-katheer-logo.svg" alt="" style={{ width: 120, height: 92, objectFit: 'contain', marginBottom: 16 }} />
      <div style={{ fontFamily: arabic, fontSize: 18, color: C.brassDark, direction: 'rtl', marginBottom: 10 }}>بسم الله</div>
      <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: C.greenDeep, marginBottom: 4 }}>Organizer sign-in</div>
      <div style={{ fontSize: 13.5, color: C.sub, marginBottom: 24 }}>The single administrator credential for the event.</div>

      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360 }}>
        <input style={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input style={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <div style={{ color: C.fail, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ width: '100%', background: C.green, color: '#fff', fontSize: 15, fontWeight: 700, padding: 14, borderRadius: 8, border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {import.meta.env.DEV && (
        <div style={{ marginTop: 26, fontSize: 12.5, color: C.muted }}>
          <div>Dev · emulator admin: <code>admin@ibnkatheer.local</code> / <code>admin123</code></div>
          <button onClick={onJudgePreview} style={{ marginTop: 8, background: 'transparent', border: 'none', color: C.green, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Preview judge app (sample data)</button>
        </div>
      )}
    </div>
  );
}
